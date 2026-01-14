import { createPublicClient, createWalletClient, http, Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia, mainnet, polygon, arbitrum, arbitrumSepolia, polygonAmoy, baseSepolia, base } from 'viem/chains'
import abi from '@/Solidity/abi.json'

// Get environment variables
const RPC_URL = process.env.RPC_URL!
const CONTRACT_ADDR = process.env.CONTRACT_ADDR as `0x${string}`
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined

// All supported chains by chain ID
const SUPPORTED_CHAINS: Record<number, Chain> = {
    1: mainnet,
    11155111: sepolia,
    137: polygon,
    80002: polygonAmoy,
    42161: arbitrum,
    421614: arbitrumSepolia,
    8453: base,
    84532: baseSepolia,
}

// Detect chain from RPC URL keywords
function detectChainFromUrl(rpcUrl: string): Chain {
    const url = rpcUrl.toLowerCase()

    // Check for specific network patterns in Alchemy/Infura URLs
    if (url.includes('eth-mainnet') || (url.includes('mainnet') && !url.includes('sepolia'))) return mainnet
    if (url.includes('eth-sepolia') || url.includes('sepolia')) return sepolia
    if (url.includes('polygon-mainnet') || (url.includes('polygon') && !url.includes('amoy'))) return polygon
    if (url.includes('polygon-amoy') || url.includes('amoy')) return polygonAmoy
    if (url.includes('arb-mainnet') || (url.includes('arbitrum') && !url.includes('sepolia'))) return arbitrum
    if (url.includes('arb-sepolia') || (url.includes('arbitrum') && url.includes('sepolia'))) return arbitrumSepolia
    if (url.includes('base-mainnet') || (url.includes('base') && !url.includes('sepolia'))) return base
    if (url.includes('base-sepolia')) return baseSepolia

    console.warn('⚠️ Could not detect chain from RPC URL, defaulting to Sepolia')
    return sepolia
}

// Detect chain
const detectedChain = detectChainFromUrl(RPC_URL)
console.log('🔗 Detected chain:', detectedChain.name, '(Chain ID:', detectedChain.id, ')')
console.log('📍 RPC URL:', RPC_URL.replace(/[a-zA-Z0-9]{20,}/, '[API_KEY]'))
console.log('📜 Contract:', CONTRACT_ADDR)

// Public client for read operations
export const publicClient = createPublicClient({
    chain: detectedChain,
    transport: http(RPC_URL),
})

// Verify chain ID on first load
publicClient.getChainId().then(chainId => {
    console.log('✅ RPC Chain ID:', chainId)
    if (chainId !== detectedChain.id) {
        console.error('❌ CHAIN MISMATCH! RPC returns chain ID', chainId, 'but we configured', detectedChain.id)
    }
}).catch(err => {
    console.error('❌ Failed to get chain ID:', err.message)
})

// Wallet client for write operations
export function getWalletClient() {
    if (!ADMIN_PRIVATE_KEY) {
        throw new Error('ADMIN_PRIVATE_KEY not configured')
    }

    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)
    console.log('🔑 Using wallet:', account.address)

    return createWalletClient({
        account,
        chain: detectedChain,
        transport: http(RPC_URL, {
            batch: false,
            retryCount: 3,
            retryDelay: 1000,
        }),
    })
}

// Helper: Safely write to contract with manual nonce management
export async function writeContractWithRetry(functionName: string, args: any[] = []) {
    const walletClient = getWalletClient()
    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY!)
    let retries = 3

    while (retries > 0) {
        try {
            // Fetch fresh nonce including pending txs
            const nonce = await publicClient.getTransactionCount({
                address: account.address,
                blockTag: 'pending'
            })

            console.log(`📝 Attempting ${functionName} with nonce ${nonce}`)

            const hash = await walletClient.writeContract({
                ...contractConfig,
                functionName,
                args,
                nonce, // Manually set nonce to avoid race condition where viem fetches old one
            })
            return hash

        } catch (error: any) {
            console.error(`❌ Tx failed (retries left: ${retries}):`, error.shortMessage || error.message)

            if (error.message.includes('replacement transaction underpriced') ||
                error.message.includes('nonce too low')) {
                // Wait a bit and retry with a new nonce fetch
                await new Promise(r => setTimeout(r, 2000))
                retries--
                continue
            }
            throw error
        }
    }
    throw new Error('Failed to submit transaction after retries')
}

