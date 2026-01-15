"""
Improved face detection test with better debugging
"""
import cv2
import sys
from pathlib import Path

def test_face_detection(image_path):
    """Test face detection with multiple methods"""
    print(f"\n{'='*70}")
    print(f"Testing Face Detection: {image_path}")
    print(f"{'='*70}\n")
    
    # Load image
    img = cv2.imread(str(image_path))
    if img is None:
        print("❌ Failed to load image")
        return
    
    print(f"✓ Image loaded: {img.shape[1]}x{img.shape[0]} pixels")
    
    # Test 1: YOLO Detection
    print("\n[1/3] Testing YOLO face detection...")
    try:
        from ultralytics import YOLO
        
        # Try face-specific model first
        try:
            model = YOLO('yolov8n-face.pt')
            print("  Using YOLOv8n-face model")
        except:
            model = YOLO('yolov8n.pt')
            print("  Using YOLOv8n general model")
        
        results = model(img, verbose=False)
        faces_yolo = []
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id].lower()
                
                if 'face' in cls_name or 'person' in cls_name:
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    faces_yolo.append({
                        'bbox': (x1, y1, x2, y2),
                        'confidence': conf,
                        'class': cls_name
                    })
        
        print(f"  Found {len(faces_yolo)} face(s)")
        for i, face in enumerate(faces_yolo, 1):
            bbox = face['bbox']
            print(f"    Face {i}: bbox={bbox}, conf={face['confidence']:.3f}, class={face['class']}")
            
    except Exception as e:
        print(f"  ❌ YOLO failed: {e}")
        faces_yolo = []
    
    # Test 2: Haar Cascade Detection
    print("\n[2/3] Testing Haar Cascade detection...")
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        detected = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        faces_haar = []
        for (x, y, w, h) in detected:
            faces_haar.append({
                'bbox': (x, y, x + w, y + h),
                'confidence': 0.8
            })
        
        print(f"  Found {len(faces_haar)} face(s)")
        for i, face in enumerate(faces_haar, 1):
            print(f"    Face {i}: bbox={face['bbox']}")
            
    except Exception as e:
        print(f"  ❌ Haar Cascade failed: {e}")
        faces_haar = []
    
    # Test 3: DNN Face Detection (OpenCV)
    print("\n[3/3] Testing OpenCV DNN face detection...")
    try:
        # Download model if needed
        modelFile = "opencv_face_detector_uint8.pb"
        configFile = "opencv_face_detector.pbtxt"
        
        # Try to load pre-trained model
        try:
            net = cv2.dnn.readNetFromTensorflow(modelFile, configFile)
            
            blob = cv2.dnn.blobFromImage(img, 1.0, (300, 300), [104, 117, 123], False, False)
            net.setInput(blob)
            detections = net.forward()
            
            faces_dnn = []
            h, w = img.shape[:2]
            
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.5:
                    x1 = int(detections[0, 0, i, 3] * w)
                    y1 = int(detections[0, 0, i, 4] * h)
                    x2 = int(detections[0, 0, i, 5] * w)
                    y2 = int(detections[0, 0, i, 6] * h)
                    faces_dnn.append({
                        'bbox': (x1, y1, x2, y2),
                        'confidence': float(confidence)
                    })
            
            print(f"  Found {len(faces_dnn)} face(s)")
            for i, face in enumerate(faces_dnn, 1):
                print(f"    Face {i}: bbox={face['bbox']}, conf={face['confidence']:.3f}")
                
        except Exception as e:
            print(f"  ⚠ DNN model not available: {e}")
            faces_dnn = []
            
    except Exception as e:
        print(f"  ❌ DNN detection failed: {e}")
        faces_dnn = []
    
    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"YOLO:         {len(faces_yolo)} face(s)")
    print(f"Haar Cascade: {len(faces_haar)} face(s)")
    print(f"DNN:          {len(faces_dnn)} face(s)")
    
    if not faces_yolo and not faces_haar and not faces_dnn:
        print("\n❌ NO FACES DETECTED BY ANY METHOD")
        print("\nPossible issues:")
        print("  1. Face is too small in the image")
        print("  2. Face is not frontal (side profile)")
        print("  3. Poor lighting or image quality")
        print("  4. Face is occluded (sunglasses, mask, etc.)")
        print("  5. Image is not a photo of a person")
    else:
        print("\n✓ At least one method detected faces")
    
    print(f"{'='*70}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_face_detection_debug.py <image_path>")
        sys.exit(1)
    
    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"Error: Image not found: {image_path}")
        sys.exit(1)
    
    test_face_detection(image_path)
