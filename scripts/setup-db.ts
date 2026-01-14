import { sql } from '@vercel/postgres';

async function setupDatabase() {
  try {
    console.log('Creating users table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Users table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    
    console.log('✓ Indexes created');
    
    // Optional: Create audit_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Audit logs table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`;
    
    console.log('✅ Database setup complete!');
    
    // Test query
    const result = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`Users table has ${result.rows[0].count} records`);
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  }
}

setupDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
