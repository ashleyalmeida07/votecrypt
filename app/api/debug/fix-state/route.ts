
import { NextResponse } from 'next/server'
import { sql, getCandidatesFromDb, getLatestElection } from '@/lib/db'
import {
    writeContractWithRetry,
    writeZkpContract,
    getElectionState,
    isZkpEnabled,
    getCandidateCount
} from '@/lib/contract'

export const dynamic = 'force-dynamic'

export async function GET() {
    console.log('🔧 Debug: Checking State Consistency...')

    try {
        // 1. Get DB State
        const election = await getLatestElection()
        if (!election) {
            return NextResponse.json({ message: 'No election in DB' })
        }

        // 2. Get Chain State
        const zkpContractAddress = process.env.ZKP_CONTRACT_ADDR as `0x${string}`
        let zkpState = 0 // Default Created

        if (isZkpEnabled() && zkpContractAddress) {
            const { publicClient } = await import('@/lib/contract')
            const zkpAbi = (await import('@/Solidity/zkp-abi.json')).default

            try {
                const state = await publicClient.readContract({
                    address: zkpContractAddress,
                    abi: zkpAbi,
                    functionName: 'electionState',
                }) as bigint
                zkpState = Number(state)
            } catch (e: any) {
                console.error('Failed to read ZKP state:', e.message)
                // If read fails, abort fix
                return NextResponse.json({ error: 'Failed to read ZKP state: ' + e.message }, { status: 500 })
            }
        }

        console.log(`Debug State: DB=${election.state}, ZKP=${zkpState}`)

        // 3. Detect Mismatch: DB=Voting/Ended but ZKP=Created (0)
        let repaired = false
        if (election.state !== 'Created' && zkpState === 0) {
            console.warn('⚠️ DETECTED MISMATCH: DB is ahead of ZKP. Attempting Repair...')

            // A. Sync Merkle Root
            const trees = await sql`SELECT merkle_root FROM zkp_merkle_trees WHERE election_id = ${election.id} ORDER BY id DESC LIMIT 1`
            if (trees.length > 0 && trees[0].merkle_root) {
                console.log('🔄 Syncing Merkle Root:', trees[0].merkle_root)
                await writeZkpContract('updateMerkleRoot', [trees[0].merkle_root as `0x${string}`], zkpContractAddress)
            } else {
                console.warn('⚠️ No Merkle Root found! Skipping root sync.')
            }

            // B. Sync Candidates
            const dbCandidates = await getCandidatesFromDb(election.id)
            const { publicClient } = await import('@/lib/contract')
            const zkpAbi = (await import('@/Solidity/zkp-abi.json')).default

            const zkpCountBig = await publicClient.readContract({
                address: zkpContractAddress,
                abi: zkpAbi,
                functionName: 'getCandidateCount',
            }) as bigint
            const zkpCount = Number(zkpCountBig)

            if (dbCandidates.length > zkpCount) {
                console.log(`🔄 Syncing ${dbCandidates.length - zkpCount} Candidates...`)
                for (let i = zkpCount; i < dbCandidates.length; i++) {
                    const c = dbCandidates[i]
                    const anonymizedName = `Candidate ${c.blockchain_id}`
                    const anonymizedParty = `Party ${String.fromCharCode(65 + (c.blockchain_id % 26))}`
                    await writeZkpContract('addCandidate', [anonymizedName, anonymizedParty], zkpContractAddress)
                }
            }

            // C. Start Election
            console.log('🚀 Starting Election on ZKP Contract...')
            await writeZkpContract('startElection', [], zkpContractAddress)

            if (election.state === 'Ended') {
                console.log('🏁 Ending Election on ZKP Contract (Catching up)...')
                await writeZkpContract('endElection', [], zkpContractAddress)
            }

            repaired = true
        }

        return NextResponse.json({
            success: true,
            dbState: election.state,
            zkpState,
            repaired,
            message: repaired ? 'State mismatch repaired!' : 'State is consistent (or not repairable via this logic)'
        })

    } catch (error: any) {
        console.error('Fix State Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
