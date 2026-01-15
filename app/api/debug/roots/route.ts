import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import zkpAbi from '@/Solidity/zkp-abi.json'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // 1. Get Latest Election
        const elections = await sql`SELECT * FROM elections ORDER BY id DESC LIMIT 1`
        const election = elections[0]

        if (!election) {
            return NextResponse.json({ error: 'No election found' })
        }

        // 2. Get DB Merkle Root
        const trees = await sql`SELECT * FROM zkp_merkle_trees WHERE election_id = ${election.id}`
        const dbRoot = trees.length > 0 ? trees[0].merkle_root : 'Not Found'

        // 3. Get Contract Merkle Root
        const zkpAddress = process.env.ZKP_CONTRACT_ADDR as `0x${string}`
        let contractRoot = 'Unknown'

        if (zkpAddress) {
            const client = createPublicClient({
                chain: sepolia, // Assuming Sepolia for now, or detect
                transport: http(process.env.RPC_URL)
            })

            try {
                const root = await client.readContract({
                    address: zkpAddress,
                    abi: zkpAbi,
                    functionName: 'merkleRoot',
                })
                contractRoot = root as string
            } catch (e: any) {
                contractRoot = 'Read Failed: ' + e.message
            }
        }

        return NextResponse.json({
            electionId: election.id,
            dbRoot,
            contractRoot,
            match: dbRoot === contractRoot,
            zkpAddress
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}
