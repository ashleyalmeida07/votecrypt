import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Fetch election metadata first to get election_id
        const election = await sql`
            SELECT * FROM elections 
            ORDER BY id DESC 
            LIMIT 1
        `

        const electionId = election.length > 0 ? election[0].id : null

        // Fetch candidates for this election, sorted by vote count (descending)
        let candidates
        if (electionId) {
            candidates = await sql`
                SELECT * FROM candidates 
                WHERE election_id = ${electionId}
                ORDER BY vote_count DESC
            `
        } else {
            candidates = await sql`
                SELECT * FROM candidates 
                ORDER BY vote_count DESC
            `
        }

        // Calculate total votes
        const totalVotes = candidates.reduce((sum, c) => sum + (c.vote_count || 0), 0)

        // Calculate percentages - explicitly type to include all candidate fields
        const results = candidates.map((c: any) => ({
            ...c,
            vote_count: c.vote_count || 0,
            percentage: totalVotes > 0
                ? ((c.vote_count || 0) / totalVotes * 100).toFixed(1)
                : "0.0"
        }))

        // Determine winner(s) if election is ended
        let winner = null
        if (election.length > 0 && election[0].state === 'Ended' && results.length > 0) {
            const topVoteCount = results[0].vote_count

            // Check for ties (multiple candidates with the same top vote count)
            const winners = results.filter(c => c.vote_count === topVoteCount)

            if (winners.length === 1) {
                winner = {
                    name: winners[0].name,
                    party: winners[0].party,
                    votes: topVoteCount,
                    percentage: winners[0].percentage,
                    isTie: false
                }
            } else if (winners.length > 1) {
                // It's a tie
                winner = {
                    names: winners.map(w => w.name),
                    parties: winners.map(w => w.party),
                    votes: topVoteCount,
                    percentage: winners[0].percentage,
                    isTie: true,
                    tiedCandidates: winners.length
                }
            }
        }

        // Include contract address (from env or DB)
        const contractAddress = process.env.ZKP_CONTRACT_ADDR || '0x50F56175CAE2Dff674A2dAFfE83c01EAfFB085C3' || election[0]?.contract_address || null

        return NextResponse.json({
            success: true,
            totalVotes,
            results,
            winner,
            isEnded: election.length > 0 && election[0].state === 'Ended',
            election: election.length > 0 ? { ...election[0], contract_address: contractAddress } : null,
            contractAddress,
            lastUpdated: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Error fetching results:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch results' },
            { status: 500 }
        )
    }
}
