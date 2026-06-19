"""
Auto Uploader for Encrypted Files
Automatically uploads encrypted files to Pinata IPFS after encryption
"""

import os
import json
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

from .pinata_service import PinataService


# Load environment variables from .env file at module import time
def _load_env():
    """Load environment variables from IPFS_Integration/.env file"""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

# Load environment variables when module is imported
_load_env()


class EncryptedFileUploader:
    """Handles automatic upload of encrypted files to IPFS"""
    
    def __init__(self):
        """Initialize uploader with Pinata service"""
        
        self.pinata = PinataService()
        self.upload_log_path = Path(__file__).parent / 'upload_logs'
        self.upload_log_path.mkdir(exist_ok=True)
    
    def upload_after_encryption(
        self,
        encrypted_file_path: str,
        session_id: str,
        original_filename: str,
        encryption_details: Optional[Dict] = None
    ) -> Dict:
        """
        Upload encrypted file to IPFS and log the result
        
        Args:
            encrypted_file_path: Path to the encrypted file
            session_id: Encryption session ID
            original_filename: Original filename before encryption
            encryption_details: Additional encryption metadata
            
        Returns:
            Dict containing upload results and IPFS information
        """
        try:
            print(f"[IPFS Upload] Starting upload for session {session_id}")
            
            # Test connection first
            connected, msg = self.pinata.test_connection()
            if not connected:
                return {
                    'success': False,
                    'error': f'Pinata connection failed: {msg}'
                }
            
            print(f"[IPFS Upload] Connected to Pinata successfully")
            
            # Upload encrypted file
            result = self.pinata.upload_encrypted_file(
                file_path=encrypted_file_path,
                session_id=session_id,
                original_filename=original_filename
            )
            
            if result['success']:
                print(f"[IPFS Upload] Successfully uploaded to IPFS")
                print(f"[IPFS Upload] IPFS Hash: {result['ipfs_hash']}")
                print(f"[IPFS Upload] Gateway URL: {result['gateway_url']}")
                
                # Log the upload
                log_entry = {
                    'timestamp': datetime.now().isoformat(),
                    'session_id': session_id,
                    'original_filename': original_filename,
                    'encrypted_filename': Path(encrypted_file_path).name,
                    'ipfs_hash': result['ipfs_hash'],
                    'gateway_url': result['gateway_url'],
                    'pinata_url': result['pinata_url'],
                    'file_size': result['pin_size'],
                    'encryption_details': encryption_details or {}
                }
                
                self._save_upload_log(session_id, log_entry)
                
                return {
                    'success': True,
                    'ipfs_hash': result['ipfs_hash'],
                    'gateway_url': result['gateway_url'],
                    'pinata_url': result['pinata_url'],
                    'message': 'File successfully uploaded to IPFS'
                }
            else:
                print(f"[IPFS Upload] Upload failed: {result.get('error')}")
                return result
                
        except Exception as e:
            error_msg = f"Upload error: {str(e)}"
            print(f"[IPFS Upload] {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
    
    def _save_upload_log(self, session_id: str, log_entry: Dict):
        """Save upload log to file"""
        try:
            log_file = self.upload_log_path / f"{session_id}_ipfs.json"
            with open(log_file, 'w') as f:
                json.dump(log_entry, f, indent=2)
            print(f"[IPFS Upload] Log saved to {log_file}")
        except Exception as e:
            print(f"[IPFS Upload] Failed to save log: {e}")
    
    def get_upload_info(self, session_id: str) -> Optional[Dict]:
        """
        Retrieve upload information for a session
        
        Args:
            session_id: Session ID to look up
            
        Returns:
            Dict containing upload info or None if not found
        """
        try:
            log_file = self.upload_log_path / f"{session_id}_ipfs.json"
            if log_file.exists():
                with open(log_file, 'r') as f:
                    return json.load(f)
            return None
        except Exception as e:
            print(f"[IPFS Upload] Error reading log: {e}")
            return None
    
    def list_all_uploads(self) -> list:
        """List all uploaded files"""
        uploads = []
        try:
            for log_file in self.upload_log_path.glob("*_ipfs.json"):
                with open(log_file, 'r') as f:
                    uploads.append(json.load(f))
            return sorted(uploads, key=lambda x: x['timestamp'], reverse=True)
        except Exception as e:
            print(f"[IPFS Upload] Error listing uploads: {e}")
            return []


# Global instance
_uploader_instance = None

def get_uploader() -> EncryptedFileUploader:
    """Get or create uploader instance"""
    global _uploader_instance
    if _uploader_instance is None:
        _uploader_instance = EncryptedFileUploader()
    return _uploader_instance
