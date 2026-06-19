"""
Hybrid AES + HQC (KEM) + Dilithium (signature) - OPTIMIZED
- Encrypt large files with AES-256-GCM (chunked)
- Protect AES key using HQC shared secret (KEK via HKDF) and AES-GCM wrap
- Sign package header with Dilithium (ML-DSA-44 optimized by default)

OPTIMIZATIONS:
1. Smaller Signature: ML-DSA-44 (26% smaller, ~1793 B vs 2420 B)
2. Session Caching: One HQC handshake, reuse key for multiple chunks
3. Compression: Optional zlib before encryption (10-30% savings)
4. Counter Nonces: Deterministic counter vs random (eliminates RNG overhead)

Package format (bytes):
MAGIC(8) | HDR_LEN(4) | HEADER(JSON) | [ for each chunk: LEN(4) | CIPHERTEXT ]

Header JSON fields:
{
  "version": 3,
  "signature_variant": "ML-DSA-44",
  "compression": false,
  "package_id": "<uuid>",
  "hqc_ciphertext": "<hex>",
  "wrapped_key": "<hex>",           # AES-GCM of (aes_key || aes_nonce)
  "wrap_nonce": "<hex>",            # 12B nonce for key wrap
  "sender_dilithium_public_key": "<hex>",
  "signature": "<hex>",             # signature over header_core bytes
  "total_chunks": <int>,
  "chunk_size": <int>,
  "file_size": <int>,
  "filename": "<original name>"
}

Decryption requires: receiver_hqc_secret_key, sender_dilithium_public_key (from header).
"""

import io
import os
import json
import uuid
import struct
import zlib
from typing import Tuple

from .crypto_core import (
    HQC_KEM, Dilithium_Sign, AES_GCM_Cipher,
    derive_key_hkdf,
)

CHUNK_SIZE = 256 * 1024  # 256 KB
MAGIC = b"BWC-OPT3"


def _wrap_key_with_hqc(aes_key: bytes, aes_nonce: bytes, receiver_hqc_public_key: bytes) -> Tuple[bytes, bytes, bytes]:
    """Return (hqc_ct, wrap_nonce, wrapped_key). Uses HQC KEM shared secret to derive KEK and AES-GCM wrap (key||nonce)."""
    hqc = HQC_KEM()
    hqc_ct, shared_secret = hqc.encapsulate(receiver_hqc_public_key)
    kek = derive_key_hkdf(shared_secret, salt=b"BWC", info=b"KEK", length=32)
    wrap_nonce = os.urandom(12)
    wrapped = AES_GCM_Cipher.encrypt(kek, wrap_nonce, aes_key + aes_nonce, b"KEYWRAP")
    return hqc_ct, wrap_nonce, wrapped


def _unwrap_key_with_hqc(hqc_ct: bytes, wrap_nonce: bytes, wrapped_key: bytes, receiver_hqc_secret_key: bytes) -> Tuple[bytes, bytes]:
    hqc = HQC_KEM()
    shared_secret = hqc.decapsulate(hqc_ct, receiver_hqc_secret_key)
    kek = derive_key_hkdf(shared_secret, salt=b"BWC", info=b"KEK", length=32)
    key_nonce = AES_GCM_Cipher.decrypt(kek, wrap_nonce, wrapped_key, b"KEYWRAP")
    return key_nonce[:32], key_nonce[32:44]


