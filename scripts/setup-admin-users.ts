import { sql } from '@vercel/postgres';

// Run with: POSTGRES_URL="your-url" npx tsx scripts/setup-admin-users.ts
// Or set POSTGRES_URL in .env.local and Next.js will load it

async function setupAdminUsers() {
  try {
    if (!process.env.POSTGRES_URL) {
      console.error('❌ POSTGRES_URL environment variable is not set');
      console.log('Please set it in your .env.local file or run with:');
      console.log('POSTGRES_URL="your-connection-string" npx tsx scripts/setup-admin-users.ts');
      process.exit(1);
    }

    console.log('Creating admin_users table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✓ Admin users table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`;
    
    console.log('✓ Index created');
    
    // Insert authorized admin emails
    await sql`
      INSERT INTO admin_users (email, display_name, is_active) 
      VALUES 
        ('crce.10367.aids@gmail.com', 'Admin 1', true),
        ('crce.10246.ceb@gmail.com', 'Admin 2', true)
      ON CONFLICT (email) DO NOTHING
    `;
    
    console.log('✓ Admin emails inserted');
    
    // Display records
    const result = await sql`SELECT * FROM admin_users`;
    console.log('\n✅ Admin Users:');
    console.table(result.rows);
    
    console.log('\n✅ Admin user setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up admin users:', error);
    throw error;
  }
}

setupAdminUsers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
