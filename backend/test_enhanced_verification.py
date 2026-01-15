"""
Test script for enhanced face verification system
Tests the multi-model ensemble approach with various scenarios
"""

import requests
import base64
import json
from pathlib import Path

# API endpoint
API_URL = "http://localhost:8000/verify-face"


def encode_image_to_base64(image_path: str) -> str:
    """Encode image file to base64 string"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def test_verification(id_image_path: str, selfie_image_path: str, test_name: str):
    """
    Test face verification with given images
    
    Args:
        id_image_path: Path to ID photo
        selfie_image_path: Path to selfie photo
        test_name: Name of the test for logging
    """
    print(f"\n{'='*70}")
    print(f"TEST: {test_name}")
    print(f"{'='*70}")
    print(f"ID Image: {id_image_path}")
    print(f"Selfie Image: {selfie_image_path}")
    
    try:
        # Prepare files
        with open(id_image_path, 'rb') as id_file, open(selfie_image_path, 'rb') as selfie_file:
            files = {
                'id_image': ('id.jpg', id_file, 'image/jpeg'),
                'selfie_image': ('selfie.jpg', selfie_file, 'image/jpeg')
            }
            
            # Make request
            response = requests.post(API_URL, files=files)
            result = response.json()
            
            # Print results
            print(f"\n{'─'*70}")
            print(f"RESULT: {'✓ VERIFIED' if result.get('verified') else '✗ REJECTED'}")
            print(f"{'─'*70}")
            print(f"Message: {result.get('message')}")
            
            if result.get('ensemble_results'):
                ensemble = result['ensemble_results']
                print(f"\nEnsemble Results:")
                print(f"  Models Agreed: {ensemble['models_verified']}/{ensemble['total_models']}")
                print(f"  Required: {ensemble['required_agreement']}")
                print(f"  Average Distance: {ensemble['average_distance']:.4f}")
                
                print(f"\n  Model Details:")
                for model in ensemble['model_details']:
                    status = "✓" if model['verified'] else "✗"
                    print(f"    {status} {model['model']:12s}: distance={model['distance']:.4f}, threshold={model['threshold']:.2f}")
            
            if result.get('quality_metrics'):
                quality = result['quality_metrics']
                print(f"\nQuality Metrics:")
                print(f"  ID Quality: {quality['id_quality']} (blur: {quality['id_blur_score']:.1f})")
                print(f"  Selfie Quality: {quality['selfie_quality']} (blur: {quality['selfie_blur_score']:.1f})")
                print(f"  Liveness: {'✓ PASS' if quality['liveness_passed'] else '✗ FAIL'} (score: {quality['liveness_score']:.2f})")
            
            if result.get('similarity_percentage'):
                print(f"\nSimilarity: {result['similarity_percentage']:.1f}%")
            
            if result.get('error'):
                print(f"\nError: {result['error']}")
            
            print(f"{'='*70}\n")
            
            return result
            
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}\n")
        return None


def main():
    """Run test suite"""
    print("\n" + "="*70)
    print("ENHANCED FACE VERIFICATION - TEST SUITE")
    print("="*70)
    
    # Check if API is running
    try:
        health = requests.get("http://localhost:8000/health")
        print(f"✓ API Status: {health.json()['status']}")
    except Exception as e:
        print(f"✗ ERROR: API not running. Please start the backend server.")
        print(f"  Run: python backend/main.py")
        return
    
    # Define test cases
    # NOTE: You need to provide actual test images
    test_cases = [
        {
            "name": "Same Person - Good Quality",
            "id_image": "test_images/person1_id.jpg",
            "selfie": "test_images/person1_selfie.jpg",
            "expected": True
        },
        {
            "name": "Different People",
            "id_image": "test_images/person1_id.jpg",
            "selfie": "test_images/person2_selfie.jpg",
            "expected": False
        },
        {
            "name": "Same Person - Different Lighting",
            "id_image": "test_images/person1_id.jpg",
            "selfie": "test_images/person1_selfie_dark.jpg",
            "expected": True
        },
        {
            "name": "Photo of Photo (Should Fail Liveness)",
            "id_image": "test_images/person1_id.jpg",
            "selfie": "test_images/person1_photo_of_photo.jpg",
            "expected": False
        }
    ]
    
    # Run tests
    results = []
    for test_case in test_cases:
        # Check if test images exist
        if not Path(test_case['id_image']).exists() or not Path(test_case['selfie']).exists():
            print(f"\n⚠ Skipping test '{test_case['name']}' - images not found")
            continue
        
        result = test_verification(
            test_case['id_image'],
            test_case['selfie'],
            test_case['name']
        )
        
        if result:
            results.append({
                'test': test_case['name'],
                'expected': test_case['expected'],
                'actual': result.get('verified'),
                'passed': result.get('verified') == test_case['expected']
            })
    
    # Print summary
    if results:
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        passed = sum(1 for r in results if r['passed'])
        total = len(results)
        
        for r in results:
            status = "✓ PASS" if r['passed'] else "✗ FAIL"
            print(f"{status}: {r['test']}")
            print(f"  Expected: {r['expected']}, Got: {r['actual']}")
        
        print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        print("="*70 + "\n")
    else:
        print("\n⚠ No tests were run. Please add test images to the 'test_images' directory.")
        print("\nRequired test images:")
        print("  - test_images/person1_id.jpg")
        print("  - test_images/person1_selfie.jpg")
        print("  - test_images/person2_selfie.jpg")
        print("  - test_images/person1_selfie_dark.jpg")
        print("  - test_images/person1_photo_of_photo.jpg")


if __name__ == "__main__":
    main()
