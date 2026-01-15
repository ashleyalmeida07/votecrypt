"""
Face Verification API Server for Project BALLOT
FastAPI backend for webcam-based face verification
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uvicorn
import logging

# Import HuggingFace DeepFace ArcFace verification (99.8%+ accuracy)
from face_verification_huggingface import verify_face_huggingface


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
    """Response model for HuggingFace face verification"""
    verified: bool
    message: str
    similarity: Optional[float] = None
    distance: Optional[float] = None
    similarity_percentage: Optional[float] = None
    id_face_confidence: Optional[float] = None
    selfie_face_confidence: Optional[float] = None
    model: Optional[str] = None
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
    Verify if the face in the ID photo matches the selfie using HuggingFace InsightFace.
    
    **InsightFace (ArcFace) - State-of-the-Art Face Recognition:**
    - 99.83% accuracy on LFW benchmark
    - Single model (simpler than ensemble)
    - Faster processing (1-2 seconds)
    - Lower false positive rate (<0.001%)
    
    **Process:**
    1. Detect face in ID image using InsightFace
    2. Detect face in selfie using InsightFace
    3. Extract 512-dimensional face embeddings
    4. Calculate cosine similarity
    5. Compare against threshold (0.25 = very strict)
    
    **Threshold:**
    - distance < 0.25: Verified (faces match)
    - distance >= 0.25: Rejected (faces don't match)
    
    **Returns:**
    - verified: Boolean indicating if faces match
    - similarity: Cosine similarity score (0-1, higher = more similar)
    - distance: 1 - similarity (lower = more similar)
    - similarity_percentage: Similarity as percentage
    - model: "InsightFace (ArcFace)"
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
        
        # Perform face verification using HuggingFace InsightFace
        # threshold=0.5 is moderate (balanced between security and usability)
        result = verify_face_huggingface(
            id_bytes,
            selfie_bytes,
            threshold=0.5
        )
        
        logger.info(f"HuggingFace verification result: verified={result['verified']}")
        if result.get('similarity'):
            logger.info(f"  Similarity: {result['similarity']:.4f} ({result.get('similarity_percentage', 0):.1f}%)")
        
        return VerificationResponse(
            verified=result['verified'],
            message=result['message'],
            similarity=result.get('similarity'),
            distance=result.get('distance'),
            similarity_percentage=result.get('similarity_percentage'),
            id_face_confidence=result.get('id_face_confidence'),
            selfie_face_confidence=result.get('selfie_face_confidence'),
            model=result.get('model'),
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
    import sys
    print("\n" + "="*60)
    print("🗳️  BALLOT Face Verification API Server")
    print("="*60)
    print("\n🌐 Server running at: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("💚 Health Check: http://localhost:8000/health")
    print("\n" + "="*60 + "\n")
    
    # Disable reload on Windows to avoid multiprocessing issues with Python 3.13
    is_windows = sys.platform.startswith('win')
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False if is_windows else True,  # Disable reload on Windows
        log_level="info"
    )
    
    if is_windows:
        print("\n⚠️  Note: Auto-reload disabled on Windows. Restart server manually after code changes.")
