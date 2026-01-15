
import { sql, getLatestElection, getCandidatesFromDb } from '../lib/db'
import {
    writeContractWithRetry,
    getElectionState,
    writeZkpContract,
    isZkpEnabled,
    getCandidateCount
} from '../lib/contract'

async function main() {
    console.log('🔧 Starting State Fix Script...')

    // 1. Get DB State
    const election = await getLatestElection()
    if (!election) {
        console.error('❌ No election found in database.')
        process.exit(1)
    }

    console.log(`📊 DB Election: ID=${election.id}, Name="${election.name}", State="${election.state}"`)

    // 2. Get Chain State
    const chainState = await getElectionState()
    const stateMap = { 0: 'Created', 1: 'Voting', 2: 'Ended' }
    console.log(`🔗 Main Chain State: ${chainState} (${stateMap[chainState as 0 | 1 | 2]})`)

    let zkpState: number | null = null
    if (isZkpEnabled()) {
        const zkpAddress = process.env.ZKP_CONTRACT_ADDR as `0x${string}`
        const zkpAbi = (await import('../Solidity/zkp-abi.json')).default
        const { publicClient } = await import('../lib/contract')

        try {
            const state = await publicClient.readContract({
                address: zkpAddress,
                abi: zkpAbi,
                functionName: 'electionState',
            }) as bigint
            zkpState = Number(state)
            console.log(`🔐 ZKP Contract State: ${zkpState} (${stateMap[zkpState as 0 | 1 | 2]})`)
        } catch (e: any) {
            console.error('❌ Failed to read ZKP state:', e.message)
        }
    }

    // 3. Detect Mismatch
    let needsReset = false

    // Check Main Contract Mismatch
    if (election.state === 'Created' && chainState !== 0) {
        console.warn('⚠️ MISMATCH: DB=Created, MainChain!=Created')
        needsReset = true
    }

    // Check ZKP Contract Mismatch
    // If DB is Created, ZKP must be Created
    if (zkpState !== null && election.state === 'Created' && zkpState !== 0) {
        console.warn('⚠️ MISMATCH: DB=Created, ZkpChain!=Created')
        needsReset = true
    }

    if (!needsReset) {
        console.log('✅ States appear aligned for "Created" status. No forced reset triggered.')

        // Check if DB is Voting/Ended but ZKP is Created
        if (election.state !== 'Created' && zkpState === 0) {
            console.warn('⚠️ DB is Advanced but ZKP is Created. This explains "Invalid election state" (ZK revert).')
            console.warn('💡 Recommendation: Start a NEW election via Admin Panel to fully reset.')
            // We won't auto-fix this because it requires complex syncing. 
            // Best to just advise user to start new.
        }
    }

    if (needsReset) {
        console.log('🔄 Initiating Chain Reset (startNewElection)...')

        try {
            // Main Contract
            const hash = await writeContractWithRetry('startNewElection', [election.name])
            console.log('✅ Main Contract Reset:', hash)

            // ZKP Contract
            if (isZkpEnabled()) {
                const zkpHash = await writeZkpContract(
                    'startNewElection',
                    [election.name, BigInt(election.id)]
                )
                console.log('✅ ZKP Contract Reset:', zkpHash)
            }

            console.log('✅ Chain state reset to Created.')
        } catch (e: any) {
            console.error('❌ Reset Failed:', e.message)
            process.exit(1)
        }
    }

    // 4. Sync Candidates if we reset or if counts mismatch and we are in Created state (now)
    // Only check sync if we are effectively in Created state (just reset or was already Created)
    if (needsReset || (election.state === 'Created')) {
        const dbCandidates = await getCandidatesFromDb(election.id)
        const onChainCount = await getCandidateCount()

        console.log(`Candidates: DB=${dbCandidates.length}, Chain=${onChainCount}`)

        if (dbCandidates.length > Number(onChainCount)) {
            console.log(`🔄 Syncing ${dbCandidates.length - Number(onChainCount)} missing candidates...`)

            for (let i = Number(onChainCount); i < dbCandidates.length; i++) {
                const c = dbCandidates[i]
                console.log(`Adding candidate: ${c.name}`)

                const anonymizedName = `Candidate ${c.blockchain_id}`
                const anonymizedParty = `Party ${String.fromCharCode(65 + (c.blockchain_id % 26))}`

                try {
                    // Main
                    await writeContractWithRetry('addCandidate', [anonymizedName, anonymizedParty])

                    // ZKP
                    if (isZkpEnabled()) {
                        await writeZkpContract('addCandidate', [anonymizedName, anonymizedParty])
                    }
                    console.log(`✅ Added ${c.name}`)
                } catch (e: any) {
                    console.error(`❌ Failed to add ${c.name}:`, e.message)
                }
            }
        } else {
            console.log('✅ Candidates synced.')
        }
    }

    console.log('🏁 Verification Done.')
    process.exit(0)
}

main().catch(console.error)
