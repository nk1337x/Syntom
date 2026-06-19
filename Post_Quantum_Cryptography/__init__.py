"""
Post-Quantum Cryptography Module
"""

from .crypto_core import (
    HQC_KEM,
    Dilithium_Sign,
    AES_GCM_Cipher,
    derive_key_hkdf,
    secure_random_bytes,
    load_entanglement_seeds,
    generate_entanglement_seed_csv,
    generate_quantum_entropy,
)
from .hybrid_crypto import (
    encrypt_file_to_package,
    decrypt_package_to_plaintext,
    extract_package_id,
)
from .uhae_hqc import (
    encrypt_stream,
    decrypt_stream,
)

__all__ = [
    'HQC_KEM',
    'Dilithium_Sign',
    'AES_GCM_Cipher',
    'derive_key_hkdf',
    'secure_random_bytes',
    'load_entanglement_seeds',
    'generate_entanglement_seed_csv',
    'generate_quantum_entropy',
    'encrypt_file_to_package',
    'decrypt_package_to_plaintext',
    'extract_package_id',
    'encrypt_stream',
    'decrypt_stream',
]
