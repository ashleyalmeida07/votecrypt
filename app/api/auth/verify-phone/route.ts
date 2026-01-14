import { NextRequest, NextResponse } from 'next/server';
import { updatePhoneVerification } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { firebaseUid, phoneNumber } = await req.json();

    if (!firebaseUid || !phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update user's phone verification status in database
    const user = await updatePhoneVerification(firebaseUid, phoneNumber);

    return NextResponse.json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error('Error verifying phone:', error);
    return NextResponse.json(
      { error: 'Failed to verify phone number' },
      { status: 500 }
    );
  }
}
