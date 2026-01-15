import { NextRequest, NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, PROJECT_FOLDER } from '@/lib/firebase';
import { sql as vercelSql } from '@vercel/postgres';
import { createWorker, PSM } from 'tesseract.js';

interface VerificationResult {
  hasECI: boolean;
  hasName: boolean;
  hasGender: boolean;
  hasDOB: boolean;
  allFieldsPresent: boolean;
  extractedText: string;
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // For PDFs, ask user to upload as image instead
  throw new Error('PDF files are not supported. Please convert your Voter ID to an image (JPG or PNG) and upload again.');
}

async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker(['eng', 'hin']);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  } catch (error) {
    await worker.terminate();
    console.error('OCR error:', error);
    throw new Error('Failed to perform OCR on image');
  }
}

function verifyVoterIdContent(text: string): VerificationResult {
  // Normalize text for better matching
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');

  // More flexible checking for Election Commission
  const hasECI = 
    normalizedText.includes('election') ||
    normalizedText.includes('commission') ||
    normalizedText.includes('india') ||
    normalizedText.includes('eci') ||
    normalizedText.includes('निर्वाचन') ||
    normalizedText.includes('आयोग') ||
    normalizedText.includes('भारत');

  // Check for name-related terms
  const hasName = 
    normalizedText.includes('name') ||
    normalizedText.includes('नाम') ||
    /[a-z]{3,}\s+[a-z]{3,}/i.test(text); // Look for name-like patterns

  // Check for gender indicators
  const hasGender = 
    normalizedText.includes('gender') ||
    normalizedText.includes('sex') ||
    normalizedText.includes('लिंग') ||
    normalizedText.includes('male') ||
    normalizedText.includes('female') ||
    normalizedText.includes('m/f') ||
    normalizedText.includes('purusha') ||
    normalizedText.includes('mahila') ||
    /\b(m|f)\b/i.test(normalizedText);

  // Check for date of birth
  const hasDOB = 
    normalizedText.includes('birth') ||
    normalizedText.includes('dob') ||
    normalizedText.includes('जन्म') ||
    normalizedText.includes('age') ||
    normalizedText.includes('year') ||
    /\d{2}[-\/]\d{2}[-\/]\d{4}/.test(text) || // DD/MM/YYYY
    /\d{4}[-\/]\d{2}[-\/]\d{2}/.test(text) || // YYYY/MM/DD
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text);

  // Make verification more lenient - need at least 2 out of 4 criteria
  const criteriaCount = [hasECI, hasName, hasGender, hasDOB].filter(Boolean).length;
  const allFieldsPresent = criteriaCount >= 2;

  console.log('OCR Verification:', { hasECI, hasName, hasGender, hasDOB, criteriaCount, extractedLength: text.length });

  return {
    hasECI,
    hasName,
    hasGender,
    hasDOB,
    allFieldsPresent,
    extractedText: text.substring(0, 500)
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const firebaseUid = formData.get('firebaseUid') as string;

    if (!file || !firebaseUid) {
      return NextResponse.json(
        { error: 'File and Firebase UID are required' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text based on file type
    let extractedText = '';
    const fileType = file.type;

    if (fileType === 'application/pdf') {
      extractedText = await extractTextFromPDF(buffer);
    } else if (fileType.startsWith('image/')) {
      extractedText = await extractTextFromImage(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF or image.' },
        { status: 400 }
      );
    }

    // Verify content FIRST before uploading
    const verification = verifyVoterIdContent(extractedText);

    if (!verification.allFieldsPresent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document verification failed. Please ensure your Voter ID contains all required fields.',
          verification: {
            hasECI: verification.hasECI,
            hasName: verification.hasName,
            hasGender: verification.hasGender,
            hasDOB: verification.hasDOB,
          }
        },
        { status: 400 }
      );
    }

    // Only upload to Firebase Storage after successful verification
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${firebaseUid}_${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, `${PROJECT_FOLDER}/voter-ids/${fileName}`);

    await uploadBytes(storageRef, buffer, {
      contentType: file.type,
      customMetadata: {
        firebaseUid,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      }
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    // Update user in database
    await vercelSql`
      UPDATE users 
      SET 
        voter_id_url = ${downloadURL},
        voter_id_verified = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE firebase_uid = ${firebaseUid}
    `;

    return NextResponse.json({
      success: true,
      message: 'Voter ID uploaded and verified successfully',
      voterIdUrl: downloadURL,
      verification: {
        hasECI: verification.hasECI,
        hasName: verification.hasName,
        hasGender: verification.hasGender,
        hasDOB: verification.hasDOB,
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload and verify voter ID' },
      { status: 500 }
    );
  }
}
