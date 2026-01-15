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

        // 4. Get all commitments to verify Merkle proof
        const allCommitmentsResult = await sql`
            SELECT commitment FROM voter_commitments 
            WHERE election_id = ${electionId}
            ORDER BY merkle_index ASC
        `

        if (allCommitmentsResult.length === 0) {
            return NextResponse.json(
                { error: 'No voters registered for this election' },
                { status: 400 }
            )
        }

        const leaves = allCommitmentsResult.map(c => hexToBigInt(c.commitment))

        // 5. Compute voter's commitment from secrets
        const { generateCommitment } = await import('@/lib/zkp')
        const voterCommitment = await generateCommitment(secret, nullifierSecret)
        const voterCommitmentBigInt = hexToBigInt(voterCommitment)

        // 6. Find voter in Merkle tree
        const leafIndex = leaves.findIndex(leaf => leaf === voterCommitmentBigInt)
        if (leafIndex === -1) {
            return NextResponse.json(
                { error: 'Your commitment is not in the voter registry. Please register first.' },
                { status: 403 }
            )
        }

        // 7. Generate and verify Merkle proof
        const { computeMerkleRoot } = await import('@/lib/zkp')
        const merkleRoot = await computeMerkleRoot(leaves)
        const merkleProof = await generateMerkleProof(leaves, leafIndex)

        const isValidProof = await verifyMerkleProof(
            voterCommitmentBigInt,
            merkleRoot,
            merkleProof.siblings,
            merkleProof.pathIndices
        )

        if (!isValidProof) {
            return NextResponse.json(
                { error: 'Merkle proof verification failed' },
                { status: 403 }
            )
        }

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

        // 11. Log anonymous vote (no identity revealed!)
        console.log(`🗳️ Anonymous ZKP vote cast: Nullifier ${nullifierHash.slice(0, 18)}...`)

        return NextResponse.json({
            success: true,
            message: 'Anonymous vote successfully cast!',
            nullifierHash,
            candidateId: candidate.blockchain_id ?? candidate.id,
            timestamp: new Date().toISOString(),
            // Note: No transaction hash since this is DB-only
            // For on-chain ZKP, we'd submit to ZKBallotSystem
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
