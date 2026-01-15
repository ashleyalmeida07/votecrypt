import { NextRequest, NextResponse } from 'next/server';
import { getUserByFirebaseUid } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { firebaseUid, selfieImage } = await request.json();

    console.log('=== FACE VERIFICATION REQUEST ===');
    console.log('Firebase UID:', firebaseUid);

    if (!firebaseUid || !selfieImage) {
      return NextResponse.json(
        { error: 'Firebase UID and selfie image are required' },
        { status: 400 }
      );
    }

    // Get user's voter ID URL from database
    const user = await getUserByFirebaseUid(firebaseUid);
    
    console.log('User found:', user ? 'YES' : 'NO');
    console.log('User email:', user?.email);
    console.log('Voter ID URL:', user?.voter_id_url);
    
    if (!user || !user.voter_id_url) {
      return NextResponse.json(
        { error: 'Voter ID not found. Please upload your voter ID first.' },
        { status: 404 }
      );
    }

    // Fetch the voter ID image from Firebase Storage
    console.log('Fetching voter ID image from:', user.voter_id_url);
    const voterIdResponse = await fetch(user.voter_id_url);
    if (!voterIdResponse.ok) {
      console.error('Failed to fetch voter ID:', voterIdResponse.status, voterIdResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch voter ID image' },
        { status: 500 }
      );
    }

    const voterIdBlob = await voterIdResponse.blob();
    console.log('Voter ID blob size:', voterIdBlob.size, 'bytes');
    
    // Convert base64 selfie to blob
    const selfieBase64 = selfieImage.split(',')[1];
    const selfieBuffer = Buffer.from(selfieBase64, 'base64');
    const selfieBlob = new Blob([selfieBuffer], { type: 'image/jpeg' });
    console.log('Selfie blob size:', selfieBlob.size, 'bytes');

    // Create FormData for backend API
    const formData = new FormData();
    formData.append('id_image', voterIdBlob, 'voter_id.jpg');
    formData.append('selfie_image', selfieBlob, 'selfie.jpg');

    // Call Python backend face verification API
    const backendUrl = process.env.FACE_VERIFICATION_API_URL || 'http://localhost:8000';
    console.log('Calling backend at:', `${backendUrl}/verify-face`);
    const verifyResponse = await fetch(`${backendUrl}/verify-face`, {
      method: 'POST',
      body: formData,
    });

    const verifyData = await verifyResponse.json();
    console.log('Backend response:', verifyData);
    console.log('=== END VERIFICATION REQUEST ===\n');

    return NextResponse.json({
      verified: verifyData.verified,
      distance: verifyData.distance,
      message: verifyData.message,
      id_face_confidence: verifyData.id_face_confidence,
      selfie_face_confidence: verifyData.selfie_face_confidence,
      similarity_percentage: verifyData.similarity_percentage,
      error: verifyData.error
    });

  } catch (error: any) {
    console.error('Face verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify face' },
      { status: 500 }
    );
  }
}
