-- Add voter_id_url and voter_id_verified columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS voter_id_url TEXT,
ADD COLUMN IF NOT EXISTS voter_id_verified BOOLEAN DEFAULT FALSE;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_voter_id_verified ON users(voter_id_verified);
