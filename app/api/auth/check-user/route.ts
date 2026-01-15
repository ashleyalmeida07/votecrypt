import { NextRequest, NextResponse } from 'next/server';
import { getUserByFirebaseUid, getUserByEmail } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { firebaseUid, email } = await request.json();

    if (!firebaseUid && !email) {
      return NextResponse.json(
        { error: 'Firebase UID or email is required' },
        { status: 400 }
      );
    }

    // Check if user exists in database
    let user = null;
    
    if (firebaseUid) {
      user = await getUserByFirebaseUid(firebaseUid);
    } else if (email) {
      user = await getUserByEmail(email);
    }

    return NextResponse.json({ 
      exists: user !== null,
      user: user ? {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified
      } : null
    });
  } catch (error) {
    console.error('Error checking user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check user in database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
