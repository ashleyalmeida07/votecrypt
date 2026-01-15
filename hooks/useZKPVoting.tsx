'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    generateSecret,
    generateCommitment,
    generateNullifier,
    storeVoterSecrets,
    getVoterSecrets,
    hasRegisteredForElection,
    VoterSecrets
} from '@/lib/zkp'

interface ZKPState {
    isRegistered: boolean
    hasVoted: boolean
    secrets: VoterSecrets | null
    electionId: number | null
    loading: boolean
    error: string | null
}

interface UseZKPVotingReturn {
    state: ZKPState
    register: (firebaseUid: string) => Promise<VoterSecrets | null>
    vote: (candidateId: number) => Promise<{ success: boolean; nullifierHash?: string; error?: string }>
    checkVoteStatus: () => Promise<boolean>
    loadLocalSecrets: (electionId: number) => void
}

/**
 * React hook for ZKP anonymous voting
 * Handles client-side secret management and API calls
 */
export function useZKPVoting(): UseZKPVotingReturn {
    const [state, setState] = useState<ZKPState>({
        isRegistered: false,
        hasVoted: false,
        secrets: null,
        electionId: null,
        loading: false,
        error: null
    })

    /**
     * Load secrets from localStorage for a given election
     */
    const loadLocalSecrets = useCallback((electionId: number) => {
        const secrets = getVoterSecrets(electionId)
        setState(prev => ({
            ...prev,
            secrets,
            isRegistered: secrets !== null,
            electionId
        }))
    }, [])

    /**
     * Register for ZKP voting
     * Generates secrets client-side and stores them locally
     */
    const register = useCallback(async (firebaseUid: string): Promise<VoterSecrets | null> => {
        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            // Call registration API
            const res = await fetch('/api/election/zkp/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebaseUid })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed')
            }

            // Store secrets locally
            const secrets: VoterSecrets = {
                secret: data.secrets.secret,
                nullifierSecret: data.secrets.nullifierSecret,
                commitment: data.secrets.commitment,
                registeredAt: new Date().toISOString()
            }

            storeVoterSecrets(data.electionId, secrets)

            setState(prev => ({
                ...prev,
                secrets,
                isRegistered: true,
                electionId: data.electionId,
                loading: false
            }))

            return secrets

        } catch (error: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error.message
            }))
            return null
        }
    }, [])

    /**
     * Cast an anonymous vote
     */
    const vote = useCallback(async (candidateId: number): Promise<{ success: boolean; nullifierHash?: string; error?: string }> => {
        if (!state.secrets) {
            return { success: false, error: 'No secrets found. Please register first.' }
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            const res = await fetch('/api/election/zkp/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: state.secrets.secret,
                    nullifierSecret: state.secrets.nullifierSecret,
                    candidateId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Vote failed')
            }

            setState(prev => ({
                ...prev,
                hasVoted: true,
                loading: false
            }))

            return {
                success: true,
                nullifierHash: data.nullifierHash
            }

        } catch (error: any) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error.message
            }))
            return { success: false, error: error.message }
        }
    }, [state.secrets])

    /**
     * Check if the current user has voted
     */
    const checkVoteStatus = useCallback(async (): Promise<boolean> => {
        if (!state.secrets) {
            return false
        }

        try {
            const params = new URLSearchParams({
                nullifierSecret: state.secrets.nullifierSecret
            })
            if (state.electionId) {
                params.append('electionId', state.electionId.toString())
            }

            const res = await fetch(`/api/election/zkp/vote?${params}`)
            const data = await res.json()

            const hasVoted = data.hasVoted || false
            setState(prev => ({ ...prev, hasVoted }))
            return hasVoted

        } catch (error) {
            console.error('Failed to check vote status:', error)
            return false
        }
    }, [state.secrets, state.electionId])

    return {
        state,
        register,
        vote,
        checkVoteStatus,
        loadLocalSecrets
    }
}

/**
 * Component to display ZKP registration status
 */
export function ZKPRegistrationBanner({ electionId }: { electionId: number }) {
    const { state, loadLocalSecrets } = useZKPVoting()

    useEffect(() => {
        loadLocalSecrets(electionId)
    }, [electionId, loadLocalSecrets])

    if (state.isRegistered) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-green-800">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Anonymous Voting Enabled</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                    Your identity is protected using Zero Knowledge Proofs.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-amber-800">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Register for Anonymous Voting</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
                Enable ZKP voting to cast your vote anonymously.
            </p>
        </div>
    )
}
