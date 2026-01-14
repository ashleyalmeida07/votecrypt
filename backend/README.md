# BALLOT Face Verification Module

AI-powered face verification for the blockchain voting system. Uses YOLO for face detection and DeepFace (ArcFace) for face matching.

## 📁 Project Structure

```
votecrypt/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # FastAPI server with /verify-face endpoint
│   ├── face_verification.py    # Face detection & matching logic
│   ├── requirements.txt        # Python dependencies
│   ├── run.sh                  # Linux/macOS startup script
│   └── run.bat                 # Windows startup script
│
├── app/
│   └── verify-face/
│       └── page.tsx            # Next.js face verification UI
│
└── ...                         # Other project files
```

## 🚀 Quick Start

### 1. Start the Backend (Python FastAPI)

```bash
# Navigate to backend folder
cd backend

# Option A: Using the run script (recommended)
chmod +x run.sh
./run.sh

# Option B: Manual setup
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The backend will start at: **http://localhost:8000**
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 2. Start the Frontend (Next.js)

```bash
# In the project root directory
pnpm install
pnpm dev
```

The frontend will start at: **http://localhost:3000**
- Face Verification Page: http://localhost:3000/verify-face

## 🔧 API Reference

### POST /verify-face

Verify if the face in an ID photo matches a live selfie.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `id_image`: ID photo file (JPEG/PNG)
  - `selfie_image`: Live selfie file (JPEG/PNG)

**Response:**
```json
{
  "verified": true,
  "distance": 0.34,
  "message": "Face matched successfully",
  "id_face_confidence": 0.95,
  "selfie_face_confidence": 0.92
}
```

**Error Response:**
```json
{
  "verified": false,
  "distance": null,
  "message": "No face detected in selfie",
  "error": "no_face_in_selfie"
}
```

## 🎯 Verification Threshold

- **Distance < 0.45**: ✅ Verified (faces match)
- **Distance >= 0.45**: ❌ Rejected (faces don't match)

The distance is a cosine similarity measure between face embeddings. Lower values indicate more similar faces.

## 🧪 Demo Testing

### Test Case 1: Match ✅
1. Upload a clear ID photo of yourself
2. Capture a live selfie with similar lighting
3. Click "Verify Face"
4. Expected: `verified: true`, distance around 0.2-0.4

### Test Case 2: Mismatch ❌
1. Upload an ID photo of a different person
2. Capture your own selfie
3. Click "Verify Face"
4. Expected: `verified: false`, distance > 0.45

### Test Case 3: No Face Detected
1. Upload a photo without a clear face
2. Expected: Error message "No face detected in ID image"

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **YOLO v8**: Real-time face detection
- **DeepFace**: Face verification with ArcFace model
- **OpenCV**: Image processing
- **Uvicorn**: ASGI server

### Frontend
- **Next.js 14**: React framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first styling
- **WebRTC**: Browser webcam access

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```env
# API URL (default: http://localhost:8000)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Adjusting Verification Threshold

Edit `backend/main.py`:
```python
result = verify_face_match(id_bytes, selfie_bytes, threshold=0.45)
```

- Lower threshold (0.3): Stricter matching
- Higher threshold (0.5): More lenient matching

## 🔒 Privacy & Security

- Images are processed in memory only
- Temporary files are immediately deleted
- No facial data is stored or logged
- All communication should use HTTPS in production

## 📝 Error Codes

| Error Code | Description |
|------------|-------------|
| `no_face_in_id` | No face detected in ID photo |
| `no_face_in_selfie` | No face detected in selfie |
| `quality_check_failed` | Image quality too low (blurry) |
| `verification_error` | Face verification processing error |
| `internal_error` | Server-side error |

## 🚀 Production Deployment

### Backend (Render/Railway/Docker)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/ .

RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend (Vercel)

```bash
# Set environment variable in Vercel dashboard
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

## 🐛 Troubleshooting

### Camera not working
- Ensure browser has camera permissions
- Check if another app is using the camera
- Try a different browser

### Backend won't start
- Check Python version (3.9+ required)
- Ensure all dependencies installed: `pip install -r requirements.txt`
- Check if port 8000 is available

### Face not detected
- Ensure good lighting
- Face should be clearly visible
- Remove glasses/hats if possible
- Image should be at least 100x100 pixels

### High distance scores on same person
- Ensure similar lighting in both photos
- Face should be at similar angles
- Both images should be clear and not blurry

## 📄 License

Part of Project BALLOT - Blockchain Voting System
