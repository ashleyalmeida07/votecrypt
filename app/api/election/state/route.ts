import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { updateElectionState, sql } from '@/lib/db'
import {
    writeContractWithRetry,
    writeZkpContract,
    isZkpEnabled,
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

            // 3. Sync to ZKP Contract (if enabled)
            if (isZkpEnabled()) {
                try {
                    let zkpHash = 'pending_zkp'
                    if (action === 'newElection') {
                        // ZKP contract likely needs deployment per election or uses startNewElection too? 
                        // The current ZKBallotSystem doesn't seem to have startNewElection in the snippet I saw, 
                        // it uses Constructor for new election? Or maybe it's a singleton?
                        // Let's assume for now it has similar state functions, or we skip 'newElection' if it's per-deployment.
                        // Checking ZKBallotSystem.sol... it has startElection/endElection.
                        // It does NOT have startNewElection used in BallotSystem.sol.
                        // It effectively supports one election per deployment based on constructor? 
                        // Or maybe we treat it as "reset" if we deploy new?
                        // For 'start' and 'end', it matches.
                        console.log('Skipping ZKP sync for newElection - requires redeployment or separate handling')
                    } else {
                        const zkpFn = action === 'start' ? 'startElection' : 'endElection'

                        // If starting, we MUST sync the Merkle root and commitments first
                        if (action === 'start') {
                            console.log('🔄 Syncing ZKP Merkle Tree before starting...')

                            // 1. Get Merkle Root
                            const tree = await sql`SELECT merkle_root FROM zkp_merkle_trees ORDER BY id DESC LIMIT 1`
                            if (tree.length > 0 && tree[0].merkle_root) {
                                const root = tree[0].merkle_root as string
                                console.log('Syncing Root:', root)
                                const rootHash = await writeZkpContract('updateMerkleRoot', [root as `0x${string}`])
                                console.log('✅ Root synced:', rootHash)
                            }

                            // 2. Get Commitments (Sync all to be safe, or just ensure > 0)
                            const commitments = await sql`SELECT commitment FROM voter_commitments ORDER BY merkle_index ASC`
                            if (commitments.length > 0) {
                                console.log(`Syncing ${commitments.length} commitments...`)
                                // For now, simple loop. In prod, batch or check existing.
                                // We just need count > 0 for startElection, but let's try to sync.
                                // To save time/gas on re-runs, maybe only sync if we suspect they are missing?
                                // Since we catch errors, let's just try adding the first one if we can't check count easily.
                                // Better: Sync ALL for correctness.
                                for (const c of commitments) {
                                    try {
                                        await writeZkpContract('addVoterCommitment', [c.commitment as `0x${string}`])
                                    } catch (e) {
                                        // Ignore "already exists" or other errors to keep moving
                                        console.log('Commitment sync note:', (e as any).shortMessage || 'Failed/Skipped')
                                    }
                                }
                            }
                        }

                        zkpHash = await writeZkpContract(zkpFn, [])
                        console.log(`✅ ZKP Contract State Sync (${action}):`, zkpHash)
                    }
                } catch (zkpError: any) {
                    console.error(`⚠️ ZKP Contract sync failed for ${action}:`, zkpError.message)
                    // Don't fail the whole request, just log
                }
            }
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
