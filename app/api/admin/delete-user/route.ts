import { NextRequest, NextResponse } from 'next/server';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { sql as vercelSql } from '@vercel/postgres';

export async function DELETE(request: NextRequest) {
  try {
    const { firebaseUid, isAdmin } = await request.json();

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID is required' },
        { status: 400 }
      );
    }

    // Get user's voter ID URL before deletion
    const userResult = await vercelSql`
      SELECT voter_id_url FROM users WHERE firebase_uid = ${firebaseUid}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const voterIdUrl = userResult.rows[0].voter_id_url;

    // Delete user from database
    await vercelSql`
      DELETE FROM users WHERE firebase_uid = ${firebaseUid}
    `;

    // Delete voter ID file from Firebase Storage if it exists
    if (voterIdUrl) {
      try {
        // Extract the file path from the URL
        const urlParts = voterIdUrl.split('/o/')[1];
        if (urlParts) {
          const filePath = decodeURIComponent(urlParts.split('?')[0]);
          const fileRef = ref(storage, filePath);
          await deleteObject(fileRef);
          console.log('Deleted voter ID file from Firebase Storage:', filePath);
        }
      } catch (storageError) {
        console.error('Failed to delete file from Firebase Storage:', storageError);
        // Continue even if storage deletion fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User and associated files deleted successfully',
      deletedVoterIdFile: !!voterIdUrl
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
