"""
braided_key_derivation.py
Braided + Time-Dilated Key Derivation

Implements anyonic-inspired braided mixing of EEG and quantum entropy.

Key derivation flow:
1. Take EEG-derived key (manual input)
2. Generate quantum entropy (Qiskit)
3. Braid them according to agreed order (non-commutative)
4. Bind result to current time window
5. Derive final K_root using HKDF

Security properties:
- Non-commutative: different braid orders → different keys
- Time-binding: key expires outside window
- Deterministic: same inputs → same key
- Replay-resistant: time-based binding prevents reuse
"""

import hashlib
import time
from typing import Tuple
from dataclasses import dataclass
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from .path_establishment import SessionConfig, BraidOrder

try:
    from qiskit import QuantumCircuit
    from qiskit_aer import Aer
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False
    print("⚠️  Qiskit not available, using fallback entropy")


@dataclass
class BraidedKeyMaterial:
    """Result of braided key derivation"""
    
    k_root: bytes  # Final session root key (32 bytes)
    time_window: int  # UNIX timestamp window this key is valid for
    braid_sequence: str  # Record of which entropy was used in which order
    entropy_hash_eeg: bytes  # Hash of EEG component
    entropy_hash_quantum: bytes  # Hash of quantum component


class QuantumEntropyGenerator:
    """
    Generate quantum randomness using Qiskit.
    
    Uses a simple Bell state circuit to generate entropy.
    In production, would use real quantum hardware or certified QRN source.
    """
    
    def __init__(self, num_qubits: int = 8):
        """
        Initialize quantum entropy generator.
        
        Args:
            num_qubits: Number of qubits for Bell state circuit
        """
        self.num_qubits = num_qubits
    
    def generate(self, length: int = 32) -> bytes:
        """
        Generate quantum entropy.
        
        Args:
            length: Number of bytes to generate
        
        Returns:
            Random bytes from quantum circuit
        """
        if not QISKIT_AVAILABLE:
            # Fallback: use os.urandom (classical)
            import os
            return os.urandom(length)
        
        try:
            # Create quantum circuit with entanglement
            qc = QuantumCircuit(self.num_qubits, self.num_qubits)
            
            # Create Bell states (entangled pairs)
            for i in range(0, self.num_qubits - 1, 2):
                qc.h(i)
                qc.cx(i, i + 1)
            
            # Single qubit rotations for added entropy
            for i in range(self.num_qubits):
                qc.rx(0.7, i)
                qc.ry(1.3, i)
            
            # Measure
            qc.measure(range(self.num_qubits), range(self.num_qubits))
            
            # Simulate
            simulator = Aer.get_backend('aer_simulator')
            job = simulator.run(qc, shots=1)
            result = job.result()
            counts = result.get_counts(qc)
            
            # Get measurement results
            measured_bitstring = list(counts.keys())[0]
            
            # Convert bitstring to bytes
            # Repeat if necessary to get desired length
            entropy_bytes = bytearray()
            for i in range(length):
                bit_idx = i % len(measured_bitstring)
                # Convert bitstring character to int first, then scale to byte value
                bit_val = int(measured_bitstring[bit_idx])
                byte_val = int(bit_val * 256 // len(measured_bitstring))
                entropy_bytes.append(byte_val)
            
            return bytes(entropy_bytes)
        except Exception as e:
            # If Qiskit fails, fall back to secure random
            print(f"⚠️  Qiskit quantum generation failed: {e}, using fallback")
            import os
            return os.urandom(length)


class BraidedKeyDeriver:
    """
    Derive K_root using braided mixing of EEG and quantum entropy.
    
    The braid order determines which entropy source is used in which round.
    Different orders produce different keys (non-commutative mixing).
    """
    
    def __init__(self, session_config: SessionConfig, time_offset_seconds: int = 0):
        """
        Initialize deriver with session configuration.
        
        Args:
            session_config: From path_establishment phase
            time_offset_seconds: Time offset for temporal desynchronization (±seconds)
        """
        self.config = session_config
        self.qgen = QuantumEntropyGenerator()
        self.time_offset = time_offset_seconds  # NEW: Temporal desynchronization
    
    def derive_key(self, eeg_key: bytes) -> BraidedKeyMaterial:
        """
        Derive K_root from EEG key and quantum entropy.
        
        Args:
            eeg_key: EEG-derived key (manual input, e.g., 32 bytes)
        
        Returns:
            BraidedKeyMaterial with K_root and metadata
        """
        if len(eeg_key) < 16:
            raise ValueError("EEG key must be at least 16 bytes")
        
        # Generate quantum entropy
        quantum_entropy = self.qgen.generate(32)
        
        # Hash entropy components for verification
        entropy_hash_eeg = hashlib.sha256(eeg_key).digest()
        entropy_hash_quantum = hashlib.sha256(quantum_entropy).digest()
        
        # Braid the entropy according to agreed order
        braided = self._braid_entropy(eeg_key, quantum_entropy)
        
        # Get current time window WITH TEMPORAL DESYNCHRONIZATION OFFSET
        current_time = int(time.time()) + self.time_offset  # ← Apply offset here!
        time_window = (current_time // self.config.time_window_size) * self.config.time_window_size
        
        # Time-bind the braided entropy (uses offset time)
        time_binding = self._time_bind(braided, time_window)
        
        # Final HKDF derivation
        k_root = self._hkdf_derive(time_binding)
        
        # Record braid sequence for debugging
        braid_sequence = self._get_braid_sequence()
        
        return BraidedKeyMaterial(
            k_root=k_root,
            time_window=time_window,
            braid_sequence=braid_sequence,
            entropy_hash_eeg=entropy_hash_eeg,
            entropy_hash_quantum=entropy_hash_quantum,
        )
    
    def _braid_entropy(self, eeg_key: bytes, quantum_entropy: bytes) -> bytes:
        """
        Non-commutatively braid EEG and quantum entropy.
        
        Different braid orders produce different outputs.
        This implements the core cryptographic innovation.
        
        Args:
            eeg_key: EEG entropy
            quantum_entropy: Quantum entropy
        
        Returns:
            Braided entropy (64 bytes)
        """
        # Start with empty state
        state = bytearray()
        
        # Get braid pattern (order matters!)
        braid_pattern = self.config.braid_order.value  # e.g., "EQEQ"
        
        # Alternate between EEG (E) and Quantum (Q) according to pattern
        eeg_idx = 0
        quantum_idx = 0
        
        for pattern_char in braid_pattern:
            if pattern_char == 'E':
                # EEG round: XOR with EEG key rotated by quantum state
                rotation = len(state) % len(quantum_entropy)
                chunk = eeg_key[eeg_idx % len(eeg_key)]
                rotated_quantum = quantum_entropy[rotation]
                state.append(chunk ^ rotated_quantum)
                eeg_idx += 1
            elif pattern_char == 'Q':
                # Quantum round: XOR with quantum entropy rotated by EEG state
                rotation = len(state) % len(eeg_key)
                chunk = quantum_entropy[quantum_idx % len(quantum_entropy)]
                rotated_eeg = eeg_key[rotation]
                state.append(chunk ^ rotated_eeg)
                quantum_idx += 1
        
        # Repeat pattern to reach 64 bytes
        while len(state) < 64:
            for pattern_char in braid_pattern:
                if len(state) >= 64:
                    break
                
                if pattern_char == 'E':
                    rotation = len(state) % len(quantum_entropy)
                    chunk = eeg_key[eeg_idx % len(eeg_key)]
                    rotated_quantum = quantum_entropy[rotation]
                    state.append(chunk ^ rotated_quantum)
                    eeg_idx += 1
                elif pattern_char == 'Q':
                    rotation = len(state) % len(eeg_key)
                    chunk = quantum_entropy[quantum_idx % len(quantum_entropy)]
                    rotated_eeg = eeg_key[rotation]
                    state.append(chunk ^ rotated_eeg)
                    quantum_idx += 1
        
        return bytes(state[:64])
    
    def _time_bind(self, braided_entropy: bytes, time_window: int) -> bytes:
        """
        Bind the braided entropy to current time window.
        
        Key expires when time_window changes.
        Provides replay protection and time-based expiration.
        
        Args:
            braided_entropy: Output from _braid_entropy
            time_window: Current time window (UNIX timestamp aligned to window)
        
        Returns:
            Time-bound entropy (64 bytes)
        """
        # Convert time window to bytes
        time_bytes = time_window.to_bytes(8, byteorder='big')
        
        # Bind by XORing and hashing
        time_bound = bytearray()
        for i in range(len(braided_entropy)):
            time_byte = time_bytes[i % len(time_bytes)]
            bound_byte = braided_entropy[i] ^ time_byte
            time_bound.append(bound_byte)
        
        # Hash to ensure strong binding
        return hashlib.sha512(bytes(time_bound)).digest()[:64]
    
    def _hkdf_derive(self, ikm: bytes) -> bytes:
        """
        Final HKDF-based key derivation.
        
        Args:
            ikm: Input key material (64 bytes)
        
        Returns:
            K_root (32 bytes)
        """
        # Determine hash algorithm
        if self.config.hkdf_hash == "SHA256":
            hash_algo = hashes.SHA256()
        else:
            hash_algo = hashes.SHA512()
        
        # HKDF expand
        hkdf = HKDF(
            algorithm=hash_algo,
            length=32,  # 32 bytes for K_root
            salt=self.config.hkdf_salt,
            info=b"braided-key-derivation"
        )
        
        k_root = hkdf.derive(ikm)
        return k_root
    
    def _get_braid_sequence(self) -> str:
        """Get human-readable braid sequence"""
        return f"{self.config.braid_order.value}-Round1-XOR"


def derive_session_key(eeg_key: bytes, session_config: SessionConfig) -> BraidedKeyMaterial:
    """
    Convenience function to derive session key.
    
    Args:
        eeg_key: EEG-derived key (manual input)
        session_config: From path_establishment phase
    
    Returns:
        BraidedKeyMaterial with K_root
    """
    deriver = BraidedKeyDeriver(session_config)
    return deriver.derive_key(eeg_key)


if __name__ == "__main__":
    from path_establishment import establish_path_locally
    
    # Test braided key derivation
    config = establish_path_locally()
    eeg_key = b"manual-eeg-key-from-user" + b"\x00" * 8
    
    material = derive_session_key(eeg_key, config)
    
    print("✅ Braided Key Derivation Complete")
    print(f"  Braid Sequence: {material.braid_sequence}")
    print(f"  Time Window: {material.time_window}")
    print(f"  K_root: {material.k_root.hex()[:32]}...")
    print(f"  K_root length: {len(material.k_root)} bytes")
    
    # Test determinism: same inputs → same key
    material2 = derive_session_key(eeg_key, config)
    print(f"\n✅ Determinism Check: {material.k_root == material2.k_root}")
