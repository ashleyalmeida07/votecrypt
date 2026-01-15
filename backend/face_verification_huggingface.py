"""
DeepFace-based Face Verification using ArcFace model
State-of-the-art accuracy with simple implementation
"""

import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any
import tempfile
import os

class HuggingFaceFaceVerifier:
    """
    Face verification using DeepFace with ArcFace model.
    99.8%+ accuracy - industry standard for face recognition.
    """
    
    def __init__(self, threshold: float = 0.25):
        """
        Initialize face verifier using DeepFace.
        
        Args:
            threshold: Cosine distance threshold (lower = stricter)
                      0.25 = very strict (recommended for voting)
                      0.30 = strict
                      0.40 = moderate
        """
        self.threshold = threshold
        self.min_face_size = 60
        self._deepface = None
        self._load_models()
    
    def _load_models(self):
        """Load DeepFace with ArcFace model"""
        try:
            from deepface import DeepFace
            self._deepface = DeepFace
            
            print("✓ DeepFace with ArcFace model loaded successfully")
            
        except ImportError:
            raise Exception(
                "DeepFace not installed. Install with: pip install deepface"
            )
        except Exception as e:
            raise Exception(f"Failed to load DeepFace model: {str(e)}")
    
    def _bytes_to_cv2(self, image_bytes: bytes) -> np.ndarray:
        """Convert image bytes to OpenCV format"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise Exception("Failed to decode image")
        return img
    
    def _get_face_embedding(self, image_path: str) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        """
        Extract face embedding from image using DeepFace.
        
        Returns:
            Tuple of (embedding, face_info)
        """
        try:
            # Use DeepFace to extract embedding with ArcFace model
            # detector_backend='opencv' is more reliable for voter IDs (less false positives)
            embedding_objs = self._deepface.represent(
                img_path=image_path,
                model_name='ArcFace',
                detector_backend='opencv',  # Changed from 'retinaface' - less sensitive
                enforce_detection=True,
                align=True
            )
            
            if not embedding_objs or len(embedding_objs) == 0:
                return None, {"error": "No face detected"}
            
            # If multiple faces detected, select the largest one (most likely the main face)
            if len(embedding_objs) > 1:
                print(f"  [INFO] Multiple faces detected ({len(embedding_objs)}), selecting largest face")
                # Sort by face area (width * height) and take the largest
                embedding_objs = sorted(
                    embedding_objs,
                    key=lambda x: x.get('facial_area', {}).get('w', 0) * x.get('facial_area', {}).get('h', 0),
                    reverse=True
                )
            
            # Get the embedding and face region (largest face if multiple)
            result = embedding_objs[0]
            embedding = np.array(result['embedding'])
            face_region = result.get('facial_area', {})
            
            # Calculate face size
            face_size = (
                face_region.get('w', 0),
                face_region.get('h', 0)
            )
            
            # Check face size
            if face_size[0] < self.min_face_size or face_size[1] < self.min_face_size:
                return None, {
                    "error": f"Face too small: {face_size[0]}x{face_size[1]} (min: {self.min_face_size}x{self.min_face_size})"
                }
            
            face_info = {
                "bbox": [
                    face_region.get('x', 0),
                    face_region.get('y', 0),
                    face_region.get('x', 0) + face_region.get('w', 0),
                    face_region.get('y', 0) + face_region.get('h', 0)
                ],
                "confidence": result.get('face_confidence', 0.9),
                "face_size": face_size,
                "embedding_dim": len(embedding)
            }
            
            return embedding, face_info
            
        except ValueError as e:
            # DeepFace raises ValueError when no face is detected
            return None, {"error": "No face detected"}
        except Exception as e:
            return None, {"error": f"Face detection failed: {str(e)}"}
    
    def verify_faces(self, id_image_bytes: bytes, selfie_image_bytes: bytes) -> Dict[str, Any]:
        """
        Verify if two face images match using DeepFace ArcFace.
        
        Args:
            id_image_bytes: ID photo as bytes
            selfie_image_bytes: Selfie photo as bytes
            
        Returns:
            Verification result with similarity score
        """
        try:
            print(f"\n{'='*70}")
            print("DEEPFACE FACE VERIFICATION - ArcFace Model")
            print(f"{'='*70}\n")
            
            # Convert images and save to temp files (DeepFace needs file paths)
            id_image = self._bytes_to_cv2(id_image_bytes)
            selfie_image = self._bytes_to_cv2(selfie_image_bytes)
            
            # Save to temp files
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as id_tmp:
                cv2.imwrite(id_tmp.name, id_image)
                id_tmp_path = id_tmp.name
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as selfie_tmp:
                cv2.imwrite(selfie_tmp.name, selfie_image)
                selfie_tmp_path = selfie_tmp.name
            
            try:
                print(f"[1/3] Processing ID image ({id_image.shape[1]}x{id_image.shape[0]})...")
                id_embedding, id_info = self._get_face_embedding(id_tmp_path)
                
                if id_embedding is None:
                    return {
                        "verified": False,
                        "message": f"ID image: {id_info['error']}",
                        "error": "id_face_error",
                        "similarity": None
                    }
                
                print(f"  ✓ Face detected (confidence: {id_info['confidence']:.3f}, size: {id_info['face_size'][0]}x{id_info['face_size'][1]})")
                
                print(f"\n[2/3] Processing selfie image ({selfie_image.shape[1]}x{selfie_image.shape[0]})...")
                selfie_embedding, selfie_info = self._get_face_embedding(selfie_tmp_path)
                
                if selfie_embedding is None:
                    return {
                        "verified": False,
                        "message": f"Selfie: {selfie_info['error']}",
                        "error": "selfie_face_error",
                        "similarity": None
                    }
                
                print(f"  ✓ Face detected (confidence: {selfie_info['confidence']:.3f}, size: {selfie_info['face_size'][0]}x{selfie_info['face_size'][1]})")
                
                # Calculate cosine similarity
                print(f"\n[3/3] Comparing faces...")
                
                # Normalize embeddings
                id_norm = id_embedding / np.linalg.norm(id_embedding)
                selfie_norm = selfie_embedding / np.linalg.norm(selfie_embedding)
                
                # Cosine similarity
                similarity = float(np.dot(id_norm, selfie_norm))
                
                # Convert to distance for consistency
                distance = 1.0 - similarity
                
                # Verify
                is_verified = distance < self.threshold
                
                print(f"  Similarity: {similarity:.4f}")
                print(f"  Distance: {distance:.4f}")
                print(f"  Threshold: {self.threshold}")
                print(f"  Result: {'✓ VERIFIED' if is_verified else '✗ REJECTED'}")
                
                print(f"\n{'='*70}")
                print(f"FINAL RESULT: {'✓ MATCH' if is_verified else '✗ NO MATCH'}")
                print(f"{'='*70}\n")
                
                if is_verified:
                    message = f"✓ Face verified successfully! (similarity: {similarity*100:.1f}%)"
                else:
                    message = f"✗ Face verification failed. Faces do not match (similarity: {similarity*100:.1f}%)"
                
                return {
                    "verified": is_verified,
                    "message": message,
                    "similarity": round(similarity, 4),
                    "distance": round(distance, 4),
                    "threshold": self.threshold,
                    "similarity_percentage": round(similarity * 100, 2),
                    "id_face_confidence": round(id_info['confidence'], 4),
                    "selfie_face_confidence": round(selfie_info['confidence'], 4),
                    "model": "DeepFace (ArcFace)",
                    "embedding_dimension": id_info['embedding_dim']
                }
            
            finally:
                # Clean up temp files
                try:
                    os.unlink(id_tmp_path)
                    os.unlink(selfie_tmp_path)
                except:
                    pass
                
        except Exception as e:
            print(f"\n[ERROR] Verification failed: {str(e)}")
            return {
                "verified": False,
                "message": f"Verification error: {str(e)}",
                "error": "internal_error",
                "similarity": None
            }


# Global instance
_hf_verifier: Optional[HuggingFaceFaceVerifier] = None


def get_hf_verifier(threshold: float = 0.25) -> HuggingFaceFaceVerifier:
    """Get or create HuggingFace verifier singleton"""
    global _hf_verifier
    if _hf_verifier is None:
        _hf_verifier = HuggingFaceFaceVerifier(threshold=threshold)
    return _hf_verifier


def verify_face_huggingface(id_image_bytes: bytes, selfie_image_bytes: bytes,
                            threshold: float = 0.25) -> Dict[str, Any]:
    """
    Verify faces using DeepFace ArcFace model.
    
    Args:
        id_image_bytes: ID photo as bytes
        selfie_image_bytes: Selfie photo as bytes
        threshold: Distance threshold (0.25 = very strict, recommended)
        
    Returns:
        Verification result
    """
    verifier = get_hf_verifier(threshold)
    return verifier.verify_faces(id_image_bytes, selfie_image_bytes)
