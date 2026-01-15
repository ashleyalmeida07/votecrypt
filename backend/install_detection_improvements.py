"""
Quick install script for optional face detection improvements
"""

import subprocess
import sys

def install_mediapipe():
    """Install MediaPipe for better face detection"""
    print("\n" + "="*70)
    print("Installing MediaPipe for Improved Face Detection")
    print("="*70 + "\n")
    
    print("MediaPipe provides:")
    print("  ✓ More accurate face detection")
    print("  ✓ Better handling of various angles")
    print("  ✓ Improved performance in poor lighting")
    print("  ✓ Robust detection for voter ID cards")
    
    response = input("\nInstall MediaPipe? (y/n): ").lower().strip()
    
    if response == 'y':
        print("\nInstalling mediapipe...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "mediapipe"])
            print("\n✓ MediaPipe installed successfully!")
            print("\nThe face verification system will now use MediaPipe as a fallback")
            print("when YOLO and Haar Cascade don't detect faces.")
        except Exception as e:
            print(f"\n✗ Installation failed: {e}")
            print("\nYou can install manually with: pip install mediapipe")
    else:
        print("\nSkipping MediaPipe installation.")
        print("The system will use YOLO and Haar Cascade only.")

def main():
    print("\n" + "="*70)
    print("Face Detection Improvement Installer")
    print("="*70)
    
    print("\nCurrent face detection methods:")
    print("  1. YOLO (Primary) - ✓ Always available")
    print("  2. Haar Cascade (Fallback 1) - ✓ Always available")
    print("  3. MediaPipe (Fallback 2) - ⚠ Optional, not installed")
    print("  4. OpenCV DNN (Fallback 3) - ⚠ Optional, may need model")
    
    print("\n" + "="*70)
    print("Recommendation: Install MediaPipe for best results")
    print("="*70)
    
    install_mediapipe()
    
    print("\n" + "="*70)
    print("Next Steps:")
    print("="*70)
    print("1. Restart your backend server")
    print("2. Test face detection with your voter ID images")
    print("3. If still having issues, run:")
    print("   python test_face_detection_debug.py your_image.jpg")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
