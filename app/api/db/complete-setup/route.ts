import { NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';

export async function POST() {
  try {
    const results = {
      step1: { success: false, message: '' },
      step2: { success: false, message: '' },
      step3: { success: false, message: '' }
    };

    // Step 1: Add voter_id columns to users table
    try {
      await vercelSql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS voter_id_url TEXT,
        ADD COLUMN IF NOT EXISTS voter_id_verified BOOLEAN DEFAULT FALSE
      `;
      
      await vercelSql`
        CREATE INDEX IF NOT EXISTS idx_users_voter_id_verified 
        ON users(voter_id_verified)
      `;
      
      results.step1.success = true;
      results.step1.message = 'voter_id_url and voter_id_verified columns added';
    } catch (error: any) {
      results.step1.message = error.message;
    }

    // Step 2: Create deleted_voter_ids table
    try {
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

      await vercelSql`
        CREATE INDEX IF NOT EXISTS idx_deleted_voter_ids_cleaned_up 
        ON deleted_voter_ids(cleaned_up)
      `;

      results.step2.success = true;
      results.step2.message = 'deleted_voter_ids table created';
    } catch (error: any) {
      results.step2.message = error.message;
    }

    // Step 3: Create trigger function and trigger
    try {
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

      await vercelSql`
        DROP TRIGGER IF EXISTS before_user_delete_trigger ON users
      `;

      await vercelSql`
        CREATE TRIGGER before_user_delete_trigger
          BEFORE DELETE ON users
          FOR EACH ROW
          EXECUTE FUNCTION log_voter_id_for_cleanup()
      `;

      results.step3.success = true;
      results.step3.message = 'Deletion trigger created';
    } catch (error: any) {
      results.step3.message = error.message;
    }

    const allSuccess = results.step1.success && results.step2.success && results.step3.success;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Complete setup successful!' : 'Some steps failed',
      details: results
    });

  } catch (error: any) {
    console.error('Complete setup error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
