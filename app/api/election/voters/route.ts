import { NextResponse } from 'next/server'
import {
    publicClient,
    contractConfig,
    getWalletClient,
    getElectionState,
} from '@/lib/contract'

// POST: Register a voter (works in Created or Voting state)
export async function POST(request: Request) {
    try {
        const { address } = await request.json()

        if (!address) {
            return NextResponse.json(
                { error: 'Voter address is required' },
                { status: 400 }
            )
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return NextResponse.json(
                { error: 'Invalid Ethereum address format' },
                { status: 400 }
            )
        }

        // Check election state (can register in Created or Voting)
        const state = await getElectionState()
        if (state === 2) {
            return NextResponse.json(
                { error: 'Cannot register voters after election has ended' },
                { status: 400 }
            )
        }

        const walletClient = getWalletClient()

        const hash = await walletClient.writeContract({
            ...contractConfig,
            functionName: 'registerVoter',
            args: [address as `0x${string}`],
        })

        console.log('Voter registration hash:', hash)

        // Store voter in Neon DB (non-blocking)
        try {
            const { registerVoterInDb, logTransaction } = await import('@/lib/db')
            await registerVoterInDb(address, hash)
            await logTransaction('registerVoter', hash, { address })
            console.log('✅ Voter saved to Neon DB')
        } catch (dbError: any) {
            console.error('⚠️ Failed to save voter to DB:', dbError.message)
        }

        // Return immediately without waiting for confirmation (non-blocking)
        return NextResponse.json({
            success: true,
            pending: true,
            transactionHash: hash,
            message: 'Voter registration submitted! Transaction pending confirmation.',
            registeredAddress: address,
            explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
        })
    } catch (error: any) {
        console.error('Error registering voter:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to register voter' },
            { status: 500 }
        )
    }
}
