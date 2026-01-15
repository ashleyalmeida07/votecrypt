import { NextResponse } from 'next/server'
import {
    getElectionName,
    ElectionState,
    getChainInfo,
} from '@/lib/contract'
import { sql, getCandidatesFromDb } from '@/lib/db'

// GET: Get election dashboard stats (DB Optimized)
export async function GET() {
    try {
        // 1. Fetch Election State from DB
        const electionReq = await sql`SELECT * FROM elections ORDER BY id DESC LIMIT 1`
        let state = 0
        let stateName = 'Created'
        let electionName = 'MPL Election'

        if (electionReq.length > 0) {
            stateName = electionReq[0].state
            electionName = electionReq[0].name
            if (stateName === 'Voting') state = 1
            if (stateName === 'Ended') state = 2
        }

        // 2. Fetch Candidates from DB
        const electionId = electionReq.length > 0 ? electionReq[0].id : undefined
        const candidates = await getCandidatesFromDb(electionId)
        const totalVotes = candidates.reduce((sum, c) => sum + (c.vote_count || 0), 0)

        // 3. Fallback / Static data for Official (since it's an env var usually)
        // We could fetch it from chain, but that slows us down.
        // Let's assume it's the admin or fetch once.
        // For optimisim, we CAN fetch from chain parallel but don't block state on it.
        const chainInfo = getChainInfo()

        // Convert candidates to expected format (vote_count -> voteCount)
        const formattedCandidates = candidates.map(c => ({
            id: c.id,
            blockchainId: c.blockchain_id,
            name: c.name,
            party: c.party,
            voteCount: c.vote_count || 0
        }))

        return NextResponse.json({
            electionId,  // Added for ZKP registration
            electionName,
            electionOfficial: process.env.ADMIN_ADDRESS || '0x...', // Optimistic or Env
            state,
            stateName,
            candidateCount: candidates.length,
            totalVotes,
            candidates: formattedCandidates,
            contractAddress: process.env.CONTRACT_ADDR,
            chain: chainInfo.name,
            chainId: chainInfo.id,
            blockExplorer: chainInfo.blockExplorer,
        })
    } catch (error) {
        console.error('Error fetching election stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch election stats' },
            { status: 500 }
        )
    }
}
