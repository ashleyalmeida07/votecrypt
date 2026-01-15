/**
 * ZKP Crypto Library for Anonymous Voting
 * 
 * This library provides:
 * - Poseidon hash function (ZK-friendly)
 * - Commitment generation (identity proof)
 * - Nullifier generation (double-spend protection)
 * - Merkle tree operations
 * - Proof generation/verification
 */

import { buildPoseidon, Poseidon } from 'circomlibjs'

// Singleton Poseidon instance
let poseidonInstance: Poseidon | null = null

/**
 * Initialize Poseidon hash function
 * Must be called before using any ZKP functions
 */
export async function initPoseidon(): Promise<Poseidon> {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon()
    }
    return poseidonInstance
}

/**
 * Poseidon hash function (ZK-friendly)
 * @param inputs Array of bigints to hash
 * @returns Hash as bigint
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
    const poseidon = await initPoseidon()
    const hash = poseidon(inputs)
    return poseidon.F.toObject(hash)
}

/**
 * Generate a random secret (for voter identity)
 * @returns Random 32-byte secret as hex string
 */
export function generateSecret(): string {
    const array = new Uint8Array(32)
    if (typeof window !== 'undefined') {
        window.crypto.getRandomValues(array)
    } else {
        // Server-side fallback
        const crypto = require('crypto')
        crypto.randomFillSync(array)
    }
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert hex string to bigint
 */
export function hexToBigInt(hex: string): bigint {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    return BigInt('0x' + cleanHex)
}

/**
 * Convert bigint to hex string
 */
export function bigIntToHex(n: bigint): string {
    return '0x' + n.toString(16).padStart(64, '0')
}

/**
 * Generate voter commitment
 * commitment = Poseidon(secret, nullifierSecret)
 * 
 * @param secret User's private secret (keep safe!)
 * @param nullifierSecret Additional secret for nullifier derivation
 * @returns Commitment hash as hex string
 */
export async function generateCommitment(
    secret: string,
    nullifierSecret: string
): Promise<string> {
    const secretBigInt = hexToBigInt(secret)
    const nullifierSecretBigInt = hexToBigInt(nullifierSecret)

    const commitment = await poseidonHash([secretBigInt, nullifierSecretBigInt])
    return bigIntToHex(commitment)
}

/**
 * Generate nullifier for double-spend protection
 * nullifier = Poseidon(nullifierSecret, electionId)
 * 
 * Each election has unique nullifiers, preventing cross-election tracking
 * 
 * @param nullifierSecret User's nullifier secret
 * @param electionId Unique identifier for the election
 * @returns Nullifier hash as hex string
 */
export async function generateNullifier(
    nullifierSecret: string,
    electionId: number | bigint
): Promise<string> {
    const nullifierSecretBigInt = hexToBigInt(nullifierSecret)
    const electionIdBigInt = BigInt(electionId)

    const nullifier = await poseidonHash([nullifierSecretBigInt, electionIdBigInt])
    return bigIntToHex(nullifier)
}

// ============================================
// MERKLE TREE OPERATIONS
// ============================================

const MERKLE_TREE_DEPTH = 20 // Supports 2^20 = ~1M voters

/**
 * Merkle Tree Node
 */
interface MerkleNode {
    hash: bigint
    left?: MerkleNode
    right?: MerkleNode
}

/**
 * Compute Merkle root from array of leaf commitments
 */
export async function computeMerkleRoot(leaves: bigint[]): Promise<bigint> {
    if (leaves.length === 0) {
        return BigInt(0)
    }

    // Pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(leaves.length)))
    const paddedLeaves = [...leaves]
    while (paddedLeaves.length < paddedLength) {
        paddedLeaves.push(BigInt(0))
    }

    let currentLevel = paddedLeaves

    while (currentLevel.length > 1) {
        const nextLevel: bigint[] = []
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i]
            const right = currentLevel[i + 1] || BigInt(0)
            const parentHash = await poseidonHash([left, right])
            nextLevel.push(parentHash)
        }
        currentLevel = nextLevel
    }

    return currentLevel[0]
}

