import { NextRequest, NextResponse } from 'next/server';
import { getUserByFirebaseUid } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { firebaseUid } = await req.json();

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Missing firebaseUid' },
        { status: 400 }
      );
    }

    const user = await getUserByFirebaseUid(firebaseUid);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      phoneVerified: user.phone_verified || false 
    });
  } catch (error) {
    console.error('Error checking phone verification:', error);
    return NextResponse.json(
      { error: 'Failed to check phone verification status' },
      { status: 500 }
    );
  }
}