def encrypt_file_to_package(
    plaintext: bytes,
    original_name: str,
    receiver_hqc_public_key: bytes,
    sender_dilithium_secret_key: bytes,
    compression: bool = True,
    signature_variant: str = "ML-DSA-44"
) -> bytes:
    """
    Encrypt file with optimizations:
    - Smaller signature (ML-DSA-44)
    - Optional compression before encryption
    - Counter-based nonces
    
    Args:
        plaintext: Data to encrypt
        original_name: Original filename
        receiver_hqc_public_key: Receiver's HQC public key
        sender_dilithium_secret_key: Sender's Dilithium secret key
        compression: Enable zlib compression (default: True)
        signature_variant: "ML-DSA-44" (default) or "ML-DSA-65"
    
    Returns:
        Encrypted package bytes
    """
    # Apply compression if enabled and beneficial
    data_to_encrypt = plaintext
    was_compressed = False
    if compression:
        compressed = zlib.compress(plaintext, level=6)
        if len(compressed) < len(plaintext):
            data_to_encrypt = compressed
            was_compressed = True
    
    # Generate AES session key and nonce (cached for all chunks)
    aes_key = os.urandom(32)
    aes_nonce_base = os.urandom(12)

    # Wrap key using HQC shared secret (one-time per package)
    hqc_ct, wrap_nonce, wrapped_key = _wrap_key_with_hqc(aes_key, aes_nonce_base, receiver_hqc_public_key)

    # Use specified signature variant (ML-DSA-44 for smaller signatures)
    dil = Dilithium_Sign(variant=signature_variant)
    sender_pub = dil.generate_keypair()[0]

    # Encrypt content chunk-by-chunk with counter-based nonces
    out_chunks = []
    total = len(data_to_encrypt)
    chunk_count = 0
    offset = 0

    while offset < total:
        chunk = data_to_encrypt[offset: offset + CHUNK_SIZE]
        # Counter-based nonce: deterministic, no RNG overhead per chunk
        nonce = bytearray(aes_nonce_base)
        ctr = chunk_count & 0xFFFFFFFF
        for i in range(4):
            nonce[-1 - i] ^= (ctr >> (8 * i)) & 0xFF
        ct = AES_GCM_Cipher.encrypt(aes_key, bytes(nonce), chunk, struct.pack(">Q", chunk_count))
        out_chunks.append(ct)
        offset += CHUNK_SIZE
        chunk_count += 1

    package_id = str(uuid.uuid4())

    header_core = {
        "version": 3,
        "package_id": package_id,
        "signature_variant": signature_variant,
        "compression": was_compressed,
        "hqc_ciphertext": hqc_ct.hex(),
        "wrapped_key": wrapped_key.hex(),
        "wrap_nonce": wrap_nonce.hex(),
        "sender_dilithium_public_key": sender_pub.hex(),
        "total_chunks": len(out_chunks),
        "chunk_size": CHUNK_SIZE,
        "file_size": len(plaintext),  # Original size for decompression
        "filename": original_name or "file"
    }

    # Sign header_core bytes for authenticity
    header_bytes = json.dumps(header_core, separators=(",", ":")).encode("utf-8")
    signature = dil.sign(header_bytes, sender_dilithium_secret_key)

    header = dict(header_core)
    header["signature"] = signature.hex()

    hdr_json = json.dumps(header, separators=(",", ":")).encode("utf-8")
    buf = bytearray()
    buf.extend(MAGIC)
    buf.extend(struct.pack(">I", len(hdr_json)))
    buf.extend(hdr_json)
    for ct in out_chunks:
        buf.extend(struct.pack(">I", len(ct)))
        buf.extend(ct)

    return bytes(buf)


def extract_package_id(package_bytes: bytes) -> str:
    """Extract package_id from a package without full decryption (for key lookup)."""
    if package_bytes[:8] != MAGIC:
        raise ValueError("Invalid package magic")
    hdr_len = struct.unpack(">I", package_bytes[8:12])[0]
    hdr = json.loads(package_bytes[12:12+hdr_len].decode("utf-8"))
    return hdr.get("package_id", "")


def decrypt_package_to_plaintext(package_bytes: bytes, receiver_hqc_secret_key: bytes) -> Tuple[bytes, dict]:
    """
    Decrypt optimized package with support for:
    - ML-DSA-44 (smaller) and ML-DSA-65 signatures
    - Compressed data
    - Counter-based nonces
    """
    offset = 0
    if package_bytes[:8] != MAGIC:
        raise ValueError("Invalid package magic")
    offset += 8
    hdr_len = struct.unpack(">I", package_bytes[offset:offset+4])[0]
    offset += 4
    hdr = json.loads(package_bytes[offset:offset+hdr_len].decode("utf-8"))
    offset += hdr_len

    hqc_ct = bytes.fromhex(hdr["hqc_ciphertext"]) 
    wrapped_key = bytes.fromhex(hdr["wrapped_key"]) 
    wrap_nonce = bytes.fromhex(hdr["wrap_nonce"]) 
    sender_pub = bytes.fromhex(hdr["sender_dilithium_public_key"]) 
    signature = bytes.fromhex(hdr["signature"]) 

    # Verify header authenticity using specified signature variant
    sig_variant = hdr.get("signature_variant", "ML-DSA-65")
    dil = Dilithium_Sign(variant=sig_variant)
    header_core = {k: hdr[k] for k in (
        "version","package_id","hqc_ciphertext","wrapped_key","wrap_nonce",
        "sender_dilithium_public_key","total_chunks","chunk_size","file_size","filename",
        "signature_variant","compression"
    ) if k in hdr}
    header_bytes = json.dumps(header_core, separators=(",", ":")).encode("utf-8")
    if not dil.verify(header_bytes, signature, sender_pub):
        raise ValueError("Dilithium signature verification failed")

    # Unwrap AES key+nonce
    aes_key, aes_nonce_base = _unwrap_key_with_hqc(hqc_ct, wrap_nonce, wrapped_key, receiver_hqc_secret_key)

    # Decrypt chunks
    chunks = []
    for idx in range(hdr["total_chunks"]):
        clen = struct.unpack(">I", package_bytes[offset:offset+4])[0]
        offset += 4
        ct = package_bytes[offset:offset+clen]
        offset += clen
        nonce = bytearray(aes_nonce_base)
        ctr = idx & 0xFFFFFFFF
        for i in range(4):
            nonce[-1 - i] ^= (ctr >> (8 * i)) & 0xFF
        pt = AES_GCM_Cipher.decrypt(aes_key, bytes(nonce), ct, struct.pack(">Q", idx))
        chunks.append(pt)

    decrypted_data = b"".join(chunks)
    
    # Decompress if needed
    if hdr.get("compression", False):
        decrypted_data = zlib.decompress(decrypted_data)
    
    return decrypted_data, hdr
