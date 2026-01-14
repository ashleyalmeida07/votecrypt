import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia, mainnet, polygon, arbitrum, arbitrumSepolia, polygonAmoy, baseSepolia, base } from 'viem/chains'
import abi from '@/Solidity/abi.json'

// Get environment variables
const RPC_URL = process.env.RPC_URL!
const CONTRACT_ADDR = process.env.CONTRACT_ADDR as `0x${string}`
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined

// All supported chains
const SUPPORTED_CHAINS: Record<number, any> = {
    1: mainnet,
    11155111: sepolia,
    137: polygon,
    80002: polygonAmoy,
    42161: arbitrum,
    421614: arbitrumSepolia,
    8453: base,
    84532: baseSepolia,
}

// Detect chain from RPC URL keywords (fallback)
function detectChainFromUrl(rpcUrl: string) {
    const url = rpcUrl.toLowerCase()
    if (url.includes('mainnet') && !url.includes('sepolia')) return mainnet
    if (url.includes('polygon') && url.includes('amoy')) return polygonAmoy
    if (url.includes('polygon') || url.includes('matic')) return polygon
    if (url.includes('arb') && url.includes('sepolia')) return arbitrumSepolia
    if (url.includes('arb')) return arbitrum
    if (url.includes('base') && url.includes('sepolia')) return baseSepolia
    if (url.includes('base')) return base
    if (url.includes('sepolia')) return sepolia
    return sepolia // Default fallback
}

// Use URL-based detection for initial setup
const detectedChain = detectChainFromUrl(RPC_URL)

// Public client for read operations (no private key needed)
export const publicClient = createPublicClient({
    chain: detectedChain,
    transport: http(RPC_URL),
})

// Wallet client for write operations (requires private key)
export function getWalletClient() {
    if (!ADMIN_PRIVATE_KEY) {
        throw new Error('ADMIN_PRIVATE_KEY not configured')
    }

    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)

    return createWalletClient({
        account,
        chain: detectedChain,
        transport: http(RPC_URL),
    })
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

// Helper: Get total votes cast
export async function getTotalVotes(): Promise<number> {
    const candidates = await getAllCandidates()
    return candidates.reduce((sum, c) => sum + c.voteCount, 0)
}
