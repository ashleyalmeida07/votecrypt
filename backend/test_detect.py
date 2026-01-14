"""
Simple smoke-test for FaceVerifier in backend/face_verification.py
Usage:
  python test_detect.py [path_to_image]
If an image path is provided, runs detection and prints bounding boxes.
If no image is provided, only attempts to load the YOLO model to verify it initializes.
"""
import sys
import time
from pathlib import Path

from face_verification import get_verifier, FaceVerificationError


def main():
    img_path = None
    if len(sys.argv) >= 2:
        img_path = Path(sys.argv[1])
        if not img_path.exists():
            print(f"Provided image does not exist: {img_path}")
            return

    print("Initializing FaceVerifier (this may download YOLO model if missing)...")
    start = time.time()
    try:
        verifier = get_verifier()
    except FaceVerificationError as e:
        print(f"Failed to initialize verifier: {e}")
        return
    except Exception as e:
        print(f"Unexpected error initializing verifier: {e}")
        return
    elapsed = time.time() - start
    print(f"FaceVerifier initialized in {elapsed:.2f}s")

    if img_path is None:
        print("No image provided — model load smoke-test complete.")
        return

    # Run detection on provided image
    import cv2
    img = cv2.imread(str(img_path))
    if img is None:
        print("Failed to read image with OpenCV")
        return

    print(f"Running face detection on: {img_path}")
    faces = verifier._detect_faces_yolo(img)
    if not faces:
        print("No faces detected")
        return

    print(f"Detected {len(faces)} face(s):")
    for i, f in enumerate(faces, start=1):
        bbox = f.get('bbox')
        conf = f.get('confidence')
        print(f"  Face {i}: bbox={bbox}, confidence={conf}")


if __name__ == '__main__':
    main()
