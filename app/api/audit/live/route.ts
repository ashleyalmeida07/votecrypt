
import { NextResponse } from 'next/server'
import { sql, getLatestElection } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const election = await getLatestElection()

        if (!election) {
            return NextResponse.json({
                active: false,
                message: "No active election"
            })
        }

        const electionId = election.id

        // 1. Get Totals
        const voteStats = await sql`
            SELECT SUM(vote_count) as total_votes 
            FROM candidates 
            WHERE election_id = ${electionId}
        `
        const totalVotes = voteStats.length > 0 ? parseInt(voteStats[0].total_votes || '0') : 0

        // 2. Get Recent Votes (Anonymous Feed)
        // Using zkp_nullifiers table which has created_at
        const recentVotes = await sql`
            SELECT id, nullifier_hash, created_at 
            FROM zkp_nullifiers 
            WHERE election_id = ${electionId}
            ORDER BY id DESC 
            LIMIT 20
        `

        // 3. Get Integrity Data
        const merkleTree = await sql`
            SELECT merkle_root, leaf_count, updated_at 
            FROM zkp_merkle_trees 
            WHERE election_id = ${electionId}
        `

        const merkleRoot = merkleTree.length > 0 ? merkleTree[0].merkle_root : null

        // 4. Get Candidates (aggregated)
        const candidates = await sql`
            SELECT id, name, party, vote_count, blockchain_id 
            FROM candidates 
            WHERE election_id = ${electionId}
            ORDER BY vote_count DESC
        `

        return NextResponse.json({
            active: true,
            election: {
                id: election.id,
                name: election.name,
                state: election.state,
                contractAddress: election.contract_address || process.env.ZKP_CONTRACT_ADDR
            },
            stats: {
                totalVotes,
                totalVoters: merkleTree.length > 0 ? merkleTree[0].leaf_count : 0
            },
            integrity: {
                merkleRoot,
                lastUpdated: merkleTree.length > 0 ? merkleTree[0].updated_at : null
            },
            recentVotes: recentVotes.map(v => ({
                id: v.id,
                hash: v.nullifier_hash,
                timestamp: v.created_at || new Date().toISOString()
            })),
            candidates
        })

    } catch (error: any) {
        console.error("Audit API Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch audit data" },
            { status: 500 }
        )
    }
}
