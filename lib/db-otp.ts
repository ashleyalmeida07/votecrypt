import { sql } from '@vercel/postgres';

// Create OTP table if it doesn't exist
export async function createOtpTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ OTP table created/verified');
  } catch (error) {
    console.error('Failed to create OTP table:', error);
    throw error;
  }
}

// Store OTP in database
export async function storeOtp(sessionId: string, email: string, otp: string, expiresAt: number): Promise<boolean> {
  try {
    // Check if there's a recent OTP for this email (within last 30 seconds)
    const recentCheck = await sql`
      SELECT created_at FROM otps 
      WHERE email = ${email} 
      AND created_at > NOW() - INTERVAL '30 seconds'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (recentCheck.rows.length > 0) {
      return false; // Don't send duplicate OTP within 30 seconds
    }
    
    // Delete any existing OTP for this session
    await sql`DELETE FROM otps WHERE session_id = ${sessionId}`;
    
    // Delete any old OTPs for this email
    await sql`DELETE FROM otps WHERE email = ${email}`;
    
    // Insert new OTP
    await sql`
      INSERT INTO otps (session_id, email, otp, expires_at)
      VALUES (${sessionId}, ${email}, ${otp}, ${expiresAt})
    `;
    return true;
  } catch (error) {
    console.error('Failed to store OTP:', error);
    throw error;
  }
}

// Retrieve and verify OTP
export async function verifyOtp(sessionId: string, otp: string) {
  try {
    const result = await sql`
      SELECT email, otp, expires_at 
      FROM otps 
      WHERE session_id = ${sessionId}
    `;

    if (result.rows.length === 0) {
      return { success: false, error: 'OTP expired or not found' };
    }

    const stored = result.rows[0];

    // Check expiration
    if (Date.now() > stored.expires_at) {
      // Delete expired OTP
      await sql`DELETE FROM otps WHERE session_id = ${sessionId}`;
      return { success: false, error: 'OTP has expired' };
    }

    // Verify OTP
    if (stored.otp !== otp) {
      return { success: false, error: 'Invalid OTP' };
    }

    // OTP is valid, delete it
    await sql`DELETE FROM otps WHERE session_id = ${sessionId}`;
    
    return { success: true, email: stored.email };
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    throw error;
  }
}

// Clean up expired OTPs (run periodically)
export async function cleanupExpiredOtps() {
  try {
    const result = await sql`
      DELETE FROM otps 
      WHERE expires_at < ${Date.now()}
    `;
    console.log(`🧹 Cleaned up ${result.rowCount} expired OTPs`);
  } catch (error) {
    console.error('Failed to cleanup OTPs:', error);
  }
}
