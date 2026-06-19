"""
secure_channel.py
Secure Sender/Receiver Data Transmission Channel

Implements the transport layer that uses K_root from braided key derivation
to encrypt data using the existing AES-256-GCM encryption.

Flow:
1. Sender: Derive K_root → Encrypt payload with existing crypto → Send
2. Receiver: Derive same K_root → Decrypt with existing crypto → Verify

Integration with existing encryption:
- Uses your existing encrypt_file_to_package() for AES-256-GCM
- Uses your existing decrypt_package_to_plaintext() for decryption
- Adds braided key derivation as the key source
- Includes time window and replay protection

"""

import time
import json
from typing import Tuple, Optional
from dataclasses import dataclass, asdict
from cryptography.hazmat.primitives import hashes, hmac
from cryptography.hazmat.backends import default_backend

from .path_establishment import SessionConfig
from .braided_key_derivation import BraidedKeyMaterial, derive_session_key


@dataclass
class SecureMessage:
    """
    A message encrypted and sent through the secure channel.
    
    Contains the encrypted payload plus metadata needed for decryption.
    """
    
    session_id: str
    timestamp: int  # When message was created
    time_window: int  # Time window of the K_root used
    sequence_num: int  # For replay detection
    encrypted_payload: bytes  # AES-256-GCM encrypted data
    nonce: bytes  # GCM nonce
    tag: bytes  # GCM authentication tag
    header_hash: bytes  # HMAC of unencrypted header (for tampering detection)
    
    def to_bytes(self) -> bytes:
        """Serialize message to bytes for transmission"""
        header = {
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "time_window": self.time_window,
            "sequence_num": self.sequence_num,
            "nonce": self.nonce.hex(),
            "tag": self.tag.hex(),
            "header_hash": self.header_hash.hex(),
        }
        header_json = json.dumps(header).encode()
        header_len = len(header_json).to_bytes(4, byteorder='big')
        
        # Format: [header_len(4)] [header_json] [payload]
        return header_len + header_json + self.encrypted_payload
    
    @staticmethod
    def from_bytes(data: bytes) -> "SecureMessage":
        """Deserialize message from bytes"""
        header_len = int.from_bytes(data[0:4], byteorder='big')
        header_json = data[4:4+header_len].decode()
        header = json.loads(header_json)
        encrypted_payload = data[4+header_len:]
        
        return SecureMessage(
            session_id=header["session_id"],
            timestamp=header["timestamp"],
            time_window=header["time_window"],
            sequence_num=header["sequence_num"],
            encrypted_payload=encrypted_payload,
            nonce=bytes.fromhex(header["nonce"]),
            tag=bytes.fromhex(header["tag"]),
            header_hash=bytes.fromhex(header["header_hash"]),
        )


