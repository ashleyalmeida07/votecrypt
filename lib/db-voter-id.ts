// Helper function to update user's voter ID information
import { sql as vercelSql } from '@vercel/postgres';

export async function updateUserVoterId(
  firebaseUid: string,
  voterIdUrl: string,
  verified: boolean = true
): Promise<void> {
  await vercelSql`
    UPDATE users 
    SET 
      voter_id_url = ${voterIdUrl},
      voter_id_verified = ${verified},
      updated_at = CURRENT_TIMESTAMP
    WHERE firebase_uid = ${firebaseUid}
  `;
}

export async function getUserVoterId(firebaseUid: string): Promise<{
  voter_id_url: string | null;
  voter_id_verified: boolean;
} | null> {
  const result = await vercelSql`
    SELECT voter_id_url, voter_id_verified 
    FROM users 
    WHERE firebase_uid = ${firebaseUid}
  `;

  return result.rows.length > 0 ? result.rows[0] : null;
}
