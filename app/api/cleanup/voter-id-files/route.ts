import { NextRequest, NextResponse } from 'next/server';
import { sql as vercelSql } from '@vercel/postgres';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    // Get all uncleaned voter ID files
    const result = await vercelSql`
      SELECT id, firebase_uid, voter_id_url 
      FROM deleted_voter_ids 
      WHERE cleaned_up = FALSE
      ORDER BY deleted_at ASC
      LIMIT 100
    `;

    const cleanupResults = {
      total: result.rows.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each file
    for (const row of result.rows) {
      try {
        // Extract file path from URL
        const urlParts = row.voter_id_url.split('/o/')[1];
        if (urlParts) {
          const filePath = decodeURIComponent(urlParts.split('?')[0]);
          const fileRef = ref(storage, filePath);
          
          // Delete from Firebase Storage
          await deleteObject(fileRef);
          
          // Mark as cleaned up
          await vercelSql`
            UPDATE deleted_voter_ids 
            SET 
              cleaned_up = TRUE,
              cleaned_up_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
          
          cleanupResults.success++;
          console.log(`Cleaned up file for user ${row.firebase_uid}: ${filePath}`);
        } else {
          throw new Error('Invalid URL format');
        }
      } catch (error: any) {
        cleanupResults.failed++;
        cleanupResults.errors.push(`Failed to cleanup ${row.firebase_uid}: ${error.message}`);
        console.error(`Failed to cleanup file for user ${row.firebase_uid}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup process completed',
      results: cleanupResults
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup deleted voter IDs' },
      { status: 500 }
    );
  }
}

// GET endpoint to view pending cleanups
export async function GET() {
  try {
    const result = await vercelSql`
      SELECT 
        COUNT(*) FILTER (WHERE cleaned_up = FALSE) as pending,
        COUNT(*) FILTER (WHERE cleaned_up = TRUE) as completed,
        COUNT(*) as total
      FROM deleted_voter_ids
    `;

    const details = await vercelSql`
      SELECT id, firebase_uid, deleted_at, cleaned_up, cleaned_up_at
      FROM deleted_voter_ids
      WHERE cleaned_up = FALSE
      ORDER BY deleted_at DESC
      LIMIT 50
    `;

    return NextResponse.json({
      stats: result.rows[0],
      pendingCleanups: details.rows
    });
  } catch (error: any) {
    console.error('Get cleanup status error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
