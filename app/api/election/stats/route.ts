import { NextResponse } from 'next/server'
import {
    getElectionState,
    getElectionName,
    getElectionOfficial,
    getAllCandidates,
    ElectionState,
} from '@/lib/contract'

// GET: Get election dashboard stats
export async function GET() {
    try {
        const [state, electionName, electionOfficial, candidates] = await Promise.all([
            getElectionState(),
            getElectionName(),
            getElectionOfficial(),
            getAllCandidates(),
        ])

        const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0)

        return NextResponse.json({
            electionName,
            electionOfficial,
            state,
            stateName: ElectionState[state as keyof typeof ElectionState],
            candidateCount: candidates.length,
            totalVotes,
            candidates,
            contractAddress: process.env.CONTRACT_ADDR,
        })
    } catch (error) {
        console.error('Error fetching election stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch election stats' },
            { status: 500 }
        )
    }
}
