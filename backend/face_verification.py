"""
Face Verification Module for Project BALLOT
Uses YOLO for face detection and DeepFace for face matching
"""

import cv2
import numpy as np
from PIL import Image
from io import BytesIO
from typing import Tuple, Optional, Dict, Any
from ultralytics import YOLO
import tempfile
import os


class FaceVerificationError(Exception):
    """Custom exception for face verification errors"""
    pass


class FaceVerifier:
    """
    Face verification class using YOLO for detection and DeepFace for matching.
    Optimized for CPU inference without any model training.
    """
    
    def __init__(self, distance_threshold: float = 0.45):
        """
        Initialize the face verifier.
        
        Args:
            distance_threshold: Maximum distance for faces to be considered a match.
                               Lower values are more strict.
        """
        self.distance_threshold = distance_threshold
        self.yolo_model = None
        self._deepface = None  # Lazy-loaded DeepFace module
        self._load_yolo_model()
    
    def _load_yolo_model(self):
        """Load YOLO model for face detection"""
        try:
            # Use YOLOv8 face detection model
            # If yolov8n-face isn't available, fallback to general model
            try:
                self.yolo_model = YOLO('yolov8n-face.pt')
            except Exception:
                # Fallback to standard YOLOv8 nano model
                self.yolo_model = YOLO('yolov8n.pt')
                print("Using general YOLO model - face detection may be less accurate")
        except Exception as e:
            raise FaceVerificationError(f"Failed to load YOLO model: {str(e)}")
    
    def _bytes_to_cv2(self, image_bytes: bytes) -> np.ndarray:
        """Convert image bytes to OpenCV format"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise FaceVerificationError("Failed to decode image")
        return img
    
    def _detect_faces_yolo(self, image: np.ndarray) -> list:
        """
        Detect faces in image using YOLO.
        
        Returns:
            List of face bounding boxes with confidence scores
        """
        results = self.yolo_model(image, verbose=False)
        faces = []
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get class name - check if it's a person/face
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id].lower()
                
                # Accept 'face' or 'person' class
                if 'face' in cls_name or 'person' in cls_name:
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    faces.append({
                        'bbox': (x1, y1, x2, y2),
                        'confidence': conf
                    })
        
        # If using person detection, we need to detect face within person region
        # For now, if no faces found, try using DeepFace's built-in detector as fallback
        if not faces:
            faces = self._detect_faces_fallback(image)
        
        return faces
    
    def _detect_faces_fallback(self, image: np.ndarray) -> list:
        """
        Fallback face detection using OpenCV Haar cascades.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        detected = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        faces = []
        for (x, y, w, h) in detected:
            faces.append({
                'bbox': (x, y, x + w, y + h),
                'confidence': 0.8  # Default confidence for Haar cascade
            })
        
        return faces
    
    def _crop_face(self, image: np.ndarray, bbox: Tuple[int, int, int, int], 
                   padding: float = 0.2) -> np.ndarray:
        """
        Crop face region from image with padding.
        
        Args:
            image: Input image
            bbox: Bounding box (x1, y1, x2, y2)
            padding: Padding ratio around the face
        """
        x1, y1, x2, y2 = bbox
        h, w = image.shape[:2]
        
        # Calculate padding
        face_w = x2 - x1
        face_h = y2 - y1
        pad_w = int(face_w * padding)
        pad_h = int(face_h * padding)
        
        # Apply padding with bounds checking
        x1 = max(0, x1 - pad_w)
        y1 = max(0, y1 - pad_h)
        x2 = min(w, x2 + pad_w)
        y2 = min(h, y2 + pad_h)
        
        return image[y1:y2, x1:x2]
    
    def _check_image_quality(self, image: np.ndarray) -> Tuple[bool, str]:
        """
        Check if image quality is sufficient for face verification.
        
        Returns:
            Tuple of (is_valid, message)
        """
        # Check image size
        h, w = image.shape[:2]
        if h < 50 or w < 50:
            return False, "Image too small for face detection"
        
        # Check for blur using Laplacian variance
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        if laplacian_var < 50:
            return False, "Image is too blurry"
        
        return True, "Image quality OK"
    
    def _select_best_face(self, faces: list) -> Optional[dict]:
        """Select the face with highest confidence"""
        if not faces:
            return None
        return max(faces, key=lambda x: x['confidence'])
    
    def verify_faces(self, id_image_bytes: bytes, selfie_image_bytes: bytes) -> Dict[str, Any]:
        """
        Verify if the face in ID image matches the face in selfie.
        
        Args:
            id_image_bytes: ID photo as bytes
            selfie_image_bytes: Selfie photo as bytes
            
        Returns:
            Dictionary with verification result
        """
        try:
            # Convert images
            id_image = self._bytes_to_cv2(id_image_bytes)
            selfie_image = self._bytes_to_cv2(selfie_image_bytes)
            
            # Check image quality
            id_quality, id_msg = self._check_image_quality(id_image)
            if not id_quality:
                return {
                    "verified": False,
                    "distance": None,
                    "message": f"ID image issue: {id_msg}",
                    "error": "quality_check_failed"
                }
            
            selfie_quality, selfie_msg = self._check_image_quality(selfie_image)
            if not selfie_quality:
                return {
                    "verified": False,
                    "distance": None,
                    "message": f"Selfie issue: {selfie_msg}",
                    "error": "quality_check_failed"
                }
            
            # Detect faces in ID image
            id_faces = self._detect_faces_yolo(id_image)
            if not id_faces:
                return {
                    "verified": False,
                    "distance": None,
                    "message": "No face detected in ID image",
                    "error": "no_face_in_id"
                }
            
            # Detect faces in selfie
            selfie_faces = self._detect_faces_yolo(selfie_image)
            if not selfie_faces:
                return {
                    "verified": False,
                    "distance": None,
                    "message": "No face detected in selfie",
                    "error": "no_face_in_selfie"
                }
            
            # Log if multiple faces detected
            multiple_faces_warning = None
            if len(id_faces) > 1:
                multiple_faces_warning = "Multiple faces in ID - using highest confidence"
            if len(selfie_faces) > 1:
                multiple_faces_warning = "Multiple faces in selfie - using highest confidence"
            
            # Select best faces
            best_id_face = self._select_best_face(id_faces)
            best_selfie_face = self._select_best_face(selfie_faces)
            
            # Crop face regions
            id_face_crop = self._crop_face(id_image, best_id_face['bbox'])
            selfie_face_crop = self._crop_face(selfie_image, best_selfie_face['bbox'])
            
            # Save cropped faces to temp files for DeepFace
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as id_tmp:
                cv2.imwrite(id_tmp.name, id_face_crop)
                id_tmp_path = id_tmp.name
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as selfie_tmp:
                cv2.imwrite(selfie_tmp.name, selfie_face_crop)
                selfie_tmp_path = selfie_tmp.name
            
            try:
                # Import DeepFace lazily here to avoid import-time dependency
                # issues in environments without TensorFlow.
                if self._deepface is None:
                    try:
                        from deepface import DeepFace as _DeepFace
                        self._deepface = _DeepFace
                    except Exception as e:
                        raise FaceVerificationError(
                            f"DeepFace/TensorFlow is not available: {e}"
                        )

                # Compare faces using DeepFace with ArcFace model
                result = self._deepface.verify(
                    img1_path=id_tmp_path,
                    img2_path=selfie_tmp_path,
                    model_name="ArcFace",
                    detector_backend="skip",  # We already detected and cropped faces
                    enforce_detection=False,
                    distance_metric="cosine"
                )
                
                distance = result.get('distance', 1.0)
                is_verified = distance < self.distance_threshold
                
                message = "Face matched successfully" if is_verified else "Face mismatch detected"
                if multiple_faces_warning and is_verified:
                    message += f" ({multiple_faces_warning})"
                
                return {
                    "verified": is_verified,
                    "distance": round(distance, 4),
                    "message": message,
                    "id_face_confidence": round(best_id_face['confidence'], 4),
                    "selfie_face_confidence": round(best_selfie_face['confidence'], 4)
                }
                
            finally:
                # Clean up temp files
                os.unlink(id_tmp_path)
                os.unlink(selfie_tmp_path)
                
        except FaceVerificationError as e:
            return {
                "verified": False,
                "distance": None,
                "message": str(e),
                "error": "verification_error"
            }
        except Exception as e:
            return {
                "verified": False,
                "distance": None,
                "message": f"Verification failed: {str(e)}",
                "error": "internal_error"
            }


# Global instance for reuse
_verifier_instance: Optional[FaceVerifier] = None


def get_verifier(distance_threshold: float = 0.45) -> FaceVerifier:
    """Get or create the face verifier singleton"""
    global _verifier_instance
    if _verifier_instance is None:
        _verifier_instance = FaceVerifier(distance_threshold=distance_threshold)
    return _verifier_instance


def verify_face_match(id_image_bytes: bytes, selfie_image_bytes: bytes, 
                      threshold: float = 0.45) -> Dict[str, Any]:
    """
    Convenience function to verify face match.
    
    Args:
        id_image_bytes: ID photo as bytes
        selfie_image_bytes: Selfie photo as bytes
        threshold: Distance threshold for matching
        
    Returns:
        Verification result dictionary
    """
    verifier = get_verifier(distance_threshold=threshold)
    return verifier.verify_faces(id_image_bytes, selfie_image_bytes)
