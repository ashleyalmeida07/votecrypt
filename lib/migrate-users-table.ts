import { sql } from '@vercel/postgres';

/**
 * Migration: Remove phone verification columns and add email_verified
 * Run this once to update the users table schema
 */
export async function migrateUsersTable() {
  try {
    console.log('🔄 Starting users table migration...');
    
    // Add email_verified column if it doesn't exist
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false
    `;
    console.log('✅ Added email_verified column');
    
    // Drop phone verification columns if they exist
    await sql`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS phone_number,
      DROP COLUMN IF EXISTS phone_verified
    `;
    console.log('✅ Removed phone_number and phone_verified columns');
    
    console.log('🎉 Migration completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
