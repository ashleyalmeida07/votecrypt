import { NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';

export async function POST() {
  try {
    // Add voter_id_url and voter_id_verified columns
    await vercelSql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS voter_id_url TEXT,
      ADD COLUMN IF NOT EXISTS voter_id_verified BOOLEAN DEFAULT FALSE
    `;

    // Add index for quick lookup
    await vercelSql`
      CREATE INDEX IF NOT EXISTS idx_users_voter_id_verified ON users(voter_id_verified)
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Voter ID columns added successfully' 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
