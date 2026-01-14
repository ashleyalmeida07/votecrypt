import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/db-otp';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const { email, otp, sessionId, firebaseUid } = await request.json();

    if (!email || !otp || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify OTP from database
    const result = await verifyOtp(sessionId, otp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Mark email as verified in users table if firebaseUid is provided
    if (firebaseUid) {
      try {
        await sql`
          UPDATE users 
          SET email_verified = true,
              updated_at = CURRENT_TIMESTAMP
          WHERE firebase_uid = ${firebaseUid}
        `;
      } catch (dbError) {
        // Don't fail the request if DB update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
