import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getElectionState,
    getElectionOfficial,
    getNextNonce,
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

// POST: Change election state (start/end/newElection)
export async function POST(request: Request) {
    try {
        const { action, newName } = await request.json()

        if (!['start', 'end', 'newElection'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Use "start", "end", or "newElection"' },
                { status: 400 }
            )
        }

        // Validate newName for newElection action
        if (action === 'newElection' && (!newName || newName.trim() === '')) {
            return NextResponse.json(
                { error: 'New election name is required' },
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
        if (action === 'newElection' && currentState !== 2) {
            return NextResponse.json({
                error: `Cannot start new election. Current election must be ended first. Current state: "${ElectionState[currentState as keyof typeof ElectionState]}"`,
                currentState,
            }, { status: 400 })
        }

        const walletClient = getWalletClient()
        let hash: `0x${string}`

        if (action === 'newElection') {
            console.log(`Calling startNewElection with name: ${newName}...`)
            hash = await walletClient.writeContract({
                ...contractConfig,
                functionName: 'startNewElection',
                args: [newName],
            })
        } else {
            const functionName = action === 'start' ? 'startElection' : 'endElection'
            console.log(`Calling ${functionName}...`)

            // First simulate to check for errors
            try {
                await publicClient.simulateContract({
                    ...contractConfig,
                    functionName,
                    account: walletClient.account,
                })
                console.log('✅ Simulation passed')
            } catch (simError: any) {
                console.error('❌ Simulation failed:', simError.message)
                return NextResponse.json({
                    error: `Contract call would fail: ${simError.shortMessage || simError.message}`,
                }, { status: 400 })
            }

            // Get current nonce to avoid conflicts
            const nonce = await getNextNonce()

            hash = await walletClient.writeContract({
                ...contractConfig,
                functionName,
                nonce,
            })
        }

        console.log('Transaction hash:', hash)

        // Wait briefly to verify transaction was actually broadcast
        try {
            const txCheck = await publicClient.getTransaction({ hash })
            console.log('✅ Transaction found on network, nonce:', txCheck.nonce)
        } catch (e) {
            console.log('⚠️ Transaction not yet visible on network (may still be pending)')
        }

        // Return immediately without waiting for confirmation (non-blocking)
        const actionLabels: Record<string, string> = {
            start: 'Election start',
            end: 'Election end',
            newElection: 'New election creation'
        }

        return NextResponse.json({
            success: true,
            pending: true,
            transactionHash: hash,
            message: `${actionLabels[action]} submitted! Transaction pending confirmation.`,
            explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
        })
    } catch (error: any) {
        console.error('Error changing election state:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to change election state' },
            { status: 500 }
        )
    }
}
