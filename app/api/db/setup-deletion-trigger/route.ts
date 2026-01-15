import { NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';

export async function POST() {
  try {
    // Create deleted_voter_ids table
    await vercelSql`
      CREATE TABLE IF NOT EXISTS deleted_voter_ids (
        id SERIAL PRIMARY KEY,
        firebase_uid TEXT NOT NULL,
        voter_id_url TEXT NOT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cleaned_up BOOLEAN DEFAULT FALSE,
        cleaned_up_at TIMESTAMP
      )
    `;

    // Create index
    await vercelSql`
      CREATE INDEX IF NOT EXISTS idx_deleted_voter_ids_cleaned_up 
      ON deleted_voter_ids(cleaned_up)
    `;

    // Create function
    await vercelSql`
      CREATE OR REPLACE FUNCTION log_voter_id_for_cleanup()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.voter_id_url IS NOT NULL THEN
          INSERT INTO deleted_voter_ids (firebase_uid, voter_id_url)
          VALUES (OLD.firebase_uid, OLD.voter_id_url);
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql
    `;

    // Drop existing trigger if any
    await vercelSql`
      DROP TRIGGER IF EXISTS before_user_delete_trigger ON users
    `;

    // Create trigger
    await vercelSql`
      CREATE TRIGGER before_user_delete_trigger
        BEFORE DELETE ON users
        FOR EACH ROW
        EXECUTE FUNCTION log_voter_id_for_cleanup()
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Deletion trigger setup completed successfully' 
    });
  } catch (error: any) {
    console.error('Setup trigger error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
