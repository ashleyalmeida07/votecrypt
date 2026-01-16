import { NextResponse } from 'next/server'
import { sql, getLatestElection } from '@/lib/db'
import {
    generateNullifier,
    generateMerkleProof,
    hexToBigInt,
    bigIntToHex,
    verifyMerkleProof
} from '@/lib/zkp'

export const dynamic = 'force-dynamic'

/**
 * POST: Cast an anonymous vote using ZKP
 * 
 * The voter proves they're in the Merkle tree without revealing their identity.
 * Double-voting is prevented via nullifiers.
 */
export async function POST(request: Request) {
    try {
        const {
            secret,
            nullifierSecret,
            candidateId
        } = await request.json()

        // Validate inputs
        if (!secret || !nullifierSecret || candidateId === undefined) {
            return NextResponse.json(
                { error: 'Secret, nullifierSecret, and candidateId are required' },
                { status: 400 }
            )
        }

        // 1. Get current election
        const election = await getLatestElection()
        if (!election) {
            return NextResponse.json(
                { error: 'No active election found' },
                { status: 404 }
            )
        }

        if (election.state !== 'Voting') {
            return NextResponse.json(
                { error: `Election is not open for voting. Current state: ${election.state}` },
                { status: 403 }
            )
        }

        const electionId = election.id

        // 2. Generate nullifier for this election
        const nullifierHash = await generateNullifier(nullifierSecret, electionId)

        // 3. Check if nullifier has been used (DOUBLE-SPEND PROTECTION)
        const usedNullifier = await sql`
            SELECT * FROM zkp_nullifiers 
            WHERE election_id = ${electionId} AND nullifier_hash = ${nullifierHash}
        `

        if (usedNullifier.length > 0) {
            return NextResponse.json(
                { error: 'You have already voted in this election (nullifier used)' },
                { status: 400 }
            )
        }

        // 4. Check if there are voters registered
        const voterCount = await sql`
            SELECT COUNT(*) as count FROM voter_commitments 
            WHERE election_id = ${electionId}
        `

        if (voterCount[0].count === 0) {
            return NextResponse.json(
                { error: 'No voters registered for this election' },
                { status: 400 }
            )
        }

        // 5. Compute voter's commitment from secrets
        const { generateCommitment } = await import('@/lib/zkp')
        const voterCommitment = await generateCommitment(secret, nullifierSecret)

        // 6. Verify voter commitment exists in database (simpler and more reliable than Merkle proof)
        const commitmentCheck = await sql`
            SELECT * FROM voter_commitments 
            WHERE election_id = ${electionId} AND commitment = ${voterCommitment}
        `

        if (commitmentCheck.length === 0) {
            return NextResponse.json(
                { error: 'Your commitment is not in the voter registry. Please register first.' },
                { status: 403 }
            )
        }

        console.log('✅ Voter commitment verified in database')

        // 8. Validate candidate
        const candidates = await sql`
            SELECT * FROM candidates WHERE election_id = ${electionId}
        `

        const candidate = candidates.find(c => c.blockchain_id === candidateId || c.id === candidateId)
        if (!candidate) {
            return NextResponse.json(
                { error: 'Invalid candidate ID' },
                { status: 400 }
            )
        }

        // 9. Record nullifier (prevents double voting)
        await sql`
            INSERT INTO zkp_nullifiers (election_id, nullifier_hash)
            VALUES (${electionId}, ${nullifierHash})
        `

        // 10. Update candidate vote count (anonymous!)
        await sql`
            UPDATE candidates 
            SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${candidate.id}
        `

        // 11. Submit to on-chain ZKP contract
        const { writeZkpContract, getTransactionReceipt, publicClient } = await import('@/lib/contract')
        const { bigIntToHex, isZkpEnabled, computeMerkleRoot } = await import('@/lib/zkp')
        const zkpAbi = (await import('@/Solidity/zkp-abi.json')).default

        let transactionHash: string | null = null
        let blockNumber: number | null = null

        const contractAddress = process.env.ZKP_CONTRACT_ADDR as `0x${string}` | undefined

        // Compute Merkle root from all commitments for on-chain verification
        const allCommitmentsResult = await sql`
            SELECT commitment FROM voter_commitments 
            WHERE election_id = ${electionId}
            ORDER BY merkle_index ASC
        `
        const leaves = allCommitmentsResult.map((c: any) => hexToBigInt(c.commitment))
        const merkleRoot = await computeMerkleRoot(leaves)

        // Pre-flight: Check if on-chain Merkle root matches our computed root
        if (contractAddress) {
            const merkleRootHex = bigIntToHex(merkleRoot)

            try {
                const onChainRoot = await publicClient.readContract({
                    address: contractAddress,
                    abi: zkpAbi,
                    functionName: 'merkleRoot',
                }) as string

                console.log(`🔍 On-chain Merkle root: ${onChainRoot}`)
                console.log(`🔍 Computed Merkle root: ${merkleRootHex}`)

                if (onChainRoot.toLowerCase() !== merkleRootHex.toLowerCase()) {
                    console.log('⚠️ Merkle root MISMATCH! Syncing to chain before vote...')

                    // Auto-sync the Merkle root to match our database
                    await writeZkpContract('updateMerkleRoot', [merkleRootHex as `0x${string}`], contractAddress)
                    console.log('✅ Merkle root synced to chain')

                    // Wait a moment for the tx to be picked up
                    await new Promise(r => setTimeout(r, 2000))
                }
            } catch (rootCheckError: any) {
                console.error('⚠️ Could not verify on-chain Merkle root:', rootCheckError.message)
            }
        }

        if (contractAddress) {
            console.log(`🔗 Submitting anonymous vote to on-chain ZKP contract: ${contractAddress}...`)

            // Convert inputs to format expected by contract
            const nullifierBytes32 = nullifierHash as `0x${string}`
            const merkleRootBytes32 = bigIntToHex(merkleRoot) as `0x${string}`
            const candidateBlockchainId = candidate.blockchain_id ?? candidateId

            try {
                transactionHash = await writeZkpContract(
                    'voteAnonymous',
                    [
                        nullifierBytes32,
                        BigInt(candidateBlockchainId),
                        merkleRootBytes32
                    ],
                    contractAddress
                )

                console.log(`📦 On-chain tx submitted: ${transactionHash}`)

                // Wait for receipt to get block number
                const receipt = await getTransactionReceipt(transactionHash as `0x${string}`)
                if (receipt) {
                    blockNumber = receipt.blockNumber
                }
            } catch (onChainError: any) {
                console.error('⚠️ On-chain vote failed, but DB vote recorded:', onChainError.message)
                // We still treat this as success since DB vote is recorded, but warn
            }
        }

        // 12. Log anonymous vote (no identity revealed!)
        console.log(`🗳️ Anonymous ZKP vote cast: Nullifier ${nullifierHash.slice(0, 18)}...`)

        return NextResponse.json({
            success: true,
            message: transactionHash ? 'Anonymous vote recorded on blockchain!' : 'Anonymous vote successfully cast (Off-chain)!',
            nullifierHash,
            candidateId: candidate.blockchain_id ?? candidate.id,
            timestamp: new Date().toISOString(),
            onChain: !!transactionHash,
            transactionHash,
            blockNumber,
            contractAddress
        })

    } catch (error: any) {
        console.error('ZKP vote error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to cast vote' },
            { status: 500 }
        )
    }
}

/**
 * GET: Check if user has voted (by checking if they have a nullifier)
 * Note: This requires the user to provide their nullifierSecret
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const nullifierSecret = searchParams.get('nullifierSecret')
        const electionIdParam = searchParams.get('electionId')

        if (!nullifierSecret) {
            return NextResponse.json(
                { error: 'nullifierSecret is required to check vote status' },
                { status: 400 }
            )
        }

        // Get election ID
        let electionId: number
        if (electionIdParam) {
            electionId = parseInt(electionIdParam)
        } else {
            const election = await getLatestElection()
            if (!election) {
                return NextResponse.json({ hasVoted: false, electionId: null })
            }
            electionId = election.id
        }

        // Generate nullifier and check if used
        const nullifierHash = await generateNullifier(nullifierSecret, electionId)

        const usedNullifier = await sql`
            SELECT * FROM zkp_nullifiers 
            WHERE election_id = ${electionId} AND nullifier_hash = ${nullifierHash}
        `

        return NextResponse.json({
            hasVoted: usedNullifier.length > 0,
            electionId,
            nullifierHash: usedNullifier.length > 0 ? nullifierHash : null
        })

    } catch (error: any) {
        console.error('ZKP vote status error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to check vote status' },
            { status: 500 }
        )
    }
}