/**
 * Generate Merkle proof for a leaf at given index
 */
export async function generateMerkleProof(
    leaves: bigint[],
    leafIndex: number
): Promise<{ siblings: bigint[], pathIndices: number[] }> {
    if (leafIndex >= leaves.length) {
        throw new Error('Leaf index out of bounds')
    }

    // Pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(Math.max(leaves.length, 2))))
    const paddedLeaves = [...leaves]
    while (paddedLeaves.length < paddedLength) {
        paddedLeaves.push(BigInt(0))
    }

    const siblings: bigint[] = []
    const pathIndices: number[] = []

    let currentLevel = paddedLeaves
    let currentIndex = leafIndex

    while (currentLevel.length > 1) {
        const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1
        siblings.push(currentLevel[siblingIndex] || BigInt(0))
        pathIndices.push(currentIndex % 2)

        const nextLevel: bigint[] = []
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i]
            const right = currentLevel[i + 1] || BigInt(0)
            const parentHash = await poseidonHash([left, right])
            nextLevel.push(parentHash)
        }

        currentLevel = nextLevel
        currentIndex = Math.floor(currentIndex / 2)
    }

    return { siblings, pathIndices }
}

/**
 * Verify Merkle proof
 */
export async function verifyMerkleProof(
    leaf: bigint,
    root: bigint,
    siblings: bigint[],
    pathIndices: number[]
): Promise<boolean> {
    let currentHash = leaf

    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i]
        const isLeft = pathIndices[i] === 0

        if (isLeft) {
            currentHash = await poseidonHash([currentHash, sibling])
        } else {
            currentHash = await poseidonHash([sibling, currentHash])
        }
    }

    return currentHash === root
}

// ============================================
// VOTE PROOF GENERATION (Client-side)
// ============================================

/**
 * Generate ZK vote proof inputs
 * This prepares the inputs for the ZK circuit
 */
export async function generateVoteProofInputs(
    secret: string,
    nullifierSecret: string,
    candidateId: number,
    merkleProof: { siblings: bigint[], pathIndices: number[] },
    merkleRoot: bigint,
    electionId: number
): Promise<{
    // Private inputs (hidden in proof)
    secret: string
    nullifierSecret: string
    siblings: string[]
    pathIndices: number[]
    // Public inputs (visible to verifier)
    nullifierHash: string
    candidateId: number
    merkleRoot: string
    electionId: number
}> {
    const nullifierHash = await generateNullifier(nullifierSecret, electionId)

    return {
        // Private
        secret,
        nullifierSecret,
        siblings: merkleProof.siblings.map(s => bigIntToHex(s)),
        pathIndices: merkleProof.pathIndices,
        // Public
        nullifierHash,
        candidateId,
        merkleRoot: bigIntToHex(merkleRoot),
        electionId
    }
}

// ============================================
// LOCAL STORAGE UTILITIES (Browser)
// ============================================

const STORAGE_KEY_PREFIX = 'zkp_vote_'

export interface VoterSecrets {
    secret: string
    nullifierSecret: string
    commitment: string
    registeredAt: string
}

/**
 * Store voter secrets in localStorage
 */
export function storeVoterSecrets(
    electionId: number,
    secrets: VoterSecrets
): void {
    if (typeof window === 'undefined') return
    const key = `${STORAGE_KEY_PREFIX}${electionId}`
    localStorage.setItem(key, JSON.stringify(secrets))
}

/**
 * Retrieve voter secrets from localStorage
 */
export function getVoterSecrets(electionId: number): VoterSecrets | null {
    if (typeof window === 'undefined') return null
    const key = `${STORAGE_KEY_PREFIX}${electionId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
}

/**
 * Check if voter has registered for an election
 */
export function hasRegisteredForElection(electionId: number): boolean {
    return getVoterSecrets(electionId) !== null
}

/**
 * Clear voter secrets (use with caution!)
 */
export function clearVoterSecrets(electionId: number): void {
    if (typeof window === 'undefined') return
    const key = `${STORAGE_KEY_PREFIX}${electionId}`
    localStorage.removeItem(key)
}
