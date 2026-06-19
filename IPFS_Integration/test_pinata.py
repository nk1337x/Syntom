"""
Test script for Pinata IPFS integration
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from pinata_service import PinataService

def test_pinata_connection():
    """Test Pinata API connection"""
    print("=" * 60)
    print("PINATA IPFS CONNECTION TEST")
    print("=" * 60)
    
    # Load environment variables
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    
    try:
        # Initialize service
        pinata = PinataService()
        print("\n✓ Pinata service initialized")
        
        # Test authentication
        print("\nTesting authentication...")
        success, message = pinata.test_connection()
        
        if success:
            print(f"✓ {message}")
            print("\n" + "=" * 60)
            print("CONNECTION TEST PASSED!")
            print("=" * 60)
            return True
        else:
            print(f"✗ {message}")
            print("\n" + "=" * 60)
            print("CONNECTION TEST FAILED!")
            print("=" * 60)
            return False
            
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        print("\n" + "=" * 60)
        print("CONNECTION TEST FAILED!")
        print("=" * 60)
        return False

def test_file_upload():
    """Test uploading a sample file"""
    print("\n" + "=" * 60)
    print("FILE UPLOAD TEST")
    print("=" * 60)
    
    # Load environment variables
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    
    try:
        pinata = PinataService()
        
        # Create a test file
        test_file = Path(__file__).parent / 'test_upload.txt'
        with open(test_file, 'w') as f:
            f.write("SYNTOM Test File for IPFS Upload\n")
            f.write("This is a test of the Pinata integration.\n")
        
        print(f"\n✓ Created test file: {test_file.name}")
        
        # Upload the file
        print("\nUploading to Pinata IPFS...")
        result = pinata.upload_file(
            str(test_file),
            metadata={'type': 'test', 'system': 'SYNTOM'},
            pin_name='SYNTOM_Test_Upload'
        )
        
        if result['success']:
            print(f"\n✓ Upload successful!")
            print(f"  IPFS Hash: {result['ipfs_hash']}")
            print(f"  Gateway URL: {result['gateway_url']}")
            print(f"  Pinata URL: {result['pinata_url']}")
            print(f"  File Size: {result['pin_size']} bytes")
            
            # Clean up
            test_file.unlink()
            print(f"\n✓ Cleaned up test file")
            
            print("\n" + "=" * 60)
            print("FILE UPLOAD TEST PASSED!")
            print("=" * 60)
            return True
        else:
            print(f"\n✗ Upload failed: {result.get('error')}")
            test_file.unlink()
            print("\n" + "=" * 60)
            print("FILE UPLOAD TEST FAILED!")
            print("=" * 60)
            return False
            
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        if test_file.exists():
            test_file.unlink()
        print("\n" + "=" * 60)
        print("FILE UPLOAD TEST FAILED!")
        print("=" * 60)
        return False

if __name__ == "__main__":
    # Run tests
    connection_ok = test_pinata_connection()
    
    if connection_ok:
        test_file_upload()
    else:
        print("\nSkipping file upload test due to connection failure")
