import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getAllCandidates,
    getElectionState,
    getElectionOfficial,
    ElectionState,
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
            return NextResponse.json({
                error: `Can only add candidates before election starts. Current state: "${ElectionState[state as keyof typeof ElectionState]}"`,
            }, { status: 400 })
        }

        // Verify admin wallet
        const adminKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`
        if (!adminKey) {
            return NextResponse.json(
                { error: 'ADMIN_PRIVATE_KEY not configured' },
                { status: 500 }
            )
        }

        const adminAccount = privateKeyToAccount(adminKey)
        const adminAddress = adminAccount.address.toLowerCase()
        const electionOfficial = await getElectionOfficial()
        const officialAddress = electionOfficial.toLowerCase()

        console.log('Adding candidate:', name, party)
        console.log('Admin address:', adminAddress)
        console.log('Election official:', officialAddress)

        if (adminAddress !== officialAddress) {
            return NextResponse.json({
                error: 'Admin wallet does not match election official',
                adminAddress,
                electionOfficial: officialAddress,
            }, { status: 403 })
        }

        const walletClient = getWalletClient()

        console.log('Calling addCandidate...')
        const hash = await walletClient.writeContract({
            ...contractConfig,
            functionName: 'addCandidate',
            args: [name, party],
        })

        console.log('Transaction hash:', hash)

        // Store candidate in Neon DB (non-blocking)
        try {
            const { addCandidateToDb, logTransaction } = await import('@/lib/db')
            await addCandidateToDb(name, party, hash)
            await logTransaction('addCandidate', hash, { name, party })
            console.log('✅ Candidate saved to Neon DB')
        } catch (dbError: any) {
            console.error('⚠️ Failed to save to DB (blockchain tx still submitted):', dbError.message)
        }

        // Return immediately without waiting for confirmation (non-blocking)
        return NextResponse.json({
            success: true,
            pending: true,
            transactionHash: hash,
            message: `Candidate "${name}" submitted! Transaction pending confirmation.`,
            explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
        })
    } catch (error: any) {
        console.error('Error adding candidate:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to add candidate' },
            { status: 500 }
        )
    }
}
