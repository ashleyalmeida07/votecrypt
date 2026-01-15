
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import abi from './Solidity/abi.json'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL)
})

async function check() {
    try {
        const state = await client.readContract({
            address: process.env.CONTRACT_ADDR as `0x${string}`,
            abi,
            functionName: 'electionState'
        })
        console.log('On-Chain State:', state)
    } catch (e) {
        console.error(e)
    }
}
check()
