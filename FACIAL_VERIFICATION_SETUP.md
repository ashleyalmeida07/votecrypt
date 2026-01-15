# Facial Verification Integration Setup

## Overview
This document describes the facial verification system that has been integrated into the BALLOT voting system. Users must now complete live facial verification after email OTP verification before accessing the dashboard.

## System Architecture

### Frontend (Next.js)
- **Live Webcam Capture**: `/app/verify-face/page.tsx`
- **Verification API Proxy**: `/app/api/face/verify/route.ts`
- **Flow Integration**: Updated `/app/verify-phone/page.tsx` to redirect to face verification

### Backend (Python FastAPI)
- **Face Verification API**: `/backend/main.py`
- **Face Detection & Matching**: `/backend/face_verification.py`
- **Models**: YOLO v8 (face detection) + DeepFace with ArcFace (face matching)

## Authentication Flow

### Updated User Journey
1. **Signup** → Google OAuth authentication
2. **Email OTP** → Verify email address
3. **Voter ID Upload** → OCR verification of voter ID card (if not done)
4. **🆕 Live Facial Verification** → Compare live selfie with voter ID photo
5. **Dashboard** → Access voting portal

### Key Changes
- After OTP verification, users are redirected to `/verify-face` instead of directly to dashboard
- The system fetches the user's voter ID image from Firebase Storage
- Live webcam capture compares against the voter ID photo
- Only verified users can access the dashboard

## Technical Implementation

### 1. Live Webcam Capture Component
**File**: `/app/verify-face/page.tsx`

Features:
- Uses `react-webcam` library for camera access
- Mirrored view for user convenience
- Face guide overlay (4:3 aspect ratio)
- Real-time capture and preview
- Verification status display (success/failed)
- Retry functionality
- Tips for best results

### 2. Facial Verification API Proxy
**File**: `/app/api/face/verify/route.ts`

Responsibilities:
- Receives `firebaseUid` and `selfieImage` (base64) from frontend
- Fetches voter ID image from Firebase Storage using database URL
- Converts both images to blob format
- Creates FormData and forwards to Python backend
- Returns verification result with distance metrics

### 3. Python Backend API
**File**: `/backend/main.py`

Endpoint: `POST /verify-face`
- Accepts two file uploads: `id_image` and `selfie_image`
- Validates file types (JPEG, PNG, WebP)
- Checks file sizes (max 10MB each)
- Calls face verification logic
- Returns structured response with verification status

**File**: `/backend/face_verification.py`

Features:
- YOLO v8 face detection (with Haar cascade fallback)
- DeepFace face matching using ArcFace model
- Distance threshold: 0.45 (lower = stricter matching)
- Confidence scores for both faces
- Error handling for missing faces or multiple faces

### 4. Environment Configuration
**File**: `.env.local`

```env
FACE_VERIFICATION_API_URL=http://localhost:8000
```

### 5. Dependencies

#### Frontend
```json
{
  "react-webcam": "^7.2.0"
}
```

#### Backend
```txt
fastapi==0.109.2
uvicorn[standard]==0.27.1
python-multipart==0.0.9
opencv-python==4.10.0.84
ultralytics>=8.1.0
deepface>=0.0.89
tf-keras>=2.15.0
```

## Security Features

1. **Live Detection**: Uses real-time webcam feed (not uploaded photos)
2. **Firebase Storage Integration**: Fetches voter ID from secure storage
3. **Distance Threshold**: Configurable matching sensitivity (0.45 default)
4. **Face Detection**: YOLO ensures valid face exists in both images
5. **Single Face Policy**: Rejects images with multiple or zero faces
6. **Confidence Scores**: Returns detection confidence for transparency

## Usage Instructions

### For Developers

#### Start Backend Server
```bash
cd backend
python main.py
```

Server will run on `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

#### Start Frontend Server
```bash
npm run dev
```

Server will run on `http://localhost:3000`

### For Users

