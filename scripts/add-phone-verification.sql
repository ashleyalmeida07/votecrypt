-- Add phone verification columns to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Update existing users to have phone_verified = false
UPDATE users SET phone_verified = false WHERE phone_verified IS NULL;
