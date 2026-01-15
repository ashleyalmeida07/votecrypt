import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { updateElectionState, sql } from '@/lib/db'
import {
    writeContractWithRetry,
    getElectionState,
    getElectionOfficial,
    ElectionState,
    getWalletClient, // Needed for simple wallet checks
} from '@/lib/contract'

export async function GET() {
    try {
        // Read from DB for speed
        // If DB doesn't have it, fallback to default 'Created'
        const existing = await sql`SELECT * FROM elections ORDER BY id DESC LIMIT 1`
        let state = 0
        let stateName = 'Created'

        if (existing.length > 0) {
            stateName = existing[0].state
            // Map string state to enum number roughly
            if (stateName === 'Voting') state = 1
            if (stateName === 'Ended') state = 2
        } else {
            // Fallback to checking blockchain if DB empty? 
            // Or just return 0. 
        }

        return NextResponse.json({
            state,
            stateName,
        })
    } catch (error) {
        console.error('Error fetching election state:', error)
        return NextResponse.json(
            { error: 'Failed to fetch election state' },
            { status: 500 }
        )
    }
}

// POST: Change election state
export async function POST(request: Request) {
    try {
        const { action, newName } = await request.json()

        if (!['start', 'end', 'newElection'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        console.log(`Processing action: ${action} (DB Priority)`)

        // 1. Update DB State Immediately
        let targetState = 'Created'
        if (action === 'start') targetState = 'Voting'
        if (action === 'end') targetState = 'Ended'
        if (action === 'newElection') targetState = 'Created'

        // Log to DB - pass the newName when creating a new election
        if (action === 'newElection') {
            await updateElectionState(targetState, undefined, newName)
        } else {
            await updateElectionState(targetState)
        }

        // 2. Sync to Blockchain (Best Effort / Background)
        // We still need to sync because VOTING requires the contract to be in Voting state.

        let hash = 'pending_tx'
        try {
            if (action === 'newElection') {
                hash = await writeContractWithRetry('startNewElection', [newName || 'New Election'])
            } else {
                const fn = action === 'start' ? 'startElection' : 'endElection'
                hash = await writeContractWithRetry(fn, [])
            }
            console.log(`✅ Blockchain State Sync (${action}):`, hash)
        } catch (chainError: any) {
            console.error(`⚠️ Blockchain sync failed for ${action}:`, chainError.message)
            // We continue because user wants "Store all this in DB only".
            // But valid voting requires chain state.
            // We return a warning in the JSON.
            return NextResponse.json({
                success: true,
                warning: "DB Updated, but Blockchain Sync Failed: " + chainError.message,
                message: `Election state set to ${targetState} (DB Only)`
            })
        }

        return NextResponse.json({
            success: true,
            pending: true,
            transactionHash: hash,
            message: `Election state updated to ${targetState}`
        })

    } catch (error: any) {
        console.error('Error changing election state:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to change state' },
            { status: 500 }
        )
    }
}
