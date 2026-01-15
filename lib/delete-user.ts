import { sql as vercelSql } from '@vercel/postgres';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Delete a user and their associated voter ID file from Firebase Storage
 */
export async function deleteUserWithFiles(firebaseUid: string): Promise<boolean> {
  try {
    // Get user's voter ID URL before deletion
    const userResult = await vercelSql`
      SELECT voter_id_url FROM users WHERE firebase_uid = ${firebaseUid}
    `;

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const voterIdUrl = userResult.rows[0].voter_id_url;

    // Delete from voters table first (foreign key constraint)
    await vercelSql`
      DELETE FROM voters WHERE firebase_uid = ${firebaseUid}
    `;

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

    return true;
  } catch (error) {
    console.error('Delete user with files error:', error);
    throw error;
  }
}

/**
 * Delete only the voter ID file for a user (without deleting the user)
 */
export async function deleteVoterIdFile(firebaseUid: string): Promise<boolean> {
  try {
    // Get user's voter ID URL
    const userResult = await vercelSql`
      SELECT voter_id_url FROM users WHERE firebase_uid = ${firebaseUid}
    `;

    if (userResult.rows.length === 0 || !userResult.rows[0].voter_id_url) {
      return false;
    }

    const voterIdUrl = userResult.rows[0].voter_id_url;

    // Delete file from Firebase Storage
    const urlParts = voterIdUrl.split('/o/')[1];
    if (urlParts) {
      const filePath = decodeURIComponent(urlParts.split('?')[0]);
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
    }

    // Update user record to remove voter ID URL
    await vercelSql`
      UPDATE users 
      SET 
        voter_id_url = NULL,
        voter_id_verified = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE firebase_uid = ${firebaseUid}
    `;

    return true;
  } catch (error) {
    console.error('Delete voter ID file error:', error);
    throw error;
  }
}
