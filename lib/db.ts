// ========================================
// USER AUTHENTICATION (Vercel Postgres)
// ========================================
import { sql as vercelSql } from '@vercel/postgres';

export interface User {
    id: number;
    firebase_uid: string;
    email: string;
    display_name: string | null;
    photo_url: string | null;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Voter {
    id: number;
    firebase_uid: string;
    wallet_address: string | null;
    is_registered: boolean;
    has_voted: boolean;
    voted_for: number | null;
    transaction_hash: string | null;
    created_at: Date;
}

export async function createOrUpdateUser(
    firebaseUid: string,
    email: string,
    displayName: string | null,
    photoUrl: string | null
): Promise<User> {
    const result = await vercelSql`
    INSERT INTO users (firebase_uid, email, display_name, photo_url, email_verified)
    VALUES (${firebaseUid}, ${email}, ${displayName}, ${photoUrl}, false)
    ON CONFLICT (firebase_uid) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      photo_url = EXCLUDED.photo_url,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

    return result.rows[0] as User;
}

export async function updateEmailVerification(
    firebaseUid: string
): Promise<User> {
    const result = await vercelSql`
    UPDATE users 
    SET email_verified = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE firebase_uid = ${firebaseUid}
    RETURNING *
  `;

    return result.rows[0] as User;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const result = await vercelSql`
    SELECT * FROM users WHERE firebase_uid = ${firebaseUid}
  `;

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const result = await vercelSql`
    SELECT * FROM users WHERE email = ${email}
  `;

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
}



export async function createAuditLog(
    userId: number | null,
    action: string,
    entityType: string | null,
    entityId: number | null,
    ipAddress: string | null,
    userAgent: string | null,
    details: any
) {
    await vercelSql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
    VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${ipAddress}, ${userAgent}, ${JSON.stringify(details)})
  `;
}

// ========================================
// BLOCKCHAIN/ELECTION (Neon Database)
// ========================================
import { neon } from '@neondatabase/serverless'

// Get connection string from environment
const connectionString = process.env.NEON_DB!

// Create SQL client for election data
const sql = neon(connectionString)

// Initialize database tables
export async function initDatabase() {
    try {
        // Create candidates table
        await sql`
            CREATE TABLE IF NOT EXISTS candidates (
                id SERIAL PRIMARY KEY,
                blockchain_id INTEGER,
                name VARCHAR(255) NOT NULL,
                party VARCHAR(255) NOT NULL,
                vote_count INTEGER DEFAULT 0,
                transaction_hash VARCHAR(66),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

        // Create voters table
        await sql`
            CREATE TABLE IF NOT EXISTS voters (
                id SERIAL PRIMARY KEY,
                firebase_uid VARCHAR(255) UNIQUE,
                wallet_address VARCHAR(42),
                is_registered BOOLEAN DEFAULT FALSE,
                has_voted BOOLEAN DEFAULT FALSE,
                voted_for INTEGER,
                transaction_hash VARCHAR(66),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

        // Migration: Add firebase_uid if missing
        try {
            await sql`ALTER TABLE voters ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE`
            await sql`ALTER TABLE voters ALTER COLUMN wallet_address DROP NOT NULL`
            await sql`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS election_id INTEGER`
        } catch (e) {
            console.log('Migration note:', e)
        }

        // Create elections table
        await sql`
            CREATE TABLE IF NOT EXISTS elections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                state VARCHAR(20) DEFAULT 'Created',
                contract_address VARCHAR(42),
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

        // Create transaction_logs table
        await sql`
            CREATE TABLE IF NOT EXISTS transaction_logs (
                id SERIAL PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                transaction_hash VARCHAR(66) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

        // ============================================
        // ZKP TABLES
        // ============================================

        // Voter commitments for ZKP voting
        await sql`
            CREATE TABLE IF NOT EXISTS voter_commitments (
                id SERIAL PRIMARY KEY,
                election_id INTEGER NOT NULL,
                commitment VARCHAR(66) NOT NULL,
                merkle_index INTEGER NOT NULL,
                firebase_uid VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(election_id, commitment)
            )
        `

        // Used nullifiers (double-spend protection)
        await sql`
            CREATE TABLE IF NOT EXISTS zkp_nullifiers (
                id SERIAL PRIMARY KEY,
                election_id INTEGER NOT NULL,
                nullifier_hash VARCHAR(66) NOT NULL,
                transaction_hash VARCHAR(66),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(election_id, nullifier_hash)
            )
        `

        // Merkle tree state
        await sql`
            CREATE TABLE IF NOT EXISTS zkp_merkle_trees (
                id SERIAL PRIMARY KEY,
                election_id INTEGER UNIQUE NOT NULL,
                merkle_root VARCHAR(66),
                leaf_count INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

        // Migration: Add zkp_enabled to elections
        try {
            await sql`ALTER TABLE elections ADD COLUMN IF NOT EXISTS zkp_enabled BOOLEAN DEFAULT FALSE`
            await sql`ALTER TABLE elections ADD COLUMN IF NOT EXISTS zkp_contract_address VARCHAR(42)`
        } catch (e) {
            console.log('ZKP migration note:', e)
        }

        console.log('✅ Database tables initialized')
        return true
    } catch (error) {
        console.error('❌ Database initialization error:', error)
        return false
    }
}

// Candidate operations
export async function addCandidateToDb(
    name: string,
    party: string,
    transactionHash: string,
    blockchainId?: number,
    electionId?: number
) {
    const result = await sql`
        INSERT INTO candidates (name, party, transaction_hash, blockchain_id, election_id)
        VALUES (${name}, ${party}, ${transactionHash}, ${blockchainId ?? null}, ${electionId ?? null})
        RETURNING *
    `
    return result[0]
}

export async function getCandidatesFromDb(electionId?: number) {
    if (electionId) {
        return await sql`SELECT * FROM candidates WHERE election_id = ${electionId} ORDER BY id ASC`
    }
    // Fallback or legacy: fetch all or those without election_id?
    // Better to fetch candidates for the latest election if no ID provided
    const latestElection = await getLatestElection()
    if (latestElection) {
        return await sql`SELECT * FROM candidates WHERE election_id = ${latestElection.id} ORDER BY id ASC`
    }

    return await sql`SELECT * FROM candidates ORDER BY id ASC`
}

export async function updateCandidateVoteCount(blockchainId: number, voteCount: number) {
    await sql`
        UPDATE candidates 
        SET vote_count = ${voteCount}, updated_at = CURRENT_TIMESTAMP
        WHERE blockchain_id = ${blockchainId}
    `
}

// Voter operations (blockchain)
export async function registerVoterInDb(walletAddress: string, transactionHash: string) {
    const result = await sql`
        INSERT INTO voters (wallet_address, is_registered, transaction_hash)
        VALUES (${walletAddress.toLowerCase()}, true, ${transactionHash})
        ON CONFLICT (wallet_address) DO UPDATE SET
            is_registered = true,
            transaction_hash = ${transactionHash}
        RETURNING *
    `
    return result[0]
}

export async function getVotersFromDb() {
    const voters = await sql`
        SELECT * FROM voters ORDER BY created_at DESC
    `
    return voters
}

export async function getVoterByFirebaseUid(firebaseUid: string): Promise<Voter | null> {
    const result = await sql`
    SELECT * FROM voters WHERE firebase_uid = ${firebaseUid}
  `;

    return result.length > 0 ? (result[0] as Voter) : null;
}

// Transaction logging
export async function logTransaction(
    action: string,
    transactionHash: string,
    data?: Record<string, any>
) {
    await sql`
        INSERT INTO transaction_logs (action, transaction_hash, data)
        VALUES (${action}, ${transactionHash}, ${JSON.stringify(data ?? {})})
    `
}

export async function getTransactionLogs(limit = 50) {
    const logs = await sql`
        SELECT * FROM transaction_logs 
        ORDER BY created_at DESC 
        LIMIT ${limit}
    `
    return logs
}

// Election operations
export async function getLatestElection() {
    const result = await sql`SELECT * FROM elections ORDER BY id DESC LIMIT 1`
    return result.length > 0 ? result[0] : null
}

export async function updateElectionState(state: string, contractAddress?: string, electionName?: string) {
    // Get or create current election
    const existing = await getLatestElection()

    if (!existing || (state === 'Created' && existing.state === 'Ended')) {
        // Create new election entry ONLY if explicitly starting 'Created' or if none exists
        // If state is 'Created' but we want to start a NEW one, we insert.
        // Logic: if existing is 'Ended' and we pass 'Created', new election.

        // If we are just updating the current election (e.g. Created -> Voting) we don't insert.
        if (existing && state !== 'Created') {
            // Update logic below
        } else {
            // Use provided name or default to 'New Election'
            const name = electionName || 'New Election'
            const result = await sql`
                INSERT INTO elections (name, state, contract_address)
                VALUES (${name}, ${state}, ${contractAddress ?? null})
                RETURNING *
            `
            return result[0]
        }
    }

    // Update existing
    const id = existing.id
    if (state === 'Voting') {
        await sql`
            UPDATE elections SET state = ${state}, started_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
        `
    } else if (state === 'Ended') {
        await sql`
            UPDATE elections SET state = ${state}, ended_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
        `
    } else {
        await sql`
            UPDATE elections SET state = ${state}
            WHERE id = ${id}
        `
    }
}

export { sql }
