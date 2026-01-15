import { NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';

export async function GET() {
  try {
    const result = await vercelSql`
      SELECT 
        firebase_uid,
        email,
        display_name,
        voter_id_verified,
        voter_id_url IS NOT NULL as has_voter_id,
        created_at,
        updated_at
      FROM users
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      users: result.rows,
      total: result.rows.length
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get users' },
      { status: 500 }
    );
  }
}
