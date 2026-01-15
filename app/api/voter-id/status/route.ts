import { NextRequest, NextResponse } from 'next/server';
import { getUserVoterId } from '@/lib/db-voter-id';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const firebaseUid = searchParams.get('firebaseUid');

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID is required' },
        { status: 400 }
      );
    }

    const voterIdInfo = await getUserVoterId(firebaseUid);

    if (!voterIdInfo) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      hasVoterId: !!voterIdInfo.voter_id_url,
      isVerified: voterIdInfo.voter_id_verified,
      voterIdUrl: voterIdInfo.voter_id_url
    });
  } catch (error: any) {
    console.error('Get voter ID status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get voter ID status' },
      { status: 500 }
    );
  }
}
