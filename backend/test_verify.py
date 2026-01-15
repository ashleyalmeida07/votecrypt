"""
End-to-end face verification test using DeepFace.
Usage:
  python test_verify.py <id_image_path> <selfie_image_path>
"""
import sys
import time
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        print("Usage: python test_verify.py <id_image_path> <selfie_image_path>")
        print("Example: python test_verify.py /path/to/id.jpg /path/to/selfie.jpg")
        return

    id_path = Path(sys.argv[1])
    selfie_path = Path(sys.argv[2])

    if not id_path.exists():
        print(f"ID image not found: {id_path}")
        return
    if not selfie_path.exists():
        print(f"Selfie image not found: {selfie_path}")
        return

    print("=" * 60)
    print("≡ƒù│∩╕Å  BALLOT Face Verification Test")
    print("=" * 60)
    print(f"ID Image:     {id_path}")
    print(f"Selfie Image: {selfie_path}")
    print("-" * 60)

    # Import and initialize
    print("\nΓÅ│ Loading face verification module...")
    start = time.time()
    from face_verification import verify_face_match
    load_time = time.time() - start
    print(f"Γ£à Module loaded in {load_time:.2f}s")

    # Read images
    print("\nΓÅ│ Reading images...")
    with open(id_path, 'rb') as f:
        id_bytes = f.read()
    with open(selfie_path, 'rb') as f:
        selfie_bytes = f.read()
    print(f"   ID image: {len(id_bytes):,} bytes")
    print(f"   Selfie:   {len(selfie_bytes):,} bytes")

    # Verify
    print("\nΓÅ│ Running face verification...")
    start = time.time()
    result = verify_face_match(id_bytes, selfie_bytes, threshold=0.45)
    verify_time = time.time() - start

    # Display results
    print("\n" + "=" * 60)
    print("≡ƒôè VERIFICATION RESULT")
    print("=" * 60)
    
    if result['verified']:
        print("Γ£à VERIFIED - Faces match!")
    else:
        print("Γ¥î REJECTED - Faces do not match")
    
    print(f"\n   Distance:    {result.get('distance', 'N/A')}")
    print(f"   Threshold:   0.45 (lower = more similar)")
    print(f"   Message:     {result.get('message', 'N/A')}")
    
    if result.get('id_face_confidence'):
        print(f"   ID Face:     {result['id_face_confidence']:.2%} confidence")
    if result.get('selfie_face_confidence'):
        print(f"   Selfie Face: {result['selfie_face_confidence']:.2%} confidence")
    
    if result.get('error'):
        print(f"   Error:       {result['error']}")
    
    print(f"\nΓÅ▒∩╕Å  Verification time: {verify_time:.2f}s")
    print("=" * 60)


if __name__ == '__main__':
    main()
