-- Create admin_users table for authorized admin access
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Insert the authorized admin emails
INSERT INTO admin_users (email, display_name, is_active) 
VALUES 
  ('crce.10367.aids@gmail.com', 'Admin 1', true),
  ('crce.10246.ceb@gmail.com', 'Admin 2', true)
ON CONFLICT (email) DO NOTHING;

-- Display inserted records
SELECT * FROM admin_users;
