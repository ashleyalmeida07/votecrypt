-- Complete users table structure with voter_id_url column
-- Run this if you need to verify or recreate the table

-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('voter_id_url', 'voter_id_verified');

-- If columns don't exist, add them:
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS voter_id_url TEXT,
ADD COLUMN IF NOT EXISTS voter_id_verified BOOLEAN DEFAULT FALSE;

-- Expected users table structure:
/*
users table:
- id SERIAL PRIMARY KEY
- firebase_uid TEXT UNIQUE NOT NULL
- email TEXT NOT NULL
- display_name TEXT
- photo_url TEXT
- email_verified BOOLEAN DEFAULT FALSE
- voter_id_url TEXT                    ← Firebase Storage URL
- voter_id_verified BOOLEAN DEFAULT FALSE
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
*/
