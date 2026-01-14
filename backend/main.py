"""
Face Verification API Server for Project BALLOT
FastAPI backend for webcam-based face verification
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging

from face_verification import verify_face_match, FaceVerificationError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="BALLOT Face Verification API",
    description="Face verification service for blockchain voting system",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VerificationResponse(BaseModel):
    """Response model for face verification"""
    verified: bool
    distance: Optional[float] = None
    message: str
    id_face_confidence: Optional[float] = None
    selfie_face_confidence: Optional[float] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    service: str
    version: str


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check"""
    return HealthResponse(
        status="healthy",
        service="BALLOT Face Verification API",
        version="1.0.0"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="BALLOT Face Verification API",
        version="1.0.0"
    )


@app.post("/verify-face", response_model=VerificationResponse)
async def verify_face(
    id_image: UploadFile = File(..., description="ID photo with face"),
    selfie_image: UploadFile = File(..., description="Live selfie capture")
):
    """
    Verify if the face in the ID photo matches the selfie.
    
    **Process:**
    1. Detect faces in both images using YOLO
    2. Crop face regions with padding
    3. Compare faces using DeepFace (ArcFace model)
    4. Return verification result with distance score
    
    **Thresholds:**
    - distance < 0.45: Verified (faces match)
    - distance >= 0.45: Rejected (faces don't match)
    
    **Returns:**
    - verified: Boolean indicating if faces match
    - distance: Cosine distance between face embeddings (lower = more similar)
    - message: Human-readable result message
    """
    logger.info(f"Received verification request - ID: {id_image.filename}, Selfie: {selfie_image.filename}")
    
    # Validate file types
    allowed_types = {'image/jpeg', 'image/png', 'image/jpg', 'image/webp'}
    
    if id_image.content_type not in allowed_types:
        logger.warning(f"Invalid ID image type: {id_image.content_type}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ID image type. Allowed: {', '.join(allowed_types)}"
        )
    
    if selfie_image.content_type not in allowed_types:
        logger.warning(f"Invalid selfie image type: {selfie_image.content_type}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid selfie image type. Allowed: {', '.join(allowed_types)}"
        )
    
    try:
        # Read image bytes
        id_bytes = await id_image.read()
        selfie_bytes = await selfie_image.read()
        
        # Validate file sizes (max 10MB each)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(id_bytes) > max_size:
            raise HTTPException(status_code=400, detail="ID image too large (max 10MB)")
        if len(selfie_bytes) > max_size:
            raise HTTPException(status_code=400, detail="Selfie image too large (max 10MB)")
        
        logger.info(f"Processing images - ID: {len(id_bytes)} bytes, Selfie: {len(selfie_bytes)} bytes")
        
        # Perform face verification
        result = verify_face_match(id_bytes, selfie_bytes, threshold=0.45)
        
        logger.info(f"Verification result: verified={result['verified']}, distance={result.get('distance')}")
        
        return VerificationResponse(
            verified=result['verified'],
            distance=result.get('distance'),
            message=result['message'],
            id_face_confidence=result.get('id_face_confidence'),
            selfie_face_confidence=result.get('selfie_face_confidence'),
            error=result.get('error')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {str(e)}", exc_info=True)
        return VerificationResponse(
            verified=False,
            distance=None,
            message=f"Verification failed: {str(e)}",
            error="server_error"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "verified": False,
            "distance": None,
            "message": "Internal server error",
            "error": "internal_error"
        }
    )


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🗳️  BALLOT Face Verification API Server")
    print("="*60)
    print("\n📍 Server running at: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔧 Health Check: http://localhost:8000/health")
    print("\n" + "="*60 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
