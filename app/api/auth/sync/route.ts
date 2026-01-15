import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateUser, createAuditLog } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { firebaseUid, email, displayName, photoUrl, isSignup } = await request.json();

    if (!firebaseUid || !email) {
      return NextResponse.json(
        { error: 'Firebase UID and email are required' },
        { status: 400 }
      );
    }

    // Only create user if isSignup is true, otherwise just update
    let user;
    if (isSignup) {
      user = await createOrUpdateUser(firebaseUid, email, displayName, photoUrl);
    } else {
      // For login, only update existing user
      user = await getUserByFirebaseUid(firebaseUid);
      if (!user) {
        return NextResponse.json(
          { error: 'User not found. Please sign up first.' },
          { status: 404 }
        );
      }
    }

    // Log the authentication event (optional - don't fail if audit log fails)
    try {
      await createAuditLog(
        user.id,
        'USER_LOGIN',
        'user',
        user.id,
        request.headers.get('x-forwarded-for'),
        request.headers.get('user-agent'),
        { method: 'google_auth' }
      );
    } catch (auditError) {
      console.error('Failed to create audit log (non-critical):', auditError);
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Error syncing user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync user to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
