import { NextResponse } from 'next/server'
import { sql, getLatestElection } from '@/lib/db'
import {
    generateSecret,
    generateCommitment,
    hexToBigInt,
    computeMerkleRoot,
    bigIntToHex
} from '@/lib/zkp'

export const dynamic = 'force-dynamic'

/**
 * POST: Register a new voter for ZKP voting
 * 
 * This generates a commitment for the voter and adds it to the Merkle tree.
 * The voter receives their secret which they must store locally.
 */
export async function POST(request: Request) {
    try {
        const { firebaseUid } = await request.json()

        if (!firebaseUid) {
            return NextResponse.json(
                { error: 'Firebase UID is required' },
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

        const electionId = election.id

        // 2. Check if user already has a commitment for this election
        const existing = await sql`
            SELECT * FROM voter_commitments 
            WHERE election_id = ${electionId} AND firebase_uid = ${firebaseUid}
        `

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Already registered for this election. Use your existing secrets.' },
                { status: 400 }
            )
        }

        // 3. Generate secrets for the voter
        const secret = generateSecret()
        const nullifierSecret = generateSecret()

        // 4. Generate commitment
        const commitment = await generateCommitment(secret, nullifierSecret)

        // 5. Get current Merkle tree state
        let merkleTree = await sql`
            SELECT * FROM zkp_merkle_trees WHERE election_id = ${electionId}
        `

        let merkleIndex: number
        if (merkleTree.length === 0) {
            // Create new Merkle tree entry
            await sql`
                INSERT INTO zkp_merkle_trees (election_id, merkle_root, leaf_count)
                VALUES (${electionId}, NULL, 1)
            `
            merkleIndex = 0
        } else {
            merkleIndex = merkleTree[0].leaf_count
            await sql`
                UPDATE zkp_merkle_trees 
                SET leaf_count = leaf_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE election_id = ${electionId}
            `
        }

        // 6. Store commitment in database
        await sql`
            INSERT INTO voter_commitments (election_id, commitment, merkle_index, firebase_uid)
            VALUES (${electionId}, ${commitment}, ${merkleIndex}, ${firebaseUid})
        `

        // 7. Recompute Merkle root
        const allCommitments = await sql`
            SELECT commitment FROM voter_commitments 
            WHERE election_id = ${electionId}
            ORDER BY merkle_index ASC
        `

        const leaves = allCommitments.map(c => hexToBigInt(c.commitment))
        const newRoot = await computeMerkleRoot(leaves)
        const rootHex = bigIntToHex(newRoot)

        await sql`
            UPDATE zkp_merkle_trees 
            SET merkle_root = ${rootHex}, updated_at = CURRENT_TIMESTAMP
            WHERE election_id = ${electionId}
        `

        // 8. Return secrets to user (they must store these!)
        return NextResponse.json({
            success: true,
            message: 'Registered for ZKP voting. SAVE YOUR SECRETS - you cannot recover them!',
            secrets: {
                secret,
                nullifierSecret,
                commitment,
                merkleIndex
            },
            electionId,
            merkleRoot: rootHex
        })

    } catch (error: any) {
        console.error('ZKP registration error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to register for ZKP voting' },
            { status: 500 }
        )
    }
}

/**
 * GET: Get registration status for a user
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const firebaseUid = searchParams.get('uid')
        const electionIdParam = searchParams.get('electionId')

        if (!firebaseUid) {
            return NextResponse.json(
                { error: 'Firebase UID is required' },
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
                return NextResponse.json({ isRegistered: false, electionId: null })
            }
            electionId = election.id
        }

        // Check if user has commitment
        const existing = await sql`
            SELECT * FROM voter_commitments 
            WHERE election_id = ${electionId} AND firebase_uid = ${firebaseUid}
        `

        // Check if user has voted (nullifier used)
        // Note: We can't check this without the user's nullifier, so we just return registration status

        return NextResponse.json({
            isRegistered: existing.length > 0,
            electionId,
            merkleIndex: existing.length > 0 ? existing[0].merkle_index : null,
            commitment: existing.length > 0 ? existing[0].commitment : null
        })

    } catch (error: any) {
        console.error('ZKP status check error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to check registration status' },
            { status: 500 }
        )
    }
}
