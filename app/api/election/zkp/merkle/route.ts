import { NextResponse } from 'next/server'
import { sql, getLatestElection } from '@/lib/db'
import {
    generateMerkleProof,
    computeMerkleRoot,
    hexToBigInt,
    bigIntToHex
} from '@/lib/zkp'

export const dynamic = 'force-dynamic'

/**
 * GET: Get Merkle tree info and proof for a voter
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const commitment = searchParams.get('commitment')
        const electionIdParam = searchParams.get('electionId')

        // Get election ID
        let electionId: number
        if (electionIdParam) {
            electionId = parseInt(electionIdParam)
        } else {
            const election = await getLatestElection()
            if (!election) {
                return NextResponse.json(
                    { error: 'No active election found' },
                    { status: 404 }
                )
            }
            electionId = election.id
        }

        // Get Merkle tree state
        const treeState = await sql`
            SELECT * FROM zkp_merkle_trees WHERE election_id = ${electionId}
        `

        if (treeState.length === 0) {
            return NextResponse.json({
                electionId,
                merkleRoot: null,
                leafCount: 0,
                commitments: []
            })
        }

        // Get all commitments
        const allCommitments = await sql`
            SELECT commitment, merkle_index FROM voter_commitments 
            WHERE election_id = ${electionId}
            ORDER BY merkle_index ASC
        `

        const result: any = {
            electionId,
            merkleRoot: treeState[0].merkle_root,
            leafCount: treeState[0].leaf_count,
            commitmentCount: allCommitments.length
        }

        // If commitment provided, generate Merkle proof
        if (commitment) {
            const voterCommitment = await sql`
                SELECT * FROM voter_commitments 
                WHERE election_id = ${electionId} AND commitment = ${commitment}
            `

            if (voterCommitment.length === 0) {
                return NextResponse.json(
                    { error: 'Commitment not found in Merkle tree' },
                    { status: 404 }
                )
            }

            const leafIndex = voterCommitment[0].merkle_index
            const leaves = allCommitments.map(c => hexToBigInt(c.commitment))

            const merkleProof = await generateMerkleProof(leaves, leafIndex)
            const merkleRoot = await computeMerkleRoot(leaves)

            result.proof = {
                leafIndex,
                siblings: merkleProof.siblings.map(s => bigIntToHex(s)),
                pathIndices: merkleProof.pathIndices,
                root: bigIntToHex(merkleRoot)
            }
        }

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Merkle tree error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to get Merkle tree info' },
            { status: 500 }
        )
    }
}
