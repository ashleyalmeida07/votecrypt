import { sql } from '@vercel/postgres';

export interface User {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Voter {
  id: number;
  user_id: number;
  voter_id: string;
  national_id: string;
  full_name: string;
  is_verified: boolean;
}

export async function createOrUpdateUser(
  firebaseUid: string,
  email: string,
  displayName: string | null,
  photoUrl: string | null
): Promise<User> {
  const result = await sql`
    INSERT INTO users (firebase_uid, email, display_name, photo_url, email_verified)
    VALUES (${firebaseUid}, ${email}, ${displayName}, ${photoUrl}, false)
    ON CONFLICT (firebase_uid) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      photo_url = EXCLUDED.photo_url,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  
  return result.rows[0] as User;
}

export async function updateEmailVerification(
  firebaseUid: string
): Promise<User> {
  const result = await sql`
    UPDATE users 
    SET email_verified = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE firebase_uid = ${firebaseUid}
    RETURNING *
  `;
  
  return result.rows[0] as User;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE firebase_uid = ${firebaseUid}
  `;
  
  return result.rows.length > 0 ? (result.rows[0] as User) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email}
  `;
  
  return result.rows.length > 0 ? (result.rows[0] as User) : null;
}

export async function getVoterByUserId(userId: number): Promise<Voter | null> {
  const result = await sql`
    SELECT * FROM voters WHERE user_id = ${userId}
  `;
  
  return result.rows.length > 0 ? (result.rows[0] as Voter) : null;
}

export async function createAuditLog(
  userId: number | null,
  action: string,
  entityType: string | null,
  entityId: number | null,
  ipAddress: string | null,
  userAgent: string | null,
  details: any
) {
  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
    VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${ipAddress}, ${userAgent}, ${JSON.stringify(details)})
  `;
}
