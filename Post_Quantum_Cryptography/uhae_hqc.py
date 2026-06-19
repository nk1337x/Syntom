"""
uhae_hqc.py
Unified Hybrid Authenticated Encryption with HQC
Full encryption/decryption engine with:
- HQC-128 key encapsulation
- Dilithium3 signatures
- Qiskit quantum entanglement
- Time dilation
- EEG key integration
- Genetic mutation + ratcheting
"""

import os
import json
import struct
from typing import Tuple, List

from .crypto_core import (
    HQC_KEM, Dilithium_Sign, AES_GCM_Cipher,
    derive_key_hkdf, compute_hmac, genetic_mutation, ratchet_key,
    generate_quantum_entropy, load_entanglement_seeds, secure_random_bytes
)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from Time_Security.time_dilation import derive_time_salt, compute_time_drift


# ============================================================================
# CONSTANTS
# ============================================================================

CHUNK_SIZE = 64 * 1024  # 64 KB chunks
HEADER_MAGIC = b"BWCRYPT1"


# ============================================================================
# ENCRYPTION ENGINE
# ============================================================================

def encrypt_stream(
    plaintext: bytes,
    eeg_key: bytes,
    entanglement_seeds: List[bytes],
    receiver_hqc_public_key: bytes,
    sender_dilithium_secret_key: bytes
) -> bytes:
    """
    Full encryption flow:
    1. HQC encapsulation
    2. Dilithium signing
    3. Quantum entropy generation
    4. Time dilation salt
    5. Root key derivation (HKDF)
    6. Chunk-by-chunk encryption with mutation and ratcheting
    """
    
    if len(eeg_key) != 32:
        raise ValueError("EEG key must be exactly 32 bytes")
    
    # Step 1: HQC Key Encapsulation
    hqc = HQC_KEM()
    hqc_ciphertext, hqc_shared_secret = hqc.encapsulate(receiver_hqc_public_key)
    
    # Step 2: Generate quantum entropy from first entanglement seed
    if len(entanglement_seeds) == 0:
        raise ValueError("No entanglement seeds provided")
    
    quantum_entropy = generate_quantum_entropy(entanglement_seeds[0])
    
    # Step 3: Derive time salt (sequence 0 for initial)
    time_salt = derive_time_salt(eeg_key, quantum_entropy, sequence=0)
    
    # Step 4: Derive root key using HKDF
    # Combine: shared_secret || eeg_key || quantum_entropy || time_salt
    root_key_material = hqc_shared_secret + eeg_key + quantum_entropy + time_salt
    root_key = derive_key_hkdf(
        input_key_material=root_key_material,
        salt=b"BrainWaveCrypt_RootKey",
        info=b"UHAE_HQC_v1",
        length=32
    )
    
    # Step 5: Sign the root key material with Dilithium
    dil = Dilithium_Sign()
    signature = dil.sign(root_key_material, sender_dilithium_secret_key)
    
    # Step 6: Encrypt plaintext chunk by chunk
    encrypted_chunks = []
    chunk_index = 0
    offset = 0
    
    current_root_key = root_key
    
    while offset < len(plaintext):
        chunk = plaintext[offset:offset + CHUNK_SIZE]
        
        # Get seed for this chunk (cycle through seeds)
        seed_index = chunk_index % len(entanglement_seeds)
        chunk_quantum_entropy = generate_quantum_entropy(entanglement_seeds[seed_index])
        
        # Derive time salt for this chunk
        chunk_time_salt = derive_time_salt(eeg_key, chunk_quantum_entropy, chunk_index)
        
        # Generate mutation tag
        mutation_tag = genetic_mutation(current_root_key, chunk_index, chunk_quantum_entropy)
        
        # Derive AES key and nonce from current root key
        aes_key_material = derive_key_hkdf(
            input_key_material=current_root_key + mutation_tag,
            salt=chunk_time_salt,
            info=b"AES_KEY" + chunk_index.to_bytes(8, 'big'),
            length=44  # 32 for key + 12 for nonce
        )
        aes_key = aes_key_material[:32]
        aes_nonce = aes_key_material[32:44]
        
        # Associated data includes chunk index and mutation tag
        associated_data = struct.pack(">Q", chunk_index) + mutation_tag[:16]
        
        # Encrypt chunk with AES-256-GCM
        ciphertext_chunk = AES_GCM_Cipher.encrypt(
            key=aes_key,
            nonce=aes_nonce,
            plaintext=chunk,
            associated_data=associated_data
        )
        
        encrypted_chunks.append(ciphertext_chunk)
        
        # Ratchet root key forward
        current_root_key = ratchet_key(current_root_key, chunk_index, chunk_quantum_entropy, chunk_time_salt)
        
        offset += CHUNK_SIZE
        chunk_index += 1
    
    # Step 7: Build header
    header = {
        "version": 1,
        "hqc_ciphertext": hqc_ciphertext.hex(),
        "signature": signature.hex(),
        "quantum_seed_index": 0,
        "total_chunks": len(encrypted_chunks),
        "chunk_size": CHUNK_SIZE
    }
    
    header_json = json.dumps(header).encode('utf-8')
    header_length = len(header_json)
    
    # Step 8: Assemble final ciphertext
    # Format: MAGIC (8) | HEADER_LEN (4) | HEADER | CHUNKS
    output = bytearray()
    output.extend(HEADER_MAGIC)
    output.extend(struct.pack(">I", header_length))
    output.extend(header_json)
    
    for chunk_ct in encrypted_chunks:
        output.extend(struct.pack(">I", len(chunk_ct)))
        output.extend(chunk_ct)
    
    return bytes(output)


