import { NextResponse } from 'next/server'
import { getAllCandidates } from '@/lib/contract'
import { sql, getLatestElection } from '@/lib/db'

// POST: Sync candidates from blockchain to database (Election-Scoped)
export async function POST() {
    try {
        // Get all candidates from blockchain
        const blockchainCandidates = await getAllCandidates()

        // Get current election ID
        const latestElection = await getLatestElection()
        const electionId = latestElection?.id ?? null

        let synced = 0
        let updated = 0

        for (const candidate of blockchainCandidates) {
            // Check if candidate already exists in DB FOR THIS ELECTION
            let existing
            if (electionId !== null) {
                existing = await sql`
                    SELECT * FROM candidates 
                    WHERE blockchain_id = ${candidate.id} AND election_id = ${electionId}
                `
            } else {
                existing = await sql`
                    SELECT * FROM candidates 
                    WHERE blockchain_id = ${candidate.id} AND election_id IS NULL
                `
            }

            if (existing.length === 0) {
                // Insert candidate with election_id
                await sql`
                    INSERT INTO candidates (blockchain_id, name, party, vote_count, election_id)
                    VALUES (${candidate.id}, ${candidate.name}, ${candidate.party}, ${candidate.voteCount}, ${electionId})
                `
                synced++
            } else {
                // Update vote count
                if (electionId !== null) {
                    await sql`
                        UPDATE candidates 
                        SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                        WHERE blockchain_id = ${candidate.id} AND election_id = ${electionId}
                    `
                } else {
                    await sql`
                        UPDATE candidates 
                        SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                        WHERE blockchain_id = ${candidate.id} AND election_id IS NULL
                    `
                }
                updated++
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${synced} new candidates, updated ${updated} existing`,
            electionId,
            totalOnBlockchain: blockchainCandidates.length,
            synced,
            updated,
        })
    } catch (error: any) {
        console.error('Sync error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}

// GET: Sync candidates from blockchain to database (browser-friendly, Election-Scoped)
export async function GET() {
    try {
        // Get all candidates from blockchain
        const blockchainCandidates = await getAllCandidates()

        // Get current election ID
        const latestElection = await getLatestElection()
        const electionId = latestElection?.id ?? null

        let synced = 0
        let updated = 0

        for (const candidate of blockchainCandidates) {
            // Check if candidate already exists in DB FOR THIS ELECTION
            let existing
            if (electionId !== null) {
                existing = await sql`
                    SELECT * FROM candidates 
                    WHERE blockchain_id = ${candidate.id} AND election_id = ${electionId}
                `
            } else {
                existing = await sql`
                    SELECT * FROM candidates 
                    WHERE blockchain_id = ${candidate.id} AND election_id IS NULL
                `
            }

            if (existing.length === 0) {
                // Insert candidate with election_id
                await sql`
                    INSERT INTO candidates (blockchain_id, name, party, vote_count, election_id)
                    VALUES (${candidate.id}, ${candidate.name}, ${candidate.party}, ${candidate.voteCount}, ${electionId})
                `
                synced++
            } else {
                // Update vote count
                if (electionId !== null) {
                    await sql`
                        UPDATE candidates 
                        SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                        WHERE blockchain_id = ${candidate.id} AND election_id = ${electionId}
                    `
                } else {
                    await sql`
                        UPDATE candidates 
                        SET vote_count = ${candidate.voteCount}, updated_at = CURRENT_TIMESTAMP
                        WHERE blockchain_id = ${candidate.id} AND election_id IS NULL
                    `
                }
                updated++
            }
        }

        // Get DB candidates for the current election
        let dbCandidates
        if (electionId !== null) {
            dbCandidates = await sql`
                SELECT * FROM candidates 
                WHERE election_id = ${electionId}
                ORDER BY blockchain_id ASC
            `
        } else {
            dbCandidates = await sql`
                SELECT * FROM candidates 
                WHERE election_id IS NULL
                ORDER BY blockchain_id ASC
            `
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${synced} new candidates, updated ${updated} existing`,
            electionId,
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
