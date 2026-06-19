"""
Pinata IPFS Service
Handles uploading encrypted files to Pinata cloud storage
"""

import requests
import json
import os
from typing import Dict, Optional, Tuple
from pathlib import Path


class PinataService:
    """Service for interacting with Pinata IPFS API"""
    
    def __init__(self, api_key: str = None, api_secret: str = None, jwt_token: str = None):
        """
        Initialize Pinata service with credentials
        
        Args:
            api_key: Pinata API key
            api_secret: Pinata API secret
            jwt_token: Pinata JWT token (preferred method)
        """
        self.api_key = api_key or os.getenv('PINATA_API_KEY')
        self.api_secret = api_secret or os.getenv('PINATA_API_SECRET')
        self.jwt_token = jwt_token or os.getenv('PINATA_JWT_TOKEN')
        
        self.base_url = "https://api.pinata.cloud"
        self.gateway_url = "https://gateway.pinata.cloud/ipfs"
        
        # Use JWT token if available, otherwise use API key/secret
        if self.jwt_token:
            self.headers = {
                'Authorization': f'Bearer {self.jwt_token}'
            }
        elif self.api_key and self.api_secret:
            self.headers = {
                'pinata_api_key': self.api_key,
                'pinata_secret_api_key': self.api_secret
            }
        else:
            raise ValueError("Either JWT token or API key/secret must be provided")
    
    def test_connection(self) -> Tuple[bool, str]:
        """
        Test connection to Pinata API
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            response = requests.get(
                f"{self.base_url}/data/testAuthentication",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return True, "Successfully connected to Pinata API"
            else:
                return False, f"Failed to authenticate: {response.text}"
                
        except Exception as e:
            return False, f"Connection error: {str(e)}"
    
    def upload_file(
        self, 
        file_path: str, 
        metadata: Optional[Dict] = None,
        pin_name: Optional[str] = None
    ) -> Dict:
        """
        Upload a file to Pinata IPFS
        
        Args:
            file_path: Path to the file to upload
            metadata: Optional metadata to attach to the pin
            pin_name: Optional custom name for the pin
            
        Returns:
            Dict containing IPFS hash, pin size, timestamp, and gateway URL
        """
        try:
            file_path = Path(file_path)
            
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Prepare the file
            with open(file_path, 'rb') as file:
                files = {
                    'file': (file_path.name, file, 'application/octet-stream')
                }
                
                # Prepare pin options
                pin_options = {}
                if pin_name:
                    pin_options['cidVersion'] = 1
                
                # Prepare metadata
                pin_metadata = {
                    'name': pin_name or file_path.name,
                }
                
                if metadata:
                    pin_metadata['keyvalues'] = metadata
                
                data = {
                    'pinataMetadata': json.dumps(pin_metadata),
                    'pinataOptions': json.dumps(pin_options)
                }
                
                # Upload to Pinata
                response = requests.post(
                    f"{self.base_url}/pinning/pinFileToIPFS",
                    files=files,
                    data=data,
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    ipfs_hash = result['IpfsHash']
                    
                    return {
                        'success': True,
                        'ipfs_hash': ipfs_hash,
                        'pin_size': result['PinSize'],
                        'timestamp': result['Timestamp'],
                        'gateway_url': f"{self.gateway_url}/{ipfs_hash}",
                        'pinata_url': f"https://app.pinata.cloud/pinmanager?search={ipfs_hash}",
                        'file_name': file_path.name
                    }
                else:
                    return {
                        'success': False,
                        'error': f"Upload failed: {response.text}"
                    }
                    
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def upload_encrypted_file(
        self,
        file_path: str,
        session_id: str,
        original_filename: str,
        encryption_algorithm: str = "AES-256-GCM + PQC"
    ) -> Dict:
        """
        Upload an encrypted file with proper metadata
        
        Args:
            file_path: Path to the encrypted file
            session_id: Encryption session ID
            original_filename: Original file name before encryption
            encryption_algorithm: Encryption algorithm used
            
        Returns:
            Dict containing upload results
        """
        metadata = {
            'type': 'encrypted_file',
            'session_id': session_id,
            'original_filename': original_filename,
            'encryption_algorithm': encryption_algorithm,
            'system': 'SYNTOM'
        }
        
        # Use the actual encrypted filename as the pin name
        encrypted_filename = Path(file_path).name
        pin_name = encrypted_filename
        
        return self.upload_file(file_path, metadata, pin_name)
    
    def get_pinned_files(self, limit: int = 10) -> Dict:
        """
        Get list of pinned files
        
        Args:
            limit: Maximum number of files to retrieve
            
        Returns:
            Dict containing list of pinned files
        """
        try:
            params = {
                'status': 'pinned',
                'pageLimit': limit
            }
            
            response = requests.get(
                f"{self.base_url}/data/pinList",
                headers=self.headers,
                params=params
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'data': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': response.text
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def unpin_file(self, ipfs_hash: str) -> Dict:
        """
        Unpin a file from Pinata
        
        Args:
            ipfs_hash: IPFS hash of the file to unpin
            
        Returns:
            Dict containing operation result
        """
        try:
            response = requests.delete(
                f"{self.base_url}/pinning/unpin/{ipfs_hash}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': f"Successfully unpinned {ipfs_hash}"
                }
            else:
                return {
                    'success': False,
                    'error': response.text
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance for easy access
_pinata_instance = None

def get_pinata_service() -> PinataService:
    """Get or create Pinata service instance"""
    global _pinata_instance
    if _pinata_instance is None:
        _pinata_instance = PinataService()
    return _pinata_instance