# ============================================================================
# DECRYPTION ENGINE
# ============================================================================

def decrypt_stream(
    ciphertext: bytes,
    eeg_key: bytes,
    entanglement_seeds: List[bytes],
    receiver_hqc_secret_key: bytes,
    sender_dilithium_public_key: bytes
) -> bytes:
    """
    Full decryption flow:
    1. Parse header
    2. HQC decapsulation
    3. Quantum entropy reconstruction
    4. Time dilation salt
    5. Root key derivation
    6. Signature verification
    7. Chunk-by-chunk decryption with ratcheting
    """
    
    if len(eeg_key) != 32:
        raise ValueError("EEG key must be exactly 32 bytes")
    
    # Step 1: Parse ciphertext structure
    offset = 0
    
    magic = ciphertext[offset:offset+8]
    offset += 8
    
    if magic != HEADER_MAGIC:
        raise ValueError("Invalid ciphertext: bad magic header")
    
    header_length = struct.unpack(">I", ciphertext[offset:offset+4])[0]
    offset += 4
    
    header_json = ciphertext[offset:offset+header_length]
    offset += header_length
    
    header = json.loads(header_json.decode('utf-8'))
    
    # Extract header fields
    hqc_ciphertext = bytes.fromhex(header["hqc_ciphertext"])
    signature = bytes.fromhex(header["signature"])
    total_chunks = header["total_chunks"]
    
    # Step 2: HQC Decapsulation
    hqc = HQC_KEM()
    hqc_shared_secret = hqc.decapsulate(hqc_ciphertext, receiver_hqc_secret_key)
    
    # Step 3: Reconstruct quantum entropy
    if len(entanglement_seeds) == 0:
        raise ValueError("No entanglement seeds provided")
    
    quantum_entropy = generate_quantum_entropy(entanglement_seeds[0])
    
    # Step 4: Derive time salt
    time_salt = derive_time_salt(eeg_key, quantum_entropy, sequence=0)
    
    # Step 5: Derive root key
    root_key_material = hqc_shared_secret + eeg_key + quantum_entropy + time_salt
    root_key = derive_key_hkdf(
        input_key_material=root_key_material,
        salt=b"BrainWaveCrypt_RootKey",
        info=b"UHAE_HQC_v1",
        length=32
    )
    
    # Step 6: Verify Dilithium signature
    dil = Dilithium_Sign()
    signature_valid = dil.verify(root_key_material, signature, sender_dilithium_public_key)
    
    if not signature_valid:
        raise ValueError("Signature verification failed - message may be tampered")
    
    # Step 7: Decrypt chunks
    plaintext_chunks = []
    chunk_index = 0
    current_root_key = root_key
    
    for _ in range(total_chunks):
        # Read chunk length and data
        chunk_length = struct.unpack(">I", ciphertext[offset:offset+4])[0]
        offset += 4
        
        chunk_ct = ciphertext[offset:offset+chunk_length]
        offset += chunk_length
        
        # Get seed for this chunk
        seed_index = chunk_index % len(entanglement_seeds)
        chunk_quantum_entropy = generate_quantum_entropy(entanglement_seeds[seed_index])
        
        # Derive time salt for this chunk
        chunk_time_salt = derive_time_salt(eeg_key, chunk_quantum_entropy, chunk_index)
        
        # Generate mutation tag
        mutation_tag = genetic_mutation(current_root_key, chunk_index, chunk_quantum_entropy)
        
        # Derive AES key and nonce
        aes_key_material = derive_key_hkdf(
            input_key_material=current_root_key + mutation_tag,
            salt=chunk_time_salt,
            info=b"AES_KEY" + chunk_index.to_bytes(8, 'big'),
            length=44
        )
        aes_key = aes_key_material[:32]
        aes_nonce = aes_key_material[32:44]
        
        # Associated data
        associated_data = struct.pack(">Q", chunk_index) + mutation_tag[:16]
        
        # Decrypt chunk
        try:
            plaintext_chunk = AES_GCM_Cipher.decrypt(
                key=aes_key,
                nonce=aes_nonce,
                ciphertext=chunk_ct,
                associated_data=associated_data
            )
        except Exception as e:
            raise ValueError(f"Decryption failed at chunk {chunk_index}: {str(e)}")
        
        plaintext_chunks.append(plaintext_chunk)
        
        # Ratchet root key forward
        current_root_key = ratchet_key(current_root_key, chunk_index, chunk_quantum_entropy, chunk_time_salt)
        
        chunk_index += 1
    
    # Combine all plaintext chunks
    plaintext = b"".join(plaintext_chunks)
    
    return plaintext


