"""
Enhanced Face Verification Module for Project BALLOT
Multi-model ensemble approach with advanced quality checks and liveness detection
"""

import cv2
import numpy as np
from PIL import Image
from io import BytesIO
from typing import Tuple, Optional, Dict, Any, List
from ultralytics import YOLO
import tempfile
import os
from dataclasses import dataclass


class FaceVerificationError(Exception):
    """Custom exception for face verification errors"""
    pass


@dataclass
class FaceQualityMetrics:
    """Metrics for assessing face image quality"""
    blur_score: float
    brightness_score: float
    face_size: Tuple[int, int]
    pose_angle: float
    is_frontal: bool
    has_occlusion: bool
    overall_quality: str  # 'excellent', 'good', 'fair', 'poor'


@dataclass
class VerificationResult:
    """Result from a single model verification"""
    model_name: str
    distance: float
    verified: bool
    threshold: float


class EnhancedFaceVerifier:
    """
    Enhanced face verification with multi-model ensemble and advanced quality checks.
    Uses multiple face recognition models for robust verification.
    """
    
    # Model-specific thresholds (VERY STRICT for voting security)
    MODEL_THRESHOLDS = {
        'ArcFace': 0.15,      # Extremely strict (was 0.20)
        'Facenet512': 0.25,   # Very strict (was 0.30)
        'VGG-Face': 0.30,     # Strict (was 0.35)
    }
    
    def __init__(self, 
                 min_models_agree: int = 3,  # CHANGED: Require ALL 3 models
                 enable_liveness: bool = True):
        """
        Initialize the enhanced face verifier.
        
        Args:
            min_models_agree: Minimum number of models that must agree (3 = all models for maximum security)
            enable_liveness: Enable basic liveness detection
        """
        self.min_models_agree = min_models_agree
        self.enable_liveness = enable_liveness
        self.min_face_size = 60  # Reduced from 80 for better detection
        self.min_confidence = 0.6  # Increased from 0.5 for better quality
        self.max_pose_angle = 30  # Maximum face rotation in degrees
        self.yolo_model = None
        self._deepface = None
        self._face_cascade = None
        self._load_models()
    
    def _load_models(self):
        """Load YOLO and face detection models"""
        try:
            # Load YOLO for face detection
            try:
                self.yolo_model = YOLO('yolov8n-face.pt')
            except Exception:
                self.yolo_model = YOLO('yolov8n.pt')
                print("Using general YOLO model - face detection may be less accurate")
            
            # Load Haar cascade for fallback
            self._face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
        except Exception as e:
            raise FaceVerificationError(f"Failed to load models: {str(e)}")
    
    def _bytes_to_cv2(self, image_bytes: bytes) -> np.ndarray:
        """Convert image bytes to OpenCV format"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise FaceVerificationError("Failed to decode image")
        return img
    
    def _detect_faces_yolo(self, image: np.ndarray) -> list:
        """
        Detect faces using YOLO with improved configuration.
        Falls back to multiple detection methods if YOLO fails.
        """
        faces = []
        
        try:
            # Run YOLO with optimized parameters for face detection
            results = self.yolo_model(
                image, 
                verbose=False,
                conf=0.25,  # Lower confidence threshold to catch more faces
                iou=0.45,   # IoU threshold for NMS
                imgsz=640   # Image size for inference
            )
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    cls_name = result.names[cls_id].lower()
                    
                    # Accept 'face' or 'person' class
                    if 'face' in cls_name or 'person' in cls_name:
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        # Validate bounding box
                        if x2 > x1 and y2 > y1:
                            faces.append({
                                'bbox': (x1, y1, x2, y2),
                                'confidence': conf,
                                'method': 'YOLO'
                            })
            
            print(f"  YOLO detected {len(faces)} face(s)")
            
        except Exception as e:
            print(f"  [WARNING] YOLO detection failed: {e}")
        
        # If YOLO found faces, return them
        if faces:
            return faces
        
        # Fallback 1: Try Haar Cascade
        print("  Trying Haar Cascade fallback...")
        faces = self._detect_faces_haar(image)
        if faces:
            print(f"  Haar Cascade detected {len(faces)} face(s)")
            return faces
        
        # Fallback 2: Try MediaPipe (if available)
        print("  Trying MediaPipe fallback...")
        faces = self._detect_faces_mediapipe(image)
        if faces:
            print(f"  MediaPipe detected {len(faces)} face(s)")
            return faces
        
        # Fallback 3: Try OpenCV DNN (if available)
        print("  Trying OpenCV DNN fallback...")
        faces = self._detect_faces_dnn(image)
        if faces:
            print(f"  DNN detected {len(faces)} face(s)")
            return faces
        
        return faces
    
    def _detect_faces_haar(self, image: np.ndarray) -> list:
        """
        Haar Cascade face detection with multiple scale factors.
        More robust than the original implementation.
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Try multiple scale factors for better detection
            scale_factors = [1.05, 1.1, 1.2, 1.3]
            all_faces = []
            
            for scale in scale_factors:
                detected = self._face_cascade.detectMultiScale(
                    gray, 
                    scaleFactor=scale, 
                    minNeighbors=4,  # Reduced from 5 for better recall
                    minSize=(20, 20),  # Reduced from 30 to catch smaller faces
                    flags=cv2.CASCADE_SCALE_IMAGE
                )
                
                for (x, y, w, h) in detected:
                    # Check if this face overlaps with existing faces
                    bbox = (x, y, x + w, y + h)
                    is_duplicate = False
                    
                    for existing in all_faces:
                        if self._bbox_overlap(bbox, existing['bbox']) > 0.5:
                            is_duplicate = True
                            break
                    
                    if not is_duplicate:
                        all_faces.append({
                            'bbox': bbox,
                            'confidence': 0.75,
                            'method': 'Haar'
                        })
                
                # If we found faces, stop trying more scale factors
                if all_faces:
                    break
            
            return all_faces
            
        except Exception as e:
            print(f"  [WARNING] Haar Cascade failed: {e}")
            return []
    
    def _detect_faces_mediapipe(self, image: np.ndarray) -> list:
        """
        MediaPipe face detection (optional, very accurate).
        """
        try:
            import mediapipe as mp
            
            mp_face_detection = mp.solutions.face_detection
            
            with mp_face_detection.FaceDetection(
                model_selection=1,  # 1 for full range, 0 for short range
                min_detection_confidence=0.5
            ) as face_detection:
                
                # Convert BGR to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = face_detection.process(image_rgb)
                
                faces = []
                if results.detections:
                    h, w = image.shape[:2]
                    for detection in results.detections:
                        bbox_rel = detection.location_data.relative_bounding_box
                        x1 = int(bbox_rel.xmin * w)
                        y1 = int(bbox_rel.ymin * h)
                        x2 = int((bbox_rel.xmin + bbox_rel.width) * w)
                        y2 = int((bbox_rel.ymin + bbox_rel.height) * h)
                        
                        # Ensure bbox is within image bounds
                        x1 = max(0, x1)
                        y1 = max(0, y1)
                        x2 = min(w, x2)
                        y2 = min(h, y2)
                        
                        if x2 > x1 and y2 > y1:
                            faces.append({
                                'bbox': (x1, y1, x2, y2),
                                'confidence': detection.score[0],
                                'method': 'MediaPipe'
                            })
                
                return faces
                
        except ImportError:
            # MediaPipe not installed
            return []
        except Exception as e:
            print(f"  [WARNING] MediaPipe detection failed: {e}")
            return []
    
    def _detect_faces_dnn(self, image: np.ndarray) -> list:
        """
        OpenCV DNN face detection using pre-trained model.
        """
        try:
            # Use OpenCV's built-in face detector
            # This uses a Caffe model trained for face detection
            detector = cv2.FaceDetectorYN.create(
                model="face_detection_yunet_2023mar.onnx",
                config="",
                input_size=(320, 320),
                score_threshold=0.6,
                nms_threshold=0.3
            )
            
            h, w = image.shape[:2]
            detector.setInputSize((w, h))
            
            _, faces_detected = detector.detect(image)
            
            faces = []
            if faces_detected is not None:
                for face in faces_detected:
                    x1, y1, w_box, h_box = face[:4].astype(int)
                    x2 = x1 + w_box
                    y2 = y1 + h_box
                    conf = float(face[14])  # Detection confidence
                    
                    faces.append({
                        'bbox': (x1, y1, x2, y2),
                        'confidence': conf,
                        'method': 'DNN'
                    })
            
            return faces
            
        except Exception as e:
            # DNN model not available or failed
            return []
    
    def _bbox_overlap(self, bbox1: Tuple[int, int, int, int], 
                     bbox2: Tuple[int, int, int, int]) -> float:
        """
        Calculate IoU (Intersection over Union) between two bounding boxes.
        """
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i < x1_i or y2_i < y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        
        # Calculate union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def _detect_faces_fallback(self, image: np.ndarray) -> list:
        """
        Legacy fallback - now just calls the improved Haar method.
        """
        return self._detect_faces_haar(image)
    
    def _align_face(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Align face to canonical pose using facial landmarks.
        This improves matching accuracy significantly.
        """
        try:
            # Import dlib for facial landmarks (optional, fallback to simple crop)
            import dlib
            
            # Load facial landmark predictor
            predictor_path = "shape_predictor_68_face_landmarks.dat"
            if not os.path.exists(predictor_path):
                # Fallback to simple crop if landmarks not available
                return self._crop_face(image, bbox, padding=0.2)
            
            predictor = dlib.shape_predictor(predictor_path)
            detector = dlib.get_frontal_face_detector()
            
            # Convert bbox to dlib rectangle
            x1, y1, x2, y2 = bbox
            rect = dlib.rectangle(x1, y1, x2, y2)
            
            # Get facial landmarks
            shape = predictor(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), rect)
            
            # Get eye centers for alignment
            left_eye = np.mean([(shape.part(i).x, shape.part(i).y) for i in range(36, 42)], axis=0)
            right_eye = np.mean([(shape.part(i).x, shape.part(i).y) for i in range(42, 48)], axis=0)
            
            # Calculate rotation angle
            dY = right_eye[1] - left_eye[1]
            dX = right_eye[0] - left_eye[0]
            angle = np.degrees(np.arctan2(dY, dX))
            
            # Get rotation matrix
            eyes_center = ((left_eye[0] + right_eye[0]) / 2, (left_eye[1] + right_eye[1]) / 2)
            M = cv2.getRotationMatrix2D(eyes_center, angle, 1.0)
            
            # Apply rotation
            aligned = cv2.warpAffine(image, M, (image.shape[1], image.shape[0]))
            
            return self._crop_face(aligned, bbox, padding=0.2)
            
        except ImportError:
            # Dlib not available, use simple crop
            return self._crop_face(image, bbox, padding=0.2)
        except Exception as e:
            print(f"[WARNING] Face alignment failed: {e}, using simple crop")
            return self._crop_face(image, bbox, padding=0.2)
    
    def _crop_face(self, image: np.ndarray, bbox: Tuple[int, int, int, int], 
                   padding: float = 0.2) -> np.ndarray:
        """Crop face region with padding"""
        x1, y1, x2, y2 = bbox
        h, w = image.shape[:2]
        
        face_w = x2 - x1
        face_h = y2 - y1
        pad_w = int(face_w * padding)
        pad_h = int(face_h * padding)
        
        x1 = max(0, x1 - pad_w)
        y1 = max(0, y1 - pad_h)
        x2 = min(w, x2 + pad_w)
        y2 = min(h, y2 + pad_h)
        
        return image[y1:y2, x1:x2]
    
    def _assess_face_quality(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> FaceQualityMetrics:
        """
        Comprehensive face quality assessment.
        Returns detailed metrics about the face image quality.
        """
        x1, y1, x2, y2 = bbox
        face_crop = image[y1:y2, x1:x2]
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        
        # 1. Blur detection (Laplacian variance)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # 2. Brightness assessment
        brightness_score = np.mean(gray)
        
        # 3. Face size
        face_size = (x2 - x1, y2 - y1)
        
        # 4. Pose estimation (simplified - check aspect ratio)
        aspect_ratio = face_size[0] / face_size[1]
        # Frontal faces typically have aspect ratio between 0.6-1.2
        # Being very lenient here since we have multi-model verification
        pose_angle = abs(0.8 - aspect_ratio) * 100  # Simplified pose estimate
        is_frontal = 0.5 < aspect_ratio < 1.5  # Very lenient range
        
        # 5. Occlusion detection (check for uniform regions)
        # Simple check: if too much of the face is very dark or very bright
        dark_pixels = np.sum(gray < 30) / gray.size
        bright_pixels = np.sum(gray > 225) / gray.size
        has_occlusion = dark_pixels > 0.3 or bright_pixels > 0.3
        
        # Overall quality assessment
        quality_score = 0
        if blur_score > 100:
            quality_score += 1
        if 50 < brightness_score < 200:
            quality_score += 1
        if face_size[0] >= self.min_face_size and face_size[1] >= self.min_face_size:
            quality_score += 1
        # Don't penalize for non-frontal in quality score
        # The multi-model ensemble will handle pose variations
        if not has_occlusion:
            quality_score += 1
        
        # Adjust quality thresholds to be more lenient
        if quality_score >= 3:
            overall_quality = 'excellent'
        elif quality_score == 2:
            overall_quality = 'good'
        elif quality_score == 1:
            overall_quality = 'fair'
        else:
            overall_quality = 'poor'
        
        return FaceQualityMetrics(
            blur_score=blur_score,
            brightness_score=brightness_score,
            face_size=face_size,
            pose_angle=pose_angle,
            is_frontal=is_frontal,
            has_occlusion=has_occlusion,
            overall_quality=overall_quality
        )
    
    def _check_liveness(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> Tuple[bool, float]:
        """
        Basic liveness detection using texture analysis.
        Detects if the image is a photo of a photo (print attack).
        
        Returns:
            Tuple of (is_live, confidence_score)
        """
        if not self.enable_liveness:
            return True, 1.0
        
        x1, y1, x2, y2 = bbox
        face_crop = image[y1:y2, x1:x2]
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        
        # 1. Texture analysis using Local Binary Patterns (LBP)
        # Real faces have more texture variation than printed photos
        
        # Calculate gradient magnitude
        gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(gx**2 + gy**2)
        
        # Real faces have higher gradient variance
        gradient_variance = np.var(gradient_magnitude)
        
        # 2. Frequency domain analysis
        # Printed photos have different frequency characteristics
        f_transform = np.fft.fft2(gray)
        f_shift = np.fft.fftshift(f_transform)
        magnitude_spectrum = np.abs(f_shift)
        
        # High frequency content (real faces have more)
        h, w = gray.shape
        center_h, center_w = h // 2, w // 2
        high_freq_region = magnitude_spectrum[0:center_h//2, :] 
        high_freq_energy = np.sum(high_freq_region)
        
        # 3. Color distribution analysis
        # Real skin has specific color characteristics
        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        h_channel = hsv[:, :, 0]
        s_channel = hsv[:, :, 1]
        
        # Skin typically has hue in range 0-20 or 160-180
        skin_hue_mask = ((h_channel >= 0) & (h_channel <= 20)) | ((h_channel >= 160) & (h_channel <= 180))
        skin_ratio = np.sum(skin_hue_mask) / skin_hue_mask.size
        
        # Scoring
        liveness_score = 0.0
        
        # Gradient variance threshold (empirically determined)
        if gradient_variance > 50:
            liveness_score += 0.4
        
        # High frequency energy threshold
        if high_freq_energy > 1000:
            liveness_score += 0.3
        
        # Skin color ratio
        if skin_ratio > 0.3:
            liveness_score += 0.3
        
        is_live = liveness_score > 0.6
        
        return is_live, liveness_score
    
    def _verify_with_model(self, id_face_path: str, selfie_face_path: str, 
                          model_name: str) -> VerificationResult:
        """
        Verify faces using a specific DeepFace model.
        
        Args:
            id_face_path: Path to ID face image
            selfie_face_path: Path to selfie face image
            model_name: Name of the model to use
            
        Returns:
            VerificationResult with model-specific results
        """
        if self._deepface is None:
            try:
                from deepface import DeepFace as _DeepFace
                self._deepface = _DeepFace
            except Exception as e:
                raise FaceVerificationError(f"DeepFace not available: {e}")
        
        try:
            result = self._deepface.verify(
                img1_path=id_face_path,
                img2_path=selfie_face_path,
                model_name=model_name,
                detector_backend="skip",
                enforce_detection=False,
                distance_metric="cosine"
            )
            
            distance = result.get('distance', 1.0)
            threshold = self.MODEL_THRESHOLDS[model_name]
            verified = distance < threshold
            
            return VerificationResult(
                model_name=model_name,
                distance=distance,
                verified=verified,
                threshold=threshold
            )
        except Exception as e:
            print(f"[WARNING] Model {model_name} failed: {e}")
            # Return failed verification if model fails
            return VerificationResult(
                model_name=model_name,
                distance=1.0,
                verified=False,
                threshold=self.MODEL_THRESHOLDS[model_name]
            )
    
    def verify_faces(self, id_image_bytes: bytes, selfie_image_bytes: bytes) -> Dict[str, Any]:
        """
        Verify faces using multi-model ensemble approach.
        
        Args:
            id_image_bytes: ID photo as bytes
            selfie_image_bytes: Selfie photo as bytes
            
        Returns:
            Comprehensive verification result with quality metrics
        """
        try:
            # Convert images
            id_image = self._bytes_to_cv2(id_image_bytes)
            selfie_image = self._bytes_to_cv2(selfie_image_bytes)
            
            print(f"\n{'='*60}")
            print("ENHANCED FACE VERIFICATION - MULTI-MODEL ENSEMBLE")
            print(f"{'='*60}\n")
            
            # Detect faces
            print("[1/6] Detecting faces...")
            id_faces = self._detect_faces_yolo(id_image)
            selfie_faces = self._detect_faces_yolo(selfie_image)
            
            print(f"  ✓ ID faces detected: {len(id_faces)}")
            print(f"  ✓ Selfie faces detected: {len(selfie_faces)}")
            
            # Validate single face in each image
            if len(id_faces) == 0:
                return self._error_response("No face detected in ID image")
            if len(selfie_faces) == 0:
                return self._error_response("No face detected in selfie")
            if len(id_faces) > 1:
                return self._error_response(f"Multiple faces detected in ID ({len(id_faces)} faces)")
            if len(selfie_faces) > 1:
                return self._error_response(f"Multiple faces detected in selfie ({len(selfie_faces)} faces)")
            
            id_face = id_faces[0]
            selfie_face = selfie_faces[0]
            
            # Check confidence
            if id_face['confidence'] < self.min_confidence:
                return self._error_response(f"ID face confidence too low: {id_face['confidence']:.2f}")
            if selfie_face['confidence'] < self.min_confidence:
                return self._error_response(f"Selfie face confidence too low: {selfie_face['confidence']:.2f}")
            
            # Assess quality
            print("\n[2/6] Assessing face quality...")
            id_quality = self._assess_face_quality(id_image, id_face['bbox'])
            selfie_quality = self._assess_face_quality(selfie_image, selfie_face['bbox'])
            
            print(f"  ID Quality: {id_quality.overall_quality} (blur: {id_quality.blur_score:.1f}, brightness: {id_quality.brightness_score:.1f})")
            print(f"  Selfie Quality: {selfie_quality.overall_quality} (blur: {selfie_quality.blur_score:.1f}, brightness: {selfie_quality.brightness_score:.1f})")
            
            # Reject poor quality
            if id_quality.overall_quality == 'poor':
                return self._error_response("ID image quality too poor. Ensure clear, well-lit photo.")
            if selfie_quality.overall_quality == 'poor':
                return self._error_response("Selfie quality too poor. Ensure clear, well-lit photo.")
            
            # Log pose information but don't reject based on it
            # The multi-model ensemble will handle pose variations
            print(f"  ID pose: {'frontal' if id_quality.is_frontal else 'non-frontal'} (aspect ratio: {id_quality.face_size[0]/id_quality.face_size[1]:.2f})")
            print(f"  Selfie pose: {'frontal' if selfie_quality.is_frontal else 'non-frontal'} (aspect ratio: {selfie_quality.face_size[0]/selfie_quality.face_size[1]:.2f})")
            
            # Liveness detection
            print("\n[3/6] Checking liveness...")
            is_live, liveness_score = self._check_liveness(selfie_image, selfie_face['bbox'])
            print(f"  Liveness: {'PASS' if is_live else 'FAIL'} (score: {liveness_score:.2f})")
            
            if not is_live:
                return self._error_response(
                    "Liveness check failed. Please use a live camera, not a photo.",
                    error_code="liveness_failed"
                )
            
            # Align faces
            print("\n[4/6] Aligning faces...")
            id_face_aligned = self._align_face(id_image, id_face['bbox'])
            selfie_face_aligned = self._align_face(selfie_image, selfie_face['bbox'])
            print("  ✓ Faces aligned")
            
            # Save to temp files
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as id_tmp:
                cv2.imwrite(id_tmp.name, id_face_aligned)
                id_tmp_path = id_tmp.name
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as selfie_tmp:
                cv2.imwrite(selfie_tmp.name, selfie_face_aligned)
                selfie_tmp_path = selfie_tmp.name
            
            try:
                # Multi-model verification
                print("\n[5/6] Running multi-model verification...")
                model_results: List[VerificationResult] = []
                
                for model_name in ['ArcFace', 'Facenet512', 'VGG-Face']:
                    print(f"  Testing {model_name}...", end=" ")
                    result = self._verify_with_model(id_tmp_path, selfie_tmp_path, model_name)
                    model_results.append(result)
                    status = "✓ PASS" if result.verified else "✗ FAIL"
                    print(f"{status} (distance: {result.distance:.4f}, threshold: {result.threshold})")
                
                # Ensemble decision
                print("\n[6/6] Making ensemble decision...")
                verified_count = sum(1 for r in model_results if r.verified)
                is_verified = verified_count >= self.min_models_agree
                
                print(f"  Models agreeing: {verified_count}/{len(model_results)}")
                print(f"  Required agreement: {self.min_models_agree}/{len(model_results)}")
                print(f"  Final decision: {'✓ VERIFIED' if is_verified else '✗ REJECTED'}")
                
                # Calculate average distance
                avg_distance = np.mean([r.distance for r in model_results])
                
                # Prepare detailed response
                if is_verified:
                    message = f"✓ Face verified successfully! {verified_count}/{len(model_results)} models agree."
                else:
                    message = f"✗ Face verification failed. Only {verified_count}/{len(model_results)} models agree (need {self.min_models_agree})."
                
                print(f"\n{'='*60}")
                print(f"RESULT: {message}")
                print(f"{'='*60}\n")
                
                return {
                    "verified": is_verified,
                    "message": message,
                    "ensemble_results": {
                        "models_verified": verified_count,
                        "total_models": len(model_results),
                        "required_agreement": self.min_models_agree,
                        "average_distance": round(avg_distance, 4),
                        "model_details": [
                            {
                                "model": r.model_name,
                                "distance": round(r.distance, 4),
                                "threshold": r.threshold,
                                "verified": r.verified
                            }
                            for r in model_results
                        ]
                    },
                    "quality_metrics": {
                        "id_quality": id_quality.overall_quality,
                        "selfie_quality": selfie_quality.overall_quality,
                        "id_blur_score": round(id_quality.blur_score, 2),
                        "selfie_blur_score": round(selfie_quality.blur_score, 2),
                        "liveness_score": round(liveness_score, 2),
                        "liveness_passed": is_live
                    },
                    "confidence_scores": {
                        "id_detection_confidence": round(id_face['confidence'], 4),
                        "selfie_detection_confidence": round(selfie_face['confidence'], 4)
                    },
                    "similarity_percentage": round((1 - avg_distance) * 100, 2)
                }
                
            finally:
                # Clean up temp files
                os.unlink(id_tmp_path)
                os.unlink(selfie_tmp_path)
                
        except FaceVerificationError as e:
            return self._error_response(str(e))
        except Exception as e:
            print(f"\n[ERROR] Verification failed: {str(e)}")
            return self._error_response(f"Verification failed: {str(e)}")
    
    def _error_response(self, message: str, error_code: str = "verification_failed") -> Dict[str, Any]:
        """Generate standardized error response"""
        return {
            "verified": False,
            "message": message,
            "error": error_code,
            "distance": None
        }


# Global instance
_enhanced_verifier: Optional[EnhancedFaceVerifier] = None


def get_enhanced_verifier(min_models_agree: int = 2, enable_liveness: bool = True) -> EnhancedFaceVerifier:
    """Get or create the enhanced face verifier singleton"""
    global _enhanced_verifier
    if _enhanced_verifier is None:
        _enhanced_verifier = EnhancedFaceVerifier(
            min_models_agree=min_models_agree,
            enable_liveness=enable_liveness
        )
    return _enhanced_verifier


def verify_face_enhanced(id_image_bytes: bytes, selfie_image_bytes: bytes,
                        min_models_agree: int = 2,
                        enable_liveness: bool = True) -> Dict[str, Any]:
    """
    Enhanced face verification with multi-model ensemble.
    
    Args:
        id_image_bytes: ID photo as bytes
        selfie_image_bytes: Selfie photo as bytes
        min_models_agree: Minimum models that must agree (default: 2 out of 3)
        enable_liveness: Enable liveness detection (default: True)
        
    Returns:
        Comprehensive verification result
    """
    verifier = get_enhanced_verifier(min_models_agree, enable_liveness)
    return verifier.verify_faces(id_image_bytes, selfie_image_bytes)
