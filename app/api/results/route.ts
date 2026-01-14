import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Fetch candidates sorted by vote count (descending)
        const candidates = await sql`
            SELECT * FROM candidates 
            ORDER BY vote_count DESC
        `

        // Fetch election metadata (state, dates)
        const election = await sql`
            SELECT * FROM elections 
            ORDER BY id DESC 
            LIMIT 1
        `

        // Calculate total votes
        const totalVotes = candidates.reduce((sum, c) => sum + (c.vote_count || 0), 0)

        // Calculate percentages
        const results = candidates.map(c => ({
            ...c,
            vote_count: c.vote_count || 0,
            percentage: totalVotes > 0
                ? ((c.vote_count || 0) / totalVotes * 100).toFixed(1)
                : "0.0"
        }))

        return NextResponse.json({
            success: true,
            totalVotes,
            results,
            election: election.length > 0 ? election[0] : null,
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
