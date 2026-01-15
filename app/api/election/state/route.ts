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
        let updatedElection
        if (action === 'newElection') {
            updatedElection = await updateElectionState(targetState, undefined, newName)
            if (action === 'newElection') {
                // Crucial: Create initial candidates if needed? No, UI does that.
            }
        } else {
            updatedElection = await updateElectionState(targetState)
        }

        // 2. Sync to Blockchain (Best Effort / Background)

        let hash = 'pending_tx'
        let chainErrorMsg = null

        // A. Main Contract Sync
        try {
            if (action === 'newElection') {
                hash = await writeContractWithRetry('startNewElection', [newName || 'New Election'])
            } else {
                const fn = action === 'start' ? 'startElection' : 'endElection'
                hash = await writeContractWithRetry(fn, [])
            }
            console.log(`✅ Blockchain State Sync (${action}):`, hash)
        } catch (chainError: any) {
            console.error(`⚠️ Main Contract sync failed for ${action}:`, chainError.message)
            chainErrorMsg = chainError.message
        }

        // B. ZKP Contract Sync (if enabled)
        if (isZkpEnabled()) {
            try {
                let zkpHash = 'pending_zkp'
                // ALWAYS use the ZKP contract address from env for now
                const zkpContractAddress = process.env.ZKP_CONTRACT_ADDR as `0x${string}`

                if (action === 'newElection') {
                    // Reset ZKP Contract State
                    console.log('🔄 Syncing New Election to ZKP Contract...')

                    zkpHash = await writeZkpContract(
                        'startNewElection',
                        [newName || 'New Election', BigInt(updatedElection.id)],
                        zkpContractAddress
                    )
                    console.log(`✅ ZKP New Election Sycned:`, zkpHash)

                } else {
                    const zkpFn = action === 'start' ? 'startElection' : 'endElection'

                    // If starting, we MUST sync the Merkle root and commitments first
                    if (action === 'start') {
                        console.log('🔄 Syncing ZKP Merkle Tree before starting...')

                        // 1. Get Merkle Root
                        try {
                            const tree = await sql`SELECT merkle_root FROM zkp_merkle_trees ORDER BY id DESC LIMIT 1`
                            if (tree.length > 0 && tree[0].merkle_root) {
                                const root = tree[0].merkle_root as string
                                console.log('Syncing Root:', root)
                                await writeZkpContract('updateMerkleRoot', [root as `0x${string}`], zkpContractAddress)
                            }
                        } catch (e: any) { console.error('Merkle Sync Error:', e.message) }

                        // 2. Get Commitments
                        try {
                            const commitments = await sql`SELECT commitment FROM voter_commitments ORDER BY merkle_index ASC`
                            if (commitments.length > 0) {
                                console.log(`Syncing ${commitments.length} commitments...`)
                                for (const c of commitments) {
                                    try {
                                        await writeZkpContract('addVoterCommitment', [c.commitment as `0x${string}`], zkpContractAddress)
                                    } catch (e) {
                                        // Ignore "already exists"
                                    }
                                }
                            }
                        } catch (e: any) { console.error('Commitment Sync Error:', e.message) }

                        // 3. Sync Candidates to ZKP Contract
                        console.log('🔄 Syncing Candidates to ZKP Contract...')
                        try {
                            const { publicClient } = await import('@/lib/contract')
                            // IMPORT ABI DIRECTLY to ensure we have it even if config isn't perfectly loaded yet
                            // Assuming zkp-abi.json is in Soliity folder as per structure
                            const zkpAbi = (await import('@/Solidity/zkp-abi.json')).default

                            // Get DB Candidates
                            const dbCandidates = await sql`
                                SELECT * FROM candidates 
                                WHERE election_id = ${updatedElection?.id} 
                                ORDER BY blockchain_id ASC
                            `

                            if (dbCandidates.length > 0 && zkpContractAddress) {
                                const count = await publicClient.readContract({
                                    address: zkpContractAddress,
                                    abi: zkpAbi,
                                    functionName: 'getCandidateCount',
                                }) as bigint

                                const currentZkpCount = Number(count)
                                console.log(`ZKP Candidate Count: ${currentZkpCount}, DB Count: ${dbCandidates.length}`)

                                if (currentZkpCount < dbCandidates.length) {
                                    // Sync missing
                                    for (let i = currentZkpCount; i < dbCandidates.length; i++) {
                                        const cand = dbCandidates[i]
                                        console.log(`Syncing Candidate #${i}: ${cand.name}`)
                                        const anonymizedName = `Candidate ${cand.blockchain_id}`
                                        const anonymizedParty = `Party ${String.fromCharCode(65 + (cand.blockchain_id % 26))}`

                                        await writeZkpContract('addCandidate', [anonymizedName, anonymizedParty], zkpContractAddress)
                                    }
                                } else {
                                    console.log('✅ ZKP Candidates are up to date.')
                                }
                            } else {
                                console.log(`⚠️ Skipping ZKP Candidate Sync: Address=${zkpContractAddress}, DBCount=${dbCandidates.length}`)
                            }
                        } catch (candSyncError: any) {
                            console.error('❌ ZKP Candidate Sync Error:', candSyncError.message || candSyncError)
                        }
                    }

                    zkpHash = await writeZkpContract(zkpFn, [], zkpContractAddress)
                    console.log(`✅ ZKP Contract State Sync (${action}):`, zkpHash)
                }
            } catch (zkpError: any) {
                console.error(`⚠️ ZKP Contract sync failed for ${action}:`, zkpError.message)
                // Don't fail the whole request, just log
            }
        }

        if (chainErrorMsg) {
            return NextResponse.json({
                success: true,
                warning: "DB Updated, but Main Contract Sync Failed (ZKP Attempted): " + chainErrorMsg,
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
