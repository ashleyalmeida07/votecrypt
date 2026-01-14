import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia, mainnet, polygon, arbitrum, arbitrumSepolia, polygonAmoy, baseSepolia, base } from 'viem/chains'

// Debug endpoint to check blockchain connection
export async function GET() {
    try {
        const RPC_URL = process.env.RPC_URL!
        const CONTRACT_ADDR = process.env.CONTRACT_ADDR
        const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined

        // Get admin address if key exists
        let adminAddress = null
        if (ADMIN_PRIVATE_KEY) {
            const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)
            adminAddress = account.address
        }

        // Create a basic client to get chain info
        const client = createPublicClient({
            transport: http(RPC_URL),
        })

        // Get chain ID from the RPC
        const chainId = await client.getChainId()

        // Map chain ID to name
        const chainNames: Record<number, string> = {
            1: 'Ethereum Mainnet',
            11155111: 'Sepolia Testnet',
            137: 'Polygon Mainnet',
            80002: 'Polygon Amoy Testnet',
            42161: 'Arbitrum One',
            421614: 'Arbitrum Sepolia Testnet',
            8453: 'Base Mainnet',
            84532: 'Base Sepolia Testnet',
        }

        // Block explorer URLs
        const explorerUrls: Record<number, string> = {
            1: 'https://etherscan.io',
            11155111: 'https://sepolia.etherscan.io',
            137: 'https://polygonscan.com',
            80002: 'https://amoy.polygonscan.com',
            42161: 'https://arbiscan.io',
            421614: 'https://sepolia.arbiscan.io',
            8453: 'https://basescan.org',
            84532: 'https://sepolia.basescan.org',
        }

        // Get balance of admin wallet
        let adminBalance = null
        if (adminAddress) {
            try {
                const balance = await client.getBalance({ address: adminAddress as `0x${string}` })
                adminBalance = (Number(balance) / 1e18).toFixed(6) + ' ETH'
            } catch (e) {
                adminBalance = 'Error fetching balance'
            }
        }

        return NextResponse.json({
            rpcUrl: RPC_URL.replace(/[a-zA-Z0-9]{32,}/, '[API_KEY_HIDDEN]'), // Hide API key
            contractAddress: CONTRACT_ADDR,
            chainId,
            chainName: chainNames[chainId] || `Unknown (Chain ID: ${chainId})`,
            blockExplorer: explorerUrls[chainId] || 'Unknown',
            adminAddress,
            adminBalance,
            hasPrivateKey: !!ADMIN_PRIVATE_KEY,
        })
    } catch (error: any) {
        console.error('Debug error:', error)
        return NextResponse.json({
            error: error.message,
            hint: 'Check RPC_URL in .env.local',
        }, { status: 500 })
    }
}
