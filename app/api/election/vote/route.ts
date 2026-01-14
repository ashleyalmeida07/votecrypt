import { NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
    contractConfig,
    getWalletClient,
    getElectionState,
    ElectionState,
    writeContractWithRetry,
    getMappedAddress,
    getVoterOnChain,
} from '@/lib/contract'
import { sql, getVoterByFirebaseUid, logTransaction, getUserByFirebaseUid } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET: Check if user has voted
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const uid = searchParams.get('uid')

        if (!uid) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        const voter = await getVoterByFirebaseUid(uid)

        return NextResponse.json({
            hasVoted: voter?.has_voted || false,
            voterInfo: voter ? {
                transactionHash: voter.transaction_hash,
                votedFor: voter.voted_for
            } : null
        })

    } catch (error: any) {
        console.error('Error fetching vote status:', error)
        return NextResponse.json(
            { error: 'Failed to check status' },
            { status: 500 }
        )
    }
}

// POST: Cast a vote
export async function POST(request: Request) {
    try {
        const { candidateId, firebaseUid, candidateName } = await request.json()

        if (candidateId === undefined || !firebaseUid) {
            return NextResponse.json(
                { error: 'Candidate ID and User ID are required' },
                { status: 400 }
            )
        }

        // 1. Get/Derive the User's "Gasless" Wallet Address
        const mappedAddress = getMappedAddress(firebaseUid)
        console.log(`🗳️ Processing vote for User ${firebaseUid} (Mapped Address: ${mappedAddress})`)

        // 2. Check Chain Status (Auto-Registration)
        let chainVoter = await getVoterOnChain(mappedAddress).catch(() => null)

        if (chainVoter && chainVoter.hasVoted) {
            return NextResponse.json({
                error: 'Blockchain rejected: Wallet has already voted.',
                transactionHash: 'on-chain'
            }, { status: 400 })
        }

        if (!chainVoter || !chainVoter.isRegistered) {
            console.log(`🆕 User not registered on-chain. Registering ${mappedAddress}...`)
            try {
                const regHash = await writeContractWithRetry('registerVoter', [mappedAddress])
                console.log('✅ Registered voter:', regHash)
                // Wait briefly for confirmation or just proceed? Ideally wait. 
                // For Sepolia, let's just wait 2s to minimize nonce issues, 
                // or assume mempool will order them (nonce N, nonce N+1).
                // writeContractWithRetry manages nonces, so sequential is fine.
            } catch (regError: any) {
                console.error("Registration failed:", regError.message)
                // If "already registered", ignore.
                if (!regError.message.includes('already registered')) {
                    throw regError
                }
            }
        }

        // 3. Check Election State
        const state = await getElectionState()
        if (state !== 1) { // 1 = Voting
            return NextResponse.json({
                error: `Election is not open. Current state: ${ElectionState[state as keyof typeof ElectionState]}`,
            }, { status: 403 })
        }

        // 4. Submit Vote As Proxy (voteFor)
        console.log(`🗳️ Casting 'voteFor' candidate ${candidateId}...`)

        // NOTE: This requires the contract to have 'function voteFor(address, uint)'
        const hash = await writeContractWithRetry('voteFor', [mappedAddress, BigInt(candidateId)])

        console.log('✅ Vote Transaction Hash:', hash)

        // 5. Update Database
        try {
            await sql`
                INSERT INTO voters (firebase_uid, wallet_address, is_registered, has_voted, voted_for, transaction_hash, created_at)
                VALUES (${firebaseUid}, ${mappedAddress}, true, true, ${candidateId}, ${hash}, CURRENT_TIMESTAMP)
                ON CONFLICT (firebase_uid) 
                DO UPDATE SET has_voted = true, voted_for = ${candidateId}, transaction_hash = ${hash}, wallet_address = ${mappedAddress}, created_at = CURRENT_TIMESTAMP
            `

            await logTransaction('vote', hash, {
                candidateId,
                candidateName,
                userId: firebaseUid,
                mappedAddress
            })

            // Update candidate count in DB too (write-through)
            // Use the blockchain ID if possible, but here we assume candidateId IS the blockchainId
            await sql`
                UPDATE candidates 
                SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE blockchain_id = ${candidateId}
            `

        } catch (dbError: any) {
            console.error('Failed to update DB:', dbError)
        }

        return NextResponse.json({
            success: true,
            transactionHash: hash
        })

    } catch (error: any) {
        console.error('Vote error:', error)
        if (error.message && error.message.includes('already voted')) {
            return NextResponse.json({ error: 'Blockchain rejected: Wallet has already voted.' }, { status: 400 })
        }
        return NextResponse.json(
            { error: error.message || 'Failed to submit vote' },
            { status: 500 }
        )
    }
}