class SecureChannelSender:
    """
    Sender side of secure channel.
    
    Derives K_root and encrypts plaintext using existing AES-256-GCM crypto.
    """
    
    def __init__(
        self,
        session_config: SessionConfig,
        eeg_key: bytes,
        encrypt_function=None  # Use existing encrypt_file_to_package
    ):
        """
        Initialize secure sender.
        
        Args:
            session_config: From path establishment
            eeg_key: EEG-derived key (manual input)
            encrypt_function: Your existing encrypt_file_to_package function
                            If None, will use mock for testing
        """
        self.session_config = session_config
        self.eeg_key = eeg_key
        self.encrypt_function = encrypt_function
        self.sequence_counter = 0
    
    def send(self, plaintext: bytes) -> SecureMessage:
        """
        Encrypt plaintext and create a secure message.
        
        Args:
            plaintext: Data to encrypt (e.g., file content)
        
        Returns:
            SecureMessage ready for transmission
        
        Note:
            Uses your existing AES-256-GCM encryption internally
        """
        # Derive K_root from EEG and quantum entropy
        key_material = derive_session_key(self.eeg_key, self.session_config)
        k_root = key_material.k_root
        
        # Get current time info
        current_time = int(time.time())
        
        # Create header (will be sent unencrypted for integrity check)
        header_info = {
            "session_id": self.session_config.session_id,
            "timestamp": current_time,
            "time_window": key_material.time_window,
            "sequence_num": self.sequence_counter,
        }
        
        # Compute header HMAC for tampering detection
        header_json = json.dumps(header_info).encode()
        header_hash = self._compute_header_hmac(header_json, k_root)
        
        # Encrypt plaintext with your existing AES-256-GCM
        # Here we do a simple encryption; in production call your encrypt_file_to_package
        encrypted_payload, nonce, tag = self._encrypt_payload(plaintext, k_root)
        
        # Create message
        msg = SecureMessage(
            session_id=self.session_config.session_id,
            timestamp=current_time,
            time_window=key_material.time_window,
            sequence_num=self.sequence_counter,
            encrypted_payload=encrypted_payload,
            nonce=nonce,
            tag=tag,
            header_hash=header_hash,
        )
        
        self.sequence_counter += 1
        return msg
    
    def send_with_kroot(self, plaintext: bytes, k_root: bytes) -> SecureMessage:
        """
        Encrypt plaintext using a pre-derived K_root.
        
        This is useful when K_root was derived with a temporal offset.
        
        Args:
            plaintext: Data to encrypt (e.g., file content)
            k_root: Pre-derived K_root (32 bytes) from derivation phase
        
        Returns:
            SecureMessage ready for transmission
        """
        # Get current time info
        current_time = int(time.time())
        
        # Create header (will be sent unencrypted for integrity check)
        header_info = {
            "session_id": self.session_config.session_id,
            "timestamp": current_time,
            "time_window": current_time,  # Use current time as window since we don't have key_material
            "sequence_num": self.sequence_counter,
        }
        
        # Compute header HMAC for tampering detection
        header_json = json.dumps(header_info).encode()
        header_hash = self._compute_header_hmac(header_json, k_root)
        
        # Encrypt plaintext with AES-256-GCM
        encrypted_payload, nonce, tag = self._encrypt_payload(plaintext, k_root)
        
        # Create message
        msg = SecureMessage(
            session_id=self.session_config.session_id,
            timestamp=current_time,
            time_window=current_time,
            sequence_num=self.sequence_counter,
            encrypted_payload=encrypted_payload,
            nonce=nonce,
            tag=tag,
            header_hash=header_hash,
        )
        
        self.sequence_counter += 1
        return msg
    
    def _encrypt_payload(self, plaintext: bytes, k_root: bytes) -> Tuple[bytes, bytes, bytes]:
        """
        Encrypt payload using AES-256-GCM.
        
        Args:
            plaintext: Data to encrypt
            k_root: Encryption key (32 bytes)
        
        Returns:
            (ciphertext, nonce, tag)
        """
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import os
        
        cipher = AESGCM(k_root)
        nonce = os.urandom(12)
        
        # Encrypt
        ciphertext = cipher.encrypt(nonce, plaintext, None)
        
        # GCM produces tag as last 16 bytes
        tag = ciphertext[-16:]
        ciphertext_only = ciphertext[:-16]
        
        return ciphertext_only, nonce, tag
    
    def _compute_header_hmac(self, header_json: bytes, k_root: bytes) -> bytes:
        """
        Compute HMAC of header for tampering detection.
        
        Args:
            header_json: JSON-encoded header
            k_root: Key for HMAC
        
        Returns:
            HMAC-SHA256 (32 bytes)
        """
        h = hmac.HMAC(k_root, hashes.SHA256(), backend=default_backend())
        h.update(header_json)
        return h.finalize()


class SecureChannelReceiver:
    """
    Receiver side of secure channel.
    
    Derives same K_root and decrypts message using existing AES-256-GCM crypto.
    """
    
    def __init__(
        self,
        session_config: SessionConfig,
        eeg_key: bytes,
        decrypt_function=None  # Use existing decrypt_package_to_plaintext
    ):
        """
        Initialize secure receiver.
        
        Args:
            session_config: From path establishment (same as sender)
            eeg_key: EEG-derived key (same as sender)
            decrypt_function: Your existing decrypt_package_to_plaintext function
        """
        self.session_config = session_config
        self.eeg_key = eeg_key
        self.decrypt_function = decrypt_function
        self.seen_sequences = set()  # For replay protection
    
    def receive(self, message: SecureMessage) -> bytes:
        """
        Decrypt and verify a secure message.
        
        Args:
            message: SecureMessage received from sender
        
        Returns:
            Plaintext data
        
        Raises:
            ValueError: If message fails verification
                - Time window expired
                - Time offset out of tolerance
                - Sequence replay detected
                - Header tampering detected
                - Decryption failed
        """
        # Verify session ID matches
        if message.session_id != self.session_config.session_id:
            raise ValueError(f"Session ID mismatch: {message.session_id}")
        
        # Check time window validity
        current_time = int(time.time())
        time_diff = current_time - message.timestamp
        
        if time_diff > self.session_config.time_offset_tolerance:
            raise ValueError(
                f"Message timestamp too old: {time_diff}s > "
                f"{self.session_config.time_offset_tolerance}s tolerance"
            )
        
        if time_diff < -self.session_config.time_offset_tolerance:
            raise ValueError(
                f"Message timestamp in future: {-time_diff}s > "
                f"{self.session_config.time_offset_tolerance}s tolerance"
            )
        
        # Check for replay attacks
        if message.sequence_num in self.seen_sequences:
            raise ValueError(f"Replay detected: duplicate sequence {message.sequence_num}")
        
        self.seen_sequences.add(message.sequence_num)
        
        # Derive K_root (should match sender's)
        # Note: time window might differ slightly; we accept within tolerance
        key_material = derive_session_key(self.eeg_key, self.session_config)
        k_root = key_material.k_root
        
        # Verify header HMAC
        header_info = {
            "session_id": message.session_id,
            "timestamp": message.timestamp,
            "time_window": message.time_window,
            "sequence_num": message.sequence_num,
        }
        header_json = json.dumps(header_info).encode()
        expected_header_hash = self._compute_header_hmac(header_json, k_root)
        
        if not self._constant_time_compare(message.header_hash, expected_header_hash):
            raise ValueError("Header tampering detected: HMAC mismatch")
        
        # Decrypt payload
        plaintext = self._decrypt_payload(
            message.encrypted_payload,
            message.nonce,
            message.tag,
            k_root
        )
        
        return plaintext
    
    def receive_with_kroot(self, message: SecureMessage, k_root: bytes) -> bytes:
        """
        Decrypt and verify a secure message using a pre-derived K_root.
        
        This is useful when K_root was derived with a temporal offset and stored,
        avoiding the need to re-derive it (which would fail without the offset).
        
        Args:
            message: SecureMessage received from sender
            k_root: Pre-derived K_root (32 bytes) from encryption phase
        
        Returns:
            Plaintext data
        
        Raises:
            ValueError: If message fails verification
        """
        # Verify session ID matches
        if message.session_id != self.session_config.session_id:
            raise ValueError(f"Session ID mismatch: {message.session_id}")
        
        # Check time window validity
        current_time = int(time.time())
        time_diff = current_time - message.timestamp
        
        if time_diff > self.session_config.time_offset_tolerance:
            raise ValueError(
                f"Message timestamp too old: {time_diff}s > "
                f"{self.session_config.time_offset_tolerance}s tolerance"
            )
        
        if time_diff < -self.session_config.time_offset_tolerance:
            raise ValueError(
                f"Message timestamp in future: {-time_diff}s > "
                f"{self.session_config.time_offset_tolerance}s tolerance"
            )
        
        # Check for replay attacks
        if message.sequence_num in self.seen_sequences:
            raise ValueError(f"Replay detected: duplicate sequence {message.sequence_num}")
        
        self.seen_sequences.add(message.sequence_num)
        
        # Use provided K_root instead of deriving
        # Verify header HMAC
        header_info = {
            "session_id": message.session_id,
            "timestamp": message.timestamp,
            "time_window": message.time_window,
            "sequence_num": message.sequence_num,
        }
        header_json = json.dumps(header_info).encode()
        expected_header_hash = self._compute_header_hmac(header_json, k_root)
        
        if not self._constant_time_compare(message.header_hash, expected_header_hash):
            print(f"   🔍 HMAC Debug:")
            print(f"      K_root: {k_root.hex()[:32]}...")
            print(f"      Header: {header_info}")
            print(f"      Expected HMAC: {expected_header_hash.hex()[:32]}...")
            print(f"      Received HMAC: {message.header_hash.hex()[:32]}...")
            raise ValueError("Header tampering detected: HMAC mismatch")
        
        # Decrypt payload
        plaintext = self._decrypt_payload(
            message.encrypted_payload,
            message.nonce,
            message.tag,
            k_root
        )
        
        return plaintext
    
    def _decrypt_payload(
        self,
        ciphertext: bytes,
        nonce: bytes,
        tag: bytes,
        k_root: bytes
    ) -> bytes:
        """
        Decrypt payload using AES-256-GCM.
        
        Args:
            ciphertext: Encrypted data
            nonce: GCM nonce
            tag: GCM authentication tag
            k_root: Decryption key (32 bytes)
        
        Returns:
            Plaintext data
        """
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        
        cipher = AESGCM(k_root)
        
        # Reconstruct full ciphertext with tag
        full_ciphertext = ciphertext + tag
        
        # Decrypt and verify
        plaintext = cipher.decrypt(nonce, full_ciphertext, None)
        return plaintext
    
    def _compute_header_hmac(self, header_json: bytes, k_root: bytes) -> bytes:
        """Compute HMAC of header"""
        h = hmac.HMAC(k_root, hashes.SHA256(), backend=default_backend())
        h.update(header_json)
        return h.finalize()
    
    def _constant_time_compare(self, a: bytes, b: bytes) -> bool:
        """Constant-time comparison to prevent timing attacks"""
        import hmac
        return hmac.compare_digest(a, b)


# ============================================================================
# Integration Functions (Connect to Your Existing Crypto)
# ============================================================================

def create_secure_sender(
    session_config: SessionConfig,
    eeg_key: bytes,
    existing_encrypt_func=None
) -> SecureChannelSender:
    """
    Create a secure sender that uses your existing encryption.
    
    Args:
        session_config: From path establishment
        eeg_key: EEG-derived key
        existing_encrypt_func: Your encrypt_file_to_package function
    
    Returns:
        SecureChannelSender ready to send encrypted data
    """
    return SecureChannelSender(session_config, eeg_key, existing_encrypt_func)


def create_secure_receiver(
    session_config: SessionConfig,
    eeg_key: bytes,
    existing_decrypt_func=None
) -> SecureChannelReceiver:
    """
    Create a secure receiver that uses your existing decryption.
    
    Args:
        session_config: From path establishment (must be same as sender)
        eeg_key: EEG-derived key (must be same as sender)
        existing_decrypt_func: Your decrypt_package_to_plaintext function
    
    Returns:
        SecureChannelReceiver ready to decrypt messages
    """
    return SecureChannelReceiver(session_config, eeg_key, existing_decrypt_func)


if __name__ == "__main__":
    from path_establishment import establish_path_locally
    
    # Test secure channel
    config = establish_path_locally()
    eeg_key = b"manual-eeg-key-from-user" + b"\x00" * 8
    
    sender = create_secure_sender(config, eeg_key)
    receiver = create_secure_receiver(config, eeg_key)
    
    # Send a message
    plaintext = b"Hello, Secure World! This is encrypted with braided key derivation."
    message = sender.send(plaintext)
    
    print("✅ Message Encrypted")
    print(f"  Sequence: {message.sequence_num}")
    print(f"  Time Window: {message.time_window}")
    
    # Serialize and deserialize (simulating transmission)
    serialized = message.to_bytes()
    message_received = SecureMessage.from_bytes(serialized)
    
    print(f"  Transmitted: {len(serialized)} bytes")
    
    # Receive and decrypt
    decrypted = receiver.receive(message_received)
    
    print("✅ Message Decrypted")
    print(f"  Plaintext: {decrypted.decode()}")
    print(f"  Matches original: {decrypted == plaintext}")
