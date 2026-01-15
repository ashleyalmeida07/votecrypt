"""
Test script for facial verification backend
Tests the /verify-face endpoint with sample images
"""
import requests
import sys

def test_backend_health():
    """Test if backend is running"""
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code == 200:
            print("✅ Backend health check passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")
        print("   Make sure the backend server is running (python main.py)")
        return False

def test_verify_face_endpoint():
    """Test the face verification endpoint"""
    print("\n📝 Testing /verify-face endpoint...")
    print("   Note: This requires test images in backend/test_images/")
    print("   Create test_images folder with id.jpg and selfie.jpg to test")
    
    try:
        # Check if test images exist
        import os
        test_dir = os.path.join(os.path.dirname(__file__), 'test_images')
        if not os.path.exists(test_dir):
            print("⚠️  Test images directory not found. Skipping endpoint test.")
            print(f"   Create: {test_dir}")
            print("   Add: id.jpg (voter ID photo) and selfie.jpg (selfie photo)")
            return
        
        id_image_path = os.path.join(test_dir, 'id.jpg')
        selfie_image_path = os.path.join(test_dir, 'selfie.jpg')
        
        if not os.path.exists(id_image_path) or not os.path.exists(selfie_image_path):
            print("⚠️  Test images not found. Skipping endpoint test.")
            return
        
        # Send verification request
        with open(id_image_path, 'rb') as id_file, open(selfie_image_path, 'rb') as selfie_file:
            files = {
                'id_image': ('id.jpg', id_file, 'image/jpeg'),
                'selfie_image': ('selfie.jpg', selfie_file, 'image/jpeg')
            }
            
            print("   Sending verification request...")
            response = requests.post("http://localhost:8000/verify-face", files=files)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Verification request successful")
                print(f"   Verified: {result['verified']}")
                print(f"   Distance: {result.get('distance', 'N/A')}")
                print(f"   Message: {result['message']}")
                print(f"   ID Face Confidence: {result.get('id_face_confidence', 'N/A')}")
                print(f"   Selfie Confidence: {result.get('selfie_face_confidence', 'N/A')}")
            else:
                print(f"❌ Verification request failed with status {response.status_code}")
                print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Endpoint test failed: {e}")

def test_api_docs():
    """Test if API documentation is accessible"""
    try:
        response = requests.get("http://localhost:8000/docs")
        if response.status_code == 200:
            print("✅ API documentation accessible at http://localhost:8000/docs")
            return True
        else:
            print(f"❌ API documentation failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API documentation check failed: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("🧪 BALLOT Face Verification Backend Test Suite")
    print("="*60)
    
    # Test 1: Health check
    print("\n1️⃣  Testing Backend Health...")
    health_ok = test_backend_health()
    
    if not health_ok:
        print("\n❌ Backend is not running. Please start it first:")
        print("   cd backend")
        print("   python main.py")
        sys.exit(1)
    
    # Test 2: API docs
    print("\n2️⃣  Testing API Documentation...")
    test_api_docs()
    
    # Test 3: Verification endpoint
    print("\n3️⃣  Testing Face Verification Endpoint...")
    test_verify_face_endpoint()
    
    print("\n" + "="*60)
    print("✅ Test suite completed!")
    print("="*60)
    print("\n📌 Next Steps:")
    print("   1. Start Next.js frontend: npm run dev")
    print("   2. Navigate to http://localhost:3000")
    print("   3. Complete signup flow")
    print("   4. Test face verification after OTP")
    print()
