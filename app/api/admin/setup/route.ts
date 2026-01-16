import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    // Security: You might want to add authentication here
    // For now, just run once manually

    console.log('Creating admin_users table...')
    
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    console.log('✓ Admin users table created')
    
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`
    
    console.log('✓ Index created')
    
    // Insert authorized admin emails
    await sql`
      INSERT INTO admin_users (email, display_name, is_active) 
      VALUES 
        ('crce.10367.aids@gmail.com', 'Admin 1', true),
        ('crce.10246.ceb@gmail.com', 'Admin 2', true)
      ON CONFLICT (email) DO NOTHING
    `
    
    console.log('✓ Admin emails inserted')
    
    // Display records
    const result = await sql`SELECT * FROM admin_users`
    
    return NextResponse.json({
      success: true,
      message: 'Admin users table created successfully',
      adminUsers: result.rows
    })
    
  } catch (error) {
    console.error('❌ Error setting up admin users:', error)
    return NextResponse.json(
      { error: 'Failed to setup admin users', details: error },
      { status: 500 }
    )
  }
}
