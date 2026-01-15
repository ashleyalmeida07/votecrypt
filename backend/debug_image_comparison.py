"""
Debug script to verify that the correct images are being compared
Saves the images being compared for manual inspection
"""

import sys
import cv2
import numpy as np
from pathlib import Path

def debug_verification(id_image_bytes: bytes, selfie_image_bytes: bytes, output_dir: str = "debug_images"):
    """
    Save the images being compared for manual inspection
    """
    Path(output_dir).mkdir(exist_ok=True)
    
    # Convert bytes to images
    id_nparr = np.frombuffer(id_image_bytes, np.uint8)
    id_img = cv2.imdecode(id_nparr, cv2.IMREAD_COLOR)
    
    selfie_nparr = np.frombuffer(selfie_image_bytes, np.uint8)
    selfie_img = cv2.imdecode(selfie_nparr, cv2.IMREAD_COLOR)
    
    # Save images
    id_path = Path(output_dir) / "voter_id_being_compared.jpg"
    selfie_path = Path(output_dir) / "selfie_being_compared.jpg"
    
    cv2.imwrite(str(id_path), id_img)
    cv2.imwrite(str(selfie_path), selfie_img)
    
    print(f"\n{'='*70}")
    print("DEBUG: Images Saved for Manual Inspection")
    print(f"{'='*70}")
    print(f"Voter ID saved to: {id_path.absolute()}")
    print(f"Selfie saved to: {selfie_path.absolute()}")
    print(f"\nPlease manually verify:")
    print("  1. The voter ID image is the correct one from Firebase Storage")
    print("  2. The selfie is the live photo captured from webcam")
    print("  3. Both images show the same person (if they should match)")
    print(f"{'='*70}\n")
    
    return id_img, selfie_img


if __name__ == "__main__":
    print("This is a utility module for debugging image comparison.")
    print("Import and use debug_verification() in your verification code.")
