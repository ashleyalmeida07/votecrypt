import { neon } from '@neondatabase/serverless'

// Get connection string from environment
const connectionString = process.env.NEON_DB!

// Create SQL client
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
                wallet_address VARCHAR(42) NOT NULL UNIQUE,
                is_registered BOOLEAN DEFAULT FALSE,
                has_voted BOOLEAN DEFAULT FALSE,
                voted_for INTEGER,
                transaction_hash VARCHAR(66),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `

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
    blockchainId?: number
) {
    const result = await sql`
        INSERT INTO candidates (name, party, transaction_hash, blockchain_id)
        VALUES (${name}, ${party}, ${transactionHash}, ${blockchainId ?? null})
        RETURNING *
    `
    return result[0]
}

export async function getCandidatesFromDb() {
    const candidates = await sql`
        SELECT * FROM candidates ORDER BY id ASC
    `
    return candidates
}

export async function updateCandidateVoteCount(blockchainId: number, voteCount: number) {
    await sql`
        UPDATE candidates 
        SET vote_count = ${voteCount}, updated_at = CURRENT_TIMESTAMP
        WHERE blockchain_id = ${blockchainId}
    `
}

// Voter operations
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
export async function updateElectionState(state: string, contractAddress?: string) {
    // Get or create current election
    const existing = await sql`SELECT * FROM elections ORDER BY id DESC LIMIT 1`

    if (existing.length === 0 || state === 'Created') {
        // Create new election entry
        await sql`
            INSERT INTO elections (name, state, contract_address)
            VALUES ('Election', ${state}, ${contractAddress ?? null})
        `
    } else {
        // Update existing
        const updates: Record<string, any> = { state }
        if (state === 'Voting') {
            await sql`
                UPDATE elections SET state = ${state}, started_at = CURRENT_TIMESTAMP
                WHERE id = ${existing[0].id}
            `
        } else if (state === 'Ended') {
            await sql`
                UPDATE elections SET state = ${state}, ended_at = CURRENT_TIMESTAMP
                WHERE id = ${existing[0].id}
            `
        } else {
            await sql`
                UPDATE elections SET state = ${state}
                WHERE id = ${existing[0].id}
            `
        }
    }
}

export { sql }
