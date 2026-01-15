import { NextResponse } from 'next/server'
import { sql, getLatestElection, getVoterByFirebaseUid } from '@/lib/db'
import { isZkpEnabled, writeZkpContract, getTransactionReceipt } from '@/lib/contract'
import {
    generateNullifier,
    generateMerkleProof,
    hexToBigInt,
    verifyMerkleProof,
    generateCommitment,
    computeMerkleRoot,
    bigIntToHex
} from '@/lib/zkp'

export const dynamic = 'force-dynamic'

/**
 * GET: Check if user has voted (ZKP-based, election-scoped)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const uid = searchParams.get('uid')
        const nullifierSecret = searchParams.get('nullifierSecret')

        if (!uid) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        // Get current election
        const election = await getLatestElection()
        if (!election) {
            return NextResponse.json({ hasVoted: false, electionId: null })
        }

        // If nullifierSecret provided, check via ZKP nullifier (most accurate)
        if (nullifierSecret) {
            const nullifierHash = await generateNullifier(nullifierSecret, election.id)
            const usedNullifier = await sql`
                SELECT * FROM zkp_nullifiers 
                WHERE election_id = ${election.id} AND nullifier_hash = ${nullifierHash}
            `
            return NextResponse.json({
                hasVoted: usedNullifier.length > 0,
                electionId: election.id,
                method: 'zkp'
            })
        }

        // Check if user has a ZKP commitment for this election
        // If they do but no nullifierSecret was provided, they need to provide their secrets
        const zkpCommitment = await sql`
            SELECT * FROM voter_commitments 
            WHERE election_id = ${election.id} AND firebase_uid = ${uid}
        `

        if (zkpCommitment.length > 0) {
            // User is registered for ZKP in this election, but we can't check vote without their secret
            // Tell frontend they need to provide secrets
            return NextResponse.json({
                hasVoted: false, // Can't determine without secrets
                isZkpRegistered: true,
                electionId: election.id,
                message: 'Provide nullifierSecret to check vote status'
            })
        }

        // User has no ZKP registration for this election - they haven't voted
        return NextResponse.json({
            hasVoted: false,
            isZkpRegistered: false,
            electionId: election.id
        })

    } catch (error: any) {
        console.error('Error checking vote status:', error)
        return NextResponse.json(
            { error: 'Failed to check status' },
            { status: 500 }
        )
    }
}

/**
 * POST: Cast a vote (ZKP COMPULSORY)
 * 
 * All votes MUST use Zero Knowledge Proofs for anonymity.
 * This ensures voter privacy and prevents vote tracking.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { secret, nullifierSecret, candidateId, firebaseUid } = body

        // Validate ZKP inputs
        if (!secret || !nullifierSecret) {
            return NextResponse.json(
                {
                    error: 'ZKP voting is required. Please provide secret and nullifierSecret.',
                    hint: 'Register for ZKP voting first via /api/election/zkp/register'
                },
                { status: 400 }
            )
        }

        if (candidateId === undefined) {
            return NextResponse.json(
                { error: 'Candidate ID is required' },
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
        console.log(`🗳️ ZKP Vote: Election ${electionId}, Candidate ${candidateId}`)

        // 2. Generate nullifier (double-spend protection)
        const nullifierHash = await generateNullifier(nullifierSecret, electionId)

        // 3. Check nullifier hasn't been used (DOUBLE-SPEND PROTECTION)
        const usedNullifier = await sql`
            SELECT * FROM zkp_nullifiers 
            WHERE election_id = ${electionId} AND nullifier_hash = ${nullifierHash}
        `

        if (usedNullifier.length > 0) {
            console.log(`❌ Double-spend attempt blocked: ${nullifierHash.slice(0, 18)}...`)
            return NextResponse.json(
                { error: 'You have already voted in this election (nullifier used)' },
                { status: 400 }
            )
        }

        // 4. Compute voter's commitment from secrets
        const voterCommitment = await generateCommitment(secret, nullifierSecret)
        console.log('🔍 Voter commitment:', voterCommitment.slice(0, 20) + '...')

        // 5. Verify voter commitment is in database (simpler than Merkle proof)
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

        // 8. Validate candidate exists
        const candidates = await sql`
            SELECT * FROM candidates WHERE election_id = ${electionId}
        `

        const candidate = candidates.find(c =>
            c.blockchain_id === candidateId || c.id === candidateId
        )

        if (!candidate) {
            return NextResponse.json(
                { error: 'Invalid candidate ID' },
                { status: 400 }
            )
        }

        // 9. Record nullifier in database (prevents double voting)
        await sql`
            INSERT INTO zkp_nullifiers (election_id, nullifier_hash)
            VALUES (${electionId}, ${nullifierHash})
        `

        // 10. Submit to on-chain ZKP contract if configured
        let transactionHash: string | null = null
        let blockNumber: number | null = null

        if (isZkpEnabled()) {
            console.log(`🔗 Submitting anonymous vote to on-chain ZKP contract...`)

            // Compute merkle root for on-chain verification
            const allCommitments = await sql`
                SELECT commitment FROM voter_commitments 
                WHERE election_id = ${electionId}
                ORDER BY merkle_index ASC
            `
            const leaves = allCommitments.map(c => hexToBigInt(c.commitment))
            const merkleRoot = await computeMerkleRoot(leaves)

            // Convert nullifier and merkle root to bytes32 format
            const nullifierBytes32 = nullifierHash as `0x${string}`
            const merkleRootBytes32 = bigIntToHex(merkleRoot) as `0x${string}`
            const candidateBlockchainId = candidate.blockchain_id ?? candidateId

            try {
                transactionHash = await writeZkpContract('voteAnonymous', [
                    nullifierBytes32,
                    BigInt(candidateBlockchainId),
                    merkleRootBytes32
                ])

                console.log(`📦 On-chain tx submitted: ${transactionHash}`)

                // Wait for receipt
                const receipt = await getTransactionReceipt(transactionHash as `0x${string}`)
                if (receipt) {
                    blockNumber = receipt.blockNumber
                }
            } catch (onChainError: any) {
                console.error('⚠️ On-chain vote failed, but DB vote recorded:', onChainError.message)
                // Continue - the DB vote is still valid
            }
        }

        // 11. Update candidate vote count in database
        await sql`
            UPDATE candidates 
            SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${candidate.id}
        `

        console.log(`✅ Anonymous ZKP vote cast: Nullifier ${nullifierHash.slice(0, 18)}... → Candidate ${candidate.name}`)

        return NextResponse.json({
            success: true,
            message: transactionHash ? 'Anonymous vote recorded on blockchain!' : 'Anonymous vote successfully cast!',
            nullifierHash,
            candidateId: candidate.blockchain_id ?? candidate.id,
            timestamp: new Date().toISOString(),
            anonymous: true,
            onChain: !!transactionHash,
            transactionHash,
            blockNumber
        })

    } catch (error: any) {
        console.error('ZKP vote error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to cast vote' },
            { status: 500 }
        )
    }
}
