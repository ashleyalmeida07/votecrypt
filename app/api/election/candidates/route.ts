import { NextResponse } from 'next/server'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getAllCandidates,
    getElectionState,
} from '@/lib/contract'

// GET: Get all candidates
export async function GET() {
    try {
        const candidates = await getAllCandidates()
        const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0)

        return NextResponse.json({
            candidates,
            totalVotes,
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

// POST: Add a new candidate (only works in Created state)
export async function POST(request: Request) {
    try {
        const { name, party } = await request.json()

        if (!name || !party) {
            return NextResponse.json(
                { error: 'Name and party are required' },
                { status: 400 }
            )
        }

        // Check election state
        const state = await getElectionState()
        if (state !== 0) {
            return NextResponse.json(
                { error: 'Can only add candidates before election starts (state must be Created)' },
                { status: 400 }
            )
        }

        const walletClient = getWalletClient()

        const hash = await walletClient.writeContract({
            ...contractConfig,
            functionName: 'addCandidate',
            args: [name, party],
        })

        // Try to wait for confirmation with extended timeout
        let receipt = null
        let candidates = null

        try {
            receipt = await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 300_000, // 5 minutes
            })
            candidates = await getAllCandidates()
        } catch (waitError: any) {
            console.log('Transaction submitted, confirmation pending:', hash)
            return NextResponse.json({
                success: true,
                pending: true,
                transactionHash: hash,
                message: 'Candidate addition submitted! Confirmation pending.',
            })
        }

        return NextResponse.json({
            success: true,
            transactionHash: hash,
            blockNumber: receipt ? Number(receipt.blockNumber) : null,
            candidates,
        })
    } catch (error: any) {
        console.error('Error adding candidate:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to add candidate' },
            { status: 500 }
        )
    }
}
