import { NextResponse } from 'next/server'
import { getAllCandidates } from '@/lib/contract'
import { sql } from '@/lib/db'

// POST: Sync candidates from blockchain to database
export async function POST() {
    try {
        // Get all candidates from blockchain
        const blockchainCandidates = await getAllCandidates()

        let synced = 0
        let skipped = 0

        for (const candidate of blockchainCandidates) {
            // Check if candidate already exists in DB
            const existing = await sql`
                SELECT * FROM candidates WHERE blockchain_id = ${candidate.id}
            `

            if (existing.length === 0) {
                // Insert candidate
                await sql`
                    INSERT INTO candidates (blockchain_id, name, party, vote_count)
                    VALUES (${candidate.id}, ${candidate.name}, ${candidate.party}, ${candidate.voteCount})
                `
                synced++
            } else {
                // Update vote count
                await sql`
                    UPDATE candidates 
                    SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                    WHERE blockchain_id = ${candidate.id}
                `
                skipped++
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${synced} new candidates, updated ${skipped} existing`,
            totalOnBlockchain: blockchainCandidates.length,
            synced,
            updated: skipped,
        })
    } catch (error: any) {
        console.error('Sync error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}

// GET: Sync candidates from blockchain to database (browser-friendly)
export async function GET() {
    try {
        // Get all candidates from blockchain
        const blockchainCandidates = await getAllCandidates()

        let synced = 0
        let updated = 0

        for (const candidate of blockchainCandidates) {
            // Check if candidate already exists in DB
            const existing = await sql`
                SELECT * FROM candidates WHERE blockchain_id = ${candidate.id}
            `

            if (existing.length === 0) {
                // Insert candidate
                await sql`
                    INSERT INTO candidates (blockchain_id, name, party, vote_count)
                    VALUES (${candidate.id}, ${candidate.name}, ${candidate.party}, ${candidate.voteCount})
                `
                synced++
            } else {
                // Update vote count
                await sql`
                    UPDATE candidates 
                    SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                    WHERE blockchain_id = ${candidate.id}
                `
                updated++
            }
        }

        // Get DB candidates for comparison
        const dbCandidates = await sql`SELECT * FROM candidates ORDER BY blockchain_id ASC`

        return NextResponse.json({
            success: true,
            message: `Synced ${synced} new candidates, updated ${updated} existing`,
            blockchain: {
                count: blockchainCandidates.length,
                candidates: blockchainCandidates,
            },
            database: {
                count: dbCandidates.length,
                candidates: dbCandidates,
            },
        })
    } catch (error: any) {
        console.error('Sync error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
