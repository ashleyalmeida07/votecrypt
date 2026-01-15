import { NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';

export async function GET() {
  try {
    // Check if voter_id columns exist
    const columnsCheck = await vercelSql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('voter_id_url', 'voter_id_verified')
      ORDER BY column_name
    `;

    // Check if trigger exists
    const triggerCheck = await vercelSql`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'before_user_delete_trigger'
    `;

    // Check if deleted_voter_ids table exists
    const tableCheck = await vercelSql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'deleted_voter_ids'
    `;

    // Get sample user data
    const sampleUsers = await vercelSql`
      SELECT 
        firebase_uid,
        email,
        voter_id_url IS NOT NULL as has_voter_id_url,
        voter_id_verified
      FROM users
      LIMIT 5
    `;

    return NextResponse.json({
      columns: {
        exist: columnsCheck.rows.length === 2,
        details: columnsCheck.rows
      },
      trigger: {
        exist: triggerCheck.rows.length > 0,
        details: triggerCheck.rows
      },
      cleanupTable: {
        exist: tableCheck.rows.length > 0
      },
      sampleUsers: sampleUsers.rows,
      status: columnsCheck.rows.length === 2 && triggerCheck.rows.length > 0 ? 'ready' : 'needs_migration'
    });

  } catch (error: any) {
    console.error('Verify setup error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