# ============================================================================
# KEY GENERATION UTILITIES
# ============================================================================

def generate_hqc_keypair() -> Tuple[bytes, bytes]:
    """Generate HQC-128 keypair"""
    hqc = HQC_KEM()
    return hqc.generate_keypair()


def generate_dilithium_keypair() -> Tuple[bytes, bytes]:
    """Generate Dilithium3 keypair"""
    dil = Dilithium_Sign()
    return dil.generate_keypair()


if __name__ == "__main__":
    print("BrainWaveCrypt UHAE Engine")
    print("=" * 50)
    
    # Generate test keys
    print("\n[Generating Test Keys]")
    
    # EEG key (manual input in production)
    eeg_key = secure_random_bytes(32)
    print(f"✓ EEG Key: {eeg_key.hex()[:32]}...")
    
    # HQC keypairs
    receiver_hqc_pub, receiver_hqc_sec = generate_hqc_keypair()
    print(f"✓ Receiver HQC keys generated")
    
    # Dilithium keypairs
    sender_dil_pub, sender_dil_sec = generate_dilithium_keypair()
    print(f"✓ Sender Dilithium keys generated")
    
    # Entanglement seeds
    from crypto_core import generate_entanglement_seed_csv
    test_csv = "test_entanglement.csv"
    generate_entanglement_seed_csv(test_csv, num_seeds=10)
    entanglement_seeds = load_entanglement_seeds(test_csv)
    print(f"✓ Loaded {len(entanglement_seeds)} entanglement seeds")
    
    # Test encryption/decryption
    print("\n[Testing Encryption/Decryption]")
    test_plaintext = b"This is a secret message protected by quantum-resistant encryption, EEG biometrics, and time dilation!" * 1000
    print(f"✓ Plaintext size: {len(test_plaintext)} bytes")
    
    ciphertext = encrypt_stream(
        plaintext=test_plaintext,
        eeg_key=eeg_key,
        entanglement_seeds=entanglement_seeds,
        receiver_hqc_public_key=receiver_hqc_pub,
        sender_dilithium_secret_key=sender_dil_sec
    )
    print(f"✓ Ciphertext size: {len(ciphertext)} bytes")
    
    decrypted = decrypt_stream(
        ciphertext=ciphertext,
        eeg_key=eeg_key,
        entanglement_seeds=entanglement_seeds,
        receiver_hqc_secret_key=receiver_hqc_sec,
        sender_dilithium_public_key=sender_dil_pub
    )
    print(f"✓ Decrypted size: {len(decrypted)} bytes")
    
    # Verify
    if test_plaintext == decrypted:
        print("\n✅ SUCCESS: Encryption and decryption successful!")
    else:
        print("\n❌ FAILURE: Decryption mismatch!")
    
    # Cleanup
    os.remove(test_csv)
    print(f"\n✓ Cleaned up test file")