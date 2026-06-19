"""
path_establishment.py
Pre-Key-Exchange Path Establishment Protocol

This module handles the initial handshake between sender and receiver
to establish agreed session parameters BEFORE any key exchange occurs.

No cryptographic secrets are exchanged here—only structural agreements.

Flow:
1. Initiator sends PathInitiate with proposed parameters
2. Responder sends PathAccept with agreed parameters
3. Both derive identical SessionConfig object
4. This config is used in braided key exchange phase
"""

import json
import secrets
import uuid
from dataclasses import dataclass
from typing import Tuple, Dict, Any
from enum import Enum


class BraidOrder(Enum):
    """Braid patterns for entropy interleaving"""
    EEG_QUANTUM_EEG_QUANTUM = "EQEQ"
    QUANTUM_EEG_QUANTUM_EEG = "QEQE"
    EEG_EEG_QUANTUM_QUANTUM = "EEQQ"
    QUANTUM_QUANTUM_EEG_EEG = "QQEE"
    EEG_QUANTUM_QUANTUM_EEG = "EQQE"


@dataclass
class SessionConfig:
    """
    Agreed session parameters (NO SECRETS)
    
    This object is derived from path establishment and used by both
    sender and receiver to configure their key derivation.
    """
    
    session_id: str  # UUID for this session
    braid_order: BraidOrder  # Which entropy to use in which order
    time_window_size: int  # Seconds (e.g., 3, 5, 10)
    time_offset_tolerance: int  # Seconds (e.g., 2)
    hkdf_hash: str  # "SHA512" or "SHA256"
    hkdf_salt: bytes  # Random 32 bytes for HKDF
    initiator_nonce: bytes  # For replay protection
    responder_nonce: bytes  # For replay protection
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to JSON-compatible dict"""
        return {
            "session_id": self.session_id,
            "braid_order": self.braid_order.value,
            "time_window_size": self.time_window_size,
            "time_offset_tolerance": self.time_offset_tolerance,
            "hkdf_hash": self.hkdf_hash,
            "hkdf_salt": self.hkdf_salt.hex(),
            "initiator_nonce": self.initiator_nonce.hex(),
            "responder_nonce": self.responder_nonce.hex(),
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "SessionConfig":
        """Deserialize from JSON dict"""
        return SessionConfig(
            session_id=data["session_id"],
            braid_order=BraidOrder(data["braid_order"]),
            time_window_size=data["time_window_size"],
            time_offset_tolerance=data["time_offset_tolerance"],
            hkdf_hash=data["hkdf_hash"],
            hkdf_salt=bytes.fromhex(data["hkdf_salt"]),
            initiator_nonce=bytes.fromhex(data["initiator_nonce"]),
            responder_nonce=bytes.fromhex(data["responder_nonce"]),
        )


class PathInitiator:
    """
    Initiator side of path establishment.
    
    Proposes session parameters and sends them to responder.
    """
    
    def __init__(
        self,
        braid_order: BraidOrder = BraidOrder.EEG_QUANTUM_EEG_QUANTUM,
        time_window_size: int = 5,
        time_offset_tolerance: int = 300,
        hkdf_hash: str = "SHA512"
    ):
        """
        Initialize path initiator with proposed parameters.
        
        Args:
            braid_order: Order of entropy sources (EEG vs Quantum)
            time_window_size: Seconds for time-window binding
            time_offset_tolerance: Allowed clock drift (seconds)
            hkdf_hash: Hash algorithm for HKDF ("SHA512" or "SHA256")
        """
        self.session_id = str(uuid.uuid4())
        self.braid_order = braid_order
        self.time_window_size = time_window_size
        self.time_offset_tolerance = time_offset_tolerance
        self.hkdf_hash = hkdf_hash
        self.initiator_nonce = secrets.token_bytes(32)
        self.responder_nonce = None
    
    def create_proposal(self) -> Dict[str, Any]:
        """
        Create a JSON proposal message to send to responder.
        
        Returns:
            {
                "type": "PathInitiate",
                "session_id": UUID,
                "braid_order": "EQEQ",
                "time_window_size": 5,
                "time_offset_tolerance": 2,
                "hkdf_hash": "SHA512",
                "initiator_nonce": hex(32 bytes)
            }
        """
        return {
            "type": "PathInitiate",
            "session_id": self.session_id,
            "braid_order": self.braid_order.value,
            "time_window_size": self.time_window_size,
            "time_offset_tolerance": self.time_offset_tolerance,
            "hkdf_hash": self.hkdf_hash,
            "initiator_nonce": self.initiator_nonce.hex(),
        }
    
    def accept_response(self, response: Dict[str, Any]) -> SessionConfig:
        """
        Process responder's acceptance message.
        
        Args:
            response: {"type": "PathAccept", "responder_nonce": hex(...), 
                      "hkdf_salt": hex(...)}
        
        Returns:
            SessionConfig object (final agreed parameters)
        """
        if response.get("type") != "PathAccept":
            raise ValueError("Expected PathAccept response")
        
        self.responder_nonce = bytes.fromhex(response["responder_nonce"])
        hkdf_salt = bytes.fromhex(response["hkdf_salt"])
        
        # Create final session config with agreed parameters
        config = SessionConfig(
            session_id=self.session_id,
            braid_order=self.braid_order,
            time_window_size=self.time_window_size,
            time_offset_tolerance=self.time_offset_tolerance,
            hkdf_hash=self.hkdf_hash,
            hkdf_salt=hkdf_salt,
            initiator_nonce=self.initiator_nonce,
            responder_nonce=self.responder_nonce,
        )
        
        return config


class PathResponder:
    """
    Responder side of path establishment.
    
    Receives initiator's proposal and agrees to parameters.
    """
    
    def process_proposal(self, proposal: Dict[str, Any]) -> Tuple[Dict[str, Any], SessionConfig]:
        """
        Process initiator's PathInitiate proposal.
        
        Args:
            proposal: Initiator's proposed parameters
        
        Returns:
            (response_message, SessionConfig)
            
        response_message is sent back to initiator
        """
        if proposal.get("type") != "PathInitiate":
            raise ValueError("Expected PathInitiate proposal")
        
        # Accept all proposed parameters
        session_id = proposal["session_id"]
        braid_order = BraidOrder(proposal["braid_order"])
        time_window_size = proposal["time_window_size"]
        time_offset_tolerance = proposal["time_offset_tolerance"]
        hkdf_hash = proposal["hkdf_hash"]
        initiator_nonce = bytes.fromhex(proposal["initiator_nonce"])
        
        # Responder generates its own nonce and HKDF salt
        responder_nonce = secrets.token_bytes(32)
        hkdf_salt = secrets.token_bytes(32)
        
        # Create acceptance response
        response = {
            "type": "PathAccept",
            "responder_nonce": responder_nonce.hex(),
            "hkdf_salt": hkdf_salt.hex(),
        }
        
        # Create final session config
        config = SessionConfig(
            session_id=session_id,
            braid_order=braid_order,
            time_window_size=time_window_size,
            time_offset_tolerance=time_offset_tolerance,
            hkdf_hash=hkdf_hash,
            hkdf_salt=hkdf_salt,
            initiator_nonce=initiator_nonce,
            responder_nonce=responder_nonce,
        )
        
        return response, config


# ============================================================================
# Convenience Functions
# ============================================================================

def establish_path_locally() -> SessionConfig:
    """
    Simulate path establishment locally (for testing).
    
    In production, this would involve actual network communication.
    Here we just run both sides in sequence to get a valid SessionConfig.
    
    Returns:
        Agreed SessionConfig object
    """
    # Initiator proposes
    initiator = PathInitiator(
        braid_order=BraidOrder.EEG_QUANTUM_EEG_QUANTUM,
        time_window_size=5,
        time_offset_tolerance=300,
        hkdf_hash="SHA512"
    )
    proposal = initiator.create_proposal()
    
    # Responder accepts
    responder = PathResponder()
    response, config = responder.process_proposal(proposal)
    
    # Initiator finalizes
    config = initiator.accept_response(response)
    
    return config


if __name__ == "__main__":
    # Test path establishment
    config = establish_path_locally()
    print("✅ Path Establishment Complete")
    print(f"  Session ID: {config.session_id}")
    print(f"  Braid Order: {config.braid_order.value}")
    print(f"  Time Window: {config.time_window_size}s")
    print(f"  HKDF Salt: {config.hkdf_salt.hex()[:16]}...")
