import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getElectionState,
    getElectionOfficial,
    ElectionState,
    writeZkpContract,
    isZkpEnabled,
} from '@/lib/contract'

// GET: Get all candidates from DB (Fast, Single Source of Truth for Metadata)
import { getCandidatesFromDb, addCandidateToDb, logTransaction, getLatestElection } from '@/lib/db'
import { writeContractWithRetry, getCandidateCount } from '@/lib/contract'

export async function GET() {
    try {
        const candidates = await getCandidatesFromDb()

        // Return DB candidates directly
        // Note: Vote counts might be slightly stale compared to live blockchain, 
        // but for "DB Only" feel, this is correct. 
        // We rely on the /api/results/sync endpoint to update the counts.

        return NextResponse.json({
            candidates,
            count: candidates.length,
        })
    } catch (error) {
        console.error('Error fetching candidates:', error)
        return NextResponse.json(
            { error: 'Failed to fetch candidates' },
            { status: 500 }
        )
    }
}

// POST: Add a new candidate
export async function POST(request: Request) {
    try {
        const { name, party } = await request.json()

        if (!name || !party) {
            return NextResponse.json({ error: 'Name and party are required' }, { status: 400 })
        }

        // 1. Get Active Election & On-Chain Count
        const latestElection = await getLatestElection()

        // Validation: Can only add candidates if election is in "Created" state (or open)
        // If no election exists, we assume we are setting up the first one.
        if (latestElection && latestElection.state === 'Ended') {
            return NextResponse.json({ error: 'Cannot add candidates to an ended election. Start a new one.' }, { status: 400 })
        }

        const onChainCount = await getCandidateCount()
        const nextBlockchainId = Number(onChainCount)

        console.log(`Adding candidate "${name}" to Election #${latestElection?.id || 'New'}. Next Chain ID: ${nextBlockchainId}`)

        // 2. Submit to Blockchain (Anonymized)
        // Use global incrementing ID to stay in sync with contract array
        const anonymizedName = `Candidate ${nextBlockchainId}`
        const anonymizedParty = `Party ${String.fromCharCode(65 + (nextBlockchainId % 26))}`

        console.log(`🔗 Submitting anonymized candidate to chain: ${anonymizedName}`)

        let hash = 'pending_tx'
        let mainContractError = null

        try {
            hash = await writeContractWithRetry('addCandidate', [anonymizedName, anonymizedParty])
            console.log('✅ Blockchain Tx Sent:', hash)
        } catch (chainError: any) {
            console.error('❌ Main Contract submission failed:', chainError.message)
            mainContractError = chainError.message
            // We continue to ZKP sync instead of returning error immediately
        }

        // 2b. Sync to ZKP Contract if enabled
        let zkpHash = null
        if (isZkpEnabled()) {
            try {
                console.log('🔗 Syncing candidate to ZKP contract...')
                zkpHash = await writeZkpContract('addCandidate', [anonymizedName, anonymizedParty])
                console.log('✅ ZKP candidate sync complete:', zkpHash)
            } catch (zkpError: any) {
                console.error('⚠️ ZKP candidate sync failed:', zkpError.message)
                // If BOTH failed, then we have a problem
                if (mainContractError) {
                    return NextResponse.json({
                        error: `Blockchain rejection (Main: ${mainContractError}, ZKP: ${zkpError.message})`
                    }, { status: 500 })
                }
            }
        }

        // 3. Save to DB with Election Scope
        const newCandidate = await addCandidateToDb(
            name,
            party,
            zkpHash || hash, // Prefer ZKP hash if available and main failed, or just keep original logic
            nextBlockchainId,
            latestElection?.id
        )

        await logTransaction('addCandidate', zkpHash || hash, { name, party, anonymizedName, electionId: latestElection?.id })

        return NextResponse.json({
            success: true,
            candidate: newCandidate,
            transactionHash: zkpHash || hash,
            message: `Candidate "${name}" added!`,
            warning: mainContractError ? `Main Contract Sync Failed: ${mainContractError}` : undefined,
            zkpSynced: !!zkpHash
        })

    } catch (error: any) {
        console.error('Error adding candidate:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to add candidate' },
            { status: 500 }
        )
    }
}