// Get next nonce (handles pending transactions)
export async function getNextNonce(): Promise<number> {
    if (!ADMIN_PRIVATE_KEY) throw new Error('ADMIN_PRIVATE_KEY not configured')

    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)
    const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'pending', // Include pending transactions
    })
    console.log('📊 Next nonce:', nonce)
    return nonce
}

// Get detected chain info for debugging
export function getChainInfo() {
    return {
        name: detectedChain.name,
        id: detectedChain.id,
        rpcUrl: RPC_URL.replace(/[a-zA-Z0-9]{20,}/, '[API_KEY]'),
        contractAddress: CONTRACT_ADDR,
        blockExplorer: detectedChain.blockExplorers?.default?.url || 'Unknown',
    }
}

// Contract configuration
export const contractConfig = {
    address: CONTRACT_ADDR,
    abi: abi,
} as const

// Election state enum mapping
export const ElectionState = {
    0: 'Created',
    1: 'Voting',
    2: 'Ended',
} as const

export type ElectionStateType = keyof typeof ElectionState

// Helper: Get election state
export async function getElectionState(): Promise<number> {
    const state = await publicClient.readContract({
        ...contractConfig,
        functionName: 'electionState',
    })
    return Number(state)
}

// Helper: Get election name
export async function getElectionName(): Promise<string> {
    const name = await publicClient.readContract({
        ...contractConfig,
        functionName: 'electionName',
    })
    return name as string
}

// Helper: Get election official address
export async function getElectionOfficial(): Promise<string> {
    const official = await publicClient.readContract({
        ...contractConfig,
        functionName: 'electionOfficial',
    })
    return official as string
}

// Helper: Get candidate count
export async function getCandidateCount(): Promise<number> {
    const count = await publicClient.readContract({
        ...contractConfig,
        functionName: 'getCandidateCount',
    })
    return Number(count)
}

// Helper: Get candidate by ID
export async function getCandidate(id: number): Promise<{
    id: number
    name: string
    party: string
    voteCount: number
}> {
    const result = await publicClient.readContract({
        ...contractConfig,
        functionName: 'getCandidate',
        args: [BigInt(id)],
    })

    const [candidateId, name, party, voteCount] = result as [bigint, string, string, bigint]

    return {
        id: Number(candidateId),
        name,
        party,
        voteCount: Number(voteCount),
    }
}

// Helper: Get all candidates
export async function getAllCandidates() {
    const count = await getCandidateCount()
    const candidates = []

    for (let i = 0; i < count; i++) {
        const candidate = await getCandidate(i)
        candidates.push(candidate)
    }

    return candidates
}

// Helper: Check voter status on blockchain
export async function getVoterOnChain(address: `0x${string}`): Promise<{ isRegistered: boolean, hasVoted: boolean, votedFor: number }> {
    const result = await publicClient.readContract({
        ...contractConfig,
        functionName: 'voters',
        args: [address],
    })

    // Result is [isRegistered, hasVoted, votedFor]
    const [isRegistered, hasVoted, votedFor] = result as [boolean, boolean, bigint]

    return {
        isRegistered,
        hasVoted,
        votedFor: Number(votedFor)
    }
}

// Helper: Get total votes cast
export async function getTotalVotes(): Promise<number> {
    const candidates = await getAllCandidates()
    return candidates.reduce((sum, c) => sum + c.voteCount, 0)
}

// Helper: Map Firebase UID to Ethereum Address (Deterministic)
// This enables Gasless voting where the backend generates a unique identity for the user.
import { keccak256, stringToHex } from 'viem'
export function getMappedAddress(uid: string): `0x${string}` {
    const hash = keccak256(stringToHex(uid))
    // Use last 20 bytes (40 hex chars) for the address to mimic Ethereum address format
    return `0x${hash.slice(-40)}` as `0x${string}`
}
