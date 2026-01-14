import { NextResponse } from 'next/server';
import { migrateUsersTable } from '@/lib/migrate-users-table';

/**
 * API endpoint to run database migration
 * Visit: http://localhost:3000/api/migrate-db
 */
export async function GET() {
  try {
    await migrateUsersTable();
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Migration failed' 
      },
      { status: 500 }
    );
  }
}
