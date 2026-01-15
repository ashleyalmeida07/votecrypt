import { NextResponse } from 'next/server'
import { sql, getLatestElection } from '@/lib/db'
import {
    generateSecret,
    generateCommitment,
    hexToBigInt,
    computeMerkleRoot,
    bigIntToHex
} from '@/lib/zkp'
import { isZkpEnabled, writeZkpContract } from '@/lib/contract'

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

        // 3. Generate secrets for the voter
        const secret = generateSecret()
        const nullifierSecret = generateSecret()

        // 4. Generate commitment
        const commitment = await generateCommitment(secret, nullifierSecret)

        let merkleIndex: number

        if (existing.length > 0) {
            // ALREADY REGISTERED: Allow overwrite/recovery
            // Note: In a strict anonymous system, this might allow double-voting if not carefully managed.
            // (User votes with old secret, re-registers, votes with new secret).
            // For this implementation, we prioritize recovery.
            console.log(`♻️ User ${firebaseUid} re-registering (overwriting commitment)`)

            merkleIndex = existing[0].merkle_index

            await sql`
                UPDATE voter_commitments 
                SET commitment = ${commitment}, updated_at = CURRENT_TIMESTAMP
                WHERE election_id = ${electionId} AND firebase_uid = ${firebaseUid}
            `
        } else {
            // NEW REGISTRATION
            console.log(`✨ New registration for ${firebaseUid}`)

            // 5. Get current Merkle tree state
            let merkleTree = await sql`
                SELECT * FROM zkp_merkle_trees WHERE election_id = ${electionId}
            `

            if (merkleTree.length === 0) {
                // Create new Merkle tree entry
                try {
                    await sql`
                        INSERT INTO zkp_merkle_trees (election_id, merkle_root, leaf_count)
                        VALUES (${electionId}, NULL, 1)
                    `
                    merkleIndex = 0
                } catch (e: any) {
                    // Handle Race Condition: If duplicate key error, it means another req created it just now.
                    // Just fetch it again and use it as normal update path.
                    if (e.code === '23505') { // Unique constraint violation code
                        const refreshed = await sql`SELECT * FROM zkp_merkle_trees WHERE election_id = ${electionId}`
                        merkleIndex = refreshed[0].leaf_count
                        await sql`
                            UPDATE zkp_merkle_trees 
                            SET leaf_count = leaf_count + 1, updated_at = CURRENT_TIMESTAMP
                            WHERE election_id = ${electionId}
                        `
                    } else {
                        throw e
                    }
                }
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
        }

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

        // Sync commitment to on-chain ZKP contract
        // This is CRITICAL: Without this, the contract merkle root will match, 
        // but the contract won't have the commitments to rebuild it if needed,
        // (though technically only root matters for verification, some implementations verify inclusion).
        // Actually, for this contract, we used:
        // function addVoterCommitment(bytes32 _commitment)
        // This is needed so valid voters are on-chain.

        // function addVoterCommitment(bytes32 _commitment)
        // This is needed so valid voters are on-chain.

        if (isZkpEnabled()) {
            try {
                console.log(`🔗 Adding voter commitment to ZKP contract...`)
                await writeZkpContract('addVoterCommitment', [commitment as `0x${string}`])
                console.log('✅ Voter commitment added on-chain')
            } catch (chainError: any) {
                console.error('⚠️ Failed to add commitment on-chain:', chainError.message)
            }
        }

        // 9. Sync Merkle Root to Blockchain immediately

        if (isZkpEnabled()) {
            try {
                console.log(`🔗 Syncing new Merkle Root to chain: ${rootHex}`)
                // We don't wait strictly for this to finish to return the response to user (speed),
                // BUT for immediate voting they need it. 
                // It's safer to await it, or the user might vote before it lands. 
                // Since block time is 12s, user has to wait anyway.
                await writeZkpContract('updateMerkleRoot', [rootHex as `0x${string}`])
            } catch (chainError: any) {
                console.error('⚠️ Failed to sync Merkle Root to chain:', chainError.message)
                // We don't fail the registration, but warn.
                // Ideally we should alert the user or retry.
            }
        }

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
