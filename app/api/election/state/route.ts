import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getElectionState,
    getElectionOfficial,
    ElectionState,
} from '@/lib/contract'

// GET: Get current election state
export async function GET() {
    try {
        const state = await getElectionState()

        return NextResponse.json({
            state,
            stateName: ElectionState[state as keyof typeof ElectionState],
        })
    } catch (error) {
        console.error('Error fetching election state:', error)
        return NextResponse.json(
            { error: 'Failed to fetch election state' },
            { status: 500 }
        )
    }
}

// POST: Change election state (start/end)
export async function POST(request: Request) {
    try {
        const { action } = await request.json()

        if (!['start', 'end'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Use "start" or "end"' },
                { status: 400 }
            )
        }

        // Pre-flight checks
        const currentState = await getElectionState()
        const electionOfficial = await getElectionOfficial()

        // Get admin wallet address
        const adminKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`
        if (!adminKey) {
            return NextResponse.json(
                { error: 'ADMIN_PRIVATE_KEY not configured' },
                { status: 500 }
            )
        }
        const adminAccount = privateKeyToAccount(adminKey)
        const adminAddress = adminAccount.address.toLowerCase()
        const officialAddress = electionOfficial.toLowerCase()

        console.log('Admin address:', adminAddress)
        console.log('Election official:', officialAddress)
        console.log('Current state:', currentState, ElectionState[currentState as keyof typeof ElectionState])

        // Check if admin matches election official
        if (adminAddress !== officialAddress) {
            return NextResponse.json({
                error: 'Admin wallet does not match election official',
                adminAddress,
                electionOfficial: officialAddress,
            }, { status: 403 })
        }

        // Check if state is valid for the action
        if (action === 'start' && currentState !== 0) {
            return NextResponse.json({
                error: `Cannot start election. Current state is "${ElectionState[currentState as keyof typeof ElectionState]}" (expected: Created)`,
                currentState,
            }, { status: 400 })
        }
        if (action === 'end' && currentState !== 1) {
            return NextResponse.json({
                error: `Cannot end election. Current state is "${ElectionState[currentState as keyof typeof ElectionState]}" (expected: Voting)`,
                currentState,
            }, { status: 400 })
        }

        const walletClient = getWalletClient()
        const functionName = action === 'start' ? 'startElection' : 'endElection'

        console.log(`Calling ${functionName}...`)

        const hash = await walletClient.writeContract({
            ...contractConfig,
            functionName,
        })

        console.log('Transaction hash:', hash)

        // Try to wait for confirmation with extended timeout (5 minutes)
        let receipt = null
        let newState = null

        try {
            receipt = await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 300_000, // 5 minutes
            })
            console.log('Transaction confirmed in block:', receipt.blockNumber)
            newState = await getElectionState()
            console.log('New state:', newState, ElectionState[newState as keyof typeof ElectionState])
        } catch (waitError: any) {
            console.log('Transaction submitted, confirmation pending:', hash)
            return NextResponse.json({
                success: true,
                pending: true,
                transactionHash: hash,
                message: 'Transaction submitted! Confirmation is pending. Check block explorer for status.',
            })
        }

        return NextResponse.json({
            success: true,
            transactionHash: hash,
            blockNumber: receipt ? Number(receipt.blockNumber) : null,
            newState,
            newStateName: newState !== null ? ElectionState[newState as keyof typeof ElectionState] : null,
        })
    } catch (error: any) {
        console.error('Error changing election state:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to change election state' },
            { status: 500 }
        )
    }
}