1. **Complete Signup**: Register with Google account
2. **Verify Email**: Enter 6-digit OTP sent to email
3. **Upload Voter ID**: (if first time) Upload voter ID card image
4. **Face Verification**:
   - Allow camera permissions in browser
   - Position face within the guide frame
   - Ensure good lighting
   - Remove sunglasses or face coverings
   - Click "Capture Photo"
   - Review captured image
   - Click "Verify Face"
5. **Wait for Verification**: System compares faces
6. **Access Dashboard**: On success, redirected to voting portal

## Verification Results

### Success Response
```json
{
  "verified": true,
  "distance": 0.32,
  "message": "Faces match successfully",
  "id_face_confidence": 0.95,
  "selfie_face_confidence": 0.98
}
```

### Failure Response
```json
{
  "verified": false,
  "distance": 0.67,
  "message": "Faces do not match",
  "id_face_confidence": 0.92,
  "selfie_face_confidence": 0.89
}
```

## Troubleshooting

### Backend Issues

**Problem**: Backend server exits immediately
**Solution**: Check Python dependencies are installed
```bash
pip install -r backend/requirements.txt
```

**Problem**: "Module not found" errors
**Solution**: Ensure you're in the correct virtual environment

**Problem**: Port 8000 already in use
**Solution**: Change port in `main.py` or kill existing process

### Frontend Issues

**Problem**: Camera access denied
**Solution**: Allow camera permissions in browser settings

**Problem**: "Failed to fetch voter ID image"
**Solution**: Ensure Firebase Storage URL is valid and accessible

**Problem**: "Verification failed" repeatedly
**Solution**: 
- Ensure good lighting
- Face directly at camera
- Try removing glasses/masks
- Check if voter ID photo has clear face

### Network Issues

**Problem**: "Failed to connect to backend"
**Solution**: 
- Ensure backend is running on port 8000
- Check `.env.local` has correct `FACE_VERIFICATION_API_URL`
- Verify CORS settings allow localhost:3000

## Performance Considerations

- **Face Detection**: ~200-500ms per image (CPU)
- **Face Matching**: ~1-2s per comparison (CPU)
- **Total Verification Time**: ~2-3 seconds average
- **GPU Acceleration**: Optional (install CUDA-enabled TensorFlow)

## Future Enhancements

1. **Liveness Detection**: Detect photo/video spoofing
2. **Face Angle Validation**: Ensure frontal face capture
3. **Blink Detection**: Additional anti-spoofing measure
4. **Progressive Web App**: Offline facial verification
5. **Mobile Optimization**: Better camera handling on mobile
6. **Batch Verification**: Admin panel to verify multiple users

## API Documentation

### Frontend API: `/api/face/verify`
**Method**: POST
**Request**:
```json
{
  "firebaseUid": "string",
  "selfieImage": "data:image/jpeg;base64,..."
}
```

**Response**:
```json
{
  "verified": boolean,
  "distance": number,
  "message": string,
  "id_face_confidence": number,
  "selfie_face_confidence": number
}
```

### Backend API: `/verify-face`
**Method**: POST
**Content-Type**: multipart/form-data
**Form Fields**:
- `id_image`: File (voter ID image)
- `selfie_image`: File (live captured selfie)

**Response**: Same as frontend API

## Security Considerations

1. **Data Privacy**: Face embeddings not stored, only compared
2. **Temporary Storage**: Backend uses temp files, auto-deleted
3. **HTTPS Required**: Use HTTPS in production
4. **Rate Limiting**: Implement to prevent brute-force attempts
5. **Audit Logging**: Log verification attempts for security

## Support

For issues or questions:
1. Check terminal logs (backend and frontend)
2. Review browser console errors
3. Test backend API directly: `http://localhost:8000/docs`
4. Ensure all dependencies installed
5. Verify environment variables configured

---

**Last Updated**: January 2025
**Status**: ✅ Implemented and Integrated
