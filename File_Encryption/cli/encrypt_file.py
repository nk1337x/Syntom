#!/usr/bin/env python3
"""
encrypt_file.py
CLI tool for encrypting files with BrainWaveCrypt

Usage:
    python encrypt_file.py input.txt output.enc --eeg-key HEX_STRING --entanglement seeds.csv --receiver-hqc-pub receiver_hqc.pub --sender-dil-sec sender_dil.sec
"""

import sys
import argparse
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Post_Quantum_Cryptography.uhae_hqc import encrypt_stream, generate_hqc_keypair, generate_dilithium_keypair
from Post_Quantum_Cryptography.crypto_core import load_entanglement_seeds, secure_random_bytes


def load_key_from_file(filepath: str) -> bytes:
    """Load binary key from file"""
    with open(filepath, 'rb') as f:
        return f.read()


def save_key_to_file(filepath: str, key: bytes):
    """Save binary key to file"""
    with open(filepath, 'wb') as f:
        f.write(key)


def parse_eeg_key(eeg_key_input: str) -> bytes:
    """
    Parse EEG key from hex string or base64
    EEG key must be exactly 32 bytes
    """
    try:
        # Try hex first
        key = bytes.fromhex(eeg_key_input)
        if len(key) == 32:
            return key
        else:
            print(f"❌ Error: EEG key must be exactly 32 bytes (got {len(key)} bytes)")
            sys.exit(1)
    except ValueError:
        # Try base64
        import base64
        try:
            key = base64.b64decode(eeg_key_input)
            if len(key) == 32:
                return key
            else:
                print(f"❌ Error: EEG key must be exactly 32 bytes (got {len(key)} bytes)")
                sys.exit(1)
        except:
            print("❌ Error: EEG key must be valid hex or base64 string")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="BrainWaveCrypt - Encrypt files with post-quantum cryptography",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic encryption
  python encrypt_file.py input.txt output.enc --eeg-key ABCD1234... --entanglement seeds.csv --receiver-hqc-pub receiver.pub --sender-dil-sec sender.sec

  # Generate keys first (one-time setup)
  python encrypt_file.py --generate-keys

  # Generate entanglement seeds (one-time setup)
  python encrypt_file.py --generate-seeds seeds.csv --num-seeds 100
        """
    )
    
    # Main arguments
    parser.add_argument("input", nargs='?', help="Input file to encrypt")
    parser.add_argument("output", nargs='?', help="Output encrypted file")
    
    # Required encryption arguments
    parser.add_argument("--eeg-key", help="EEG key (32 bytes, hex or base64)")
    parser.add_argument("--entanglement", help="Path to entanglement seeds CSV")
    parser.add_argument("--receiver-hqc-pub", help="Receiver's HQC public key file")
    parser.add_argument("--sender-dil-sec", help="Sender's Dilithium secret key file")
    
    # Optimization options
    parser.add_argument("--compression", action="store_true", default=True, 
                       help="Enable zlib compression (default: enabled)")
    parser.add_argument("--no-compression", dest="compression", action="store_false",
                       help="Disable compression")
    parser.add_argument("--signature-variant", choices=["ML-DSA-44", "ML-DSA-65"], 
                       default="ML-DSA-44",
                       help="Signature algorithm: ML-DSA-44 (smaller, default) or ML-DSA-65 (standard)")
    
    # Setup utilities
    parser.add_argument("--generate-keys", action="store_true", help="Generate HQC and Dilithium keypairs")
    parser.add_argument("--generate-seeds", help="Generate entanglement seeds CSV")
    parser.add_argument("--num-seeds", type=int, default=100, help="Number of seeds to generate (default: 100)")
    
    # Optional
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Handle key generation
    if args.generate_keys:
        print("🔑 Generating BrainWaveCrypt keypairs...")
        print("=" * 60)
        
        # Generate HQC keypair
        print("\n[Generating HQC-128 keypair]")
        hqc_pub, hqc_sec = generate_hqc_keypair()
        save_key_to_file("hqc_public.key", hqc_pub)
        save_key_to_file("hqc_secret.key", hqc_sec)
        print(f"✓ HQC Public Key: hqc_public.key ({len(hqc_pub)} bytes)")
        print(f"✓ HQC Secret Key: hqc_secret.key ({len(hqc_sec)} bytes)")
        
        # Generate Dilithium keypair
        print("\n[Generating Dilithium3 keypair]")
        dil_pub, dil_sec = generate_dilithium_keypair()
        save_key_to_file("dilithium_public.key", dil_pub)
        save_key_to_file("dilithium_secret.key", dil_sec)
        print(f"✓ Dilithium Public Key: dilithium_public.key ({len(dil_pub)} bytes)")
        print(f"✓ Dilithium Secret Key: dilithium_secret.key ({len(dil_sec)} bytes)")
        
        # Generate random EEG key example
        print("\n[Generating example EEG key]")
        eeg_example = secure_random_bytes(32)
        save_key_to_file("eeg_key_example.key", eeg_example)
        print(f"✓ Example EEG Key: eeg_key_example.key")
        print(f"  Hex: {eeg_example.hex()}")
        print("\n⚠️  In production, replace this with actual EEG-derived key!")
        
        print("\n✅ All keys generated successfully!")
        return
    
    # Handle seed generation
    if args.generate_seeds:
        print(f"🧬 Generating {args.num_seeds} entanglement seeds...")
        from crypto_core import generate_entanglement_seed_csv
        generate_entanglement_seed_csv(args.generate_seeds, args.num_seeds)
        print(f"✅ Seeds saved to: {args.generate_seeds}")
        return
    
    # Validate main encryption arguments
    if not all([args.input, args.output, args.eeg_key, args.entanglement, args.receiver_hqc_pub, args.sender_dil_sec]):
        parser.print_help()
        print("\n❌ Error: Missing required arguments for encryption")
        print("   Use --generate-keys to create keypairs first")
        print("   Use --generate-seeds to create entanglement seeds first")
        sys.exit(1)
    
    # Check files exist
    if not os.path.exists(args.input):
        print(f"❌ Error: Input file not found: {args.input}")
        sys.exit(1)
    
    if not os.path.exists(args.entanglement):
        print(f"❌ Error: Entanglement seeds file not found: {args.entanglement}")
        sys.exit(1)
    
    if not os.path.exists(args.receiver_hqc_pub):
        print(f"❌ Error: Receiver HQC public key not found: {args.receiver_hqc_pub}")
        sys.exit(1)
    
    if not os.path.exists(args.sender_dil_sec):
        print(f"❌ Error: Sender Dilithium secret key not found: {args.sender_dil_sec}")
        sys.exit(1)
    
    # Parse EEG key
    print("🧠 BrainWaveCrypt File Encryption")
    print("=" * 60)
    
    if args.verbose:
        print("\n[Loading EEG Key]")
    eeg_key = parse_eeg_key(args.eeg_key)
    print(f"✓ EEG Key loaded: {eeg_key.hex()[:16]}...{eeg_key.hex()[-16:]}")
    
    # Load entanglement seeds
    if args.verbose:
        print("\n[Loading Entanglement Seeds]")
    entanglement_seeds = load_entanglement_seeds(args.entanglement)
    print(f"✓ Loaded {len(entanglement_seeds)} entanglement seeds from {args.entanglement}")
    
    # Load keys
    if args.verbose:
        print("\n[Loading Cryptographic Keys]")
    receiver_hqc_pub = load_key_from_file(args.receiver_hqc_pub)
    print(f"✓ Receiver HQC public key: {len(receiver_hqc_pub)} bytes")
    
    sender_dil_sec = load_key_from_file(args.sender_dil_sec)
    print(f"✓ Sender Dilithium secret key: {len(sender_dil_sec)} bytes")
    
    # Read input file
    if args.verbose:
        print(f"\n[Reading Input File: {args.input}]")
    with open(args.input, 'rb') as f:
        plaintext = f.read()
    print(f"✓ Input size: {len(plaintext):,} bytes")
    
    # Encrypt
    print("\n[Encrypting...]")
    print("  - HQC-128 key encapsulation")
    print(f"  - Dilithium signature ({args.signature_variant})")
    print("  - Qiskit quantum entanglement")
    print("  - Time dilation computation")
    print("  - AES-256-GCM chunk encryption")
    print("  - Genetic mutation + ratcheting")
    if args.compression:
        print("  - zlib compression enabled")
    
    try:
        ciphertext = encrypt_stream(
            plaintext=plaintext,
            eeg_key=eeg_key,
            entanglement_seeds=entanglement_seeds,
            receiver_hqc_public_key=receiver_hqc_pub,
            sender_dilithium_secret_key=sender_dil_sec
        )
    except Exception as e:
        print(f"\n❌ Encryption failed: {str(e)}")
        sys.exit(1)
    
    print(f"✓ Encryption complete")
    print(f"✓ Ciphertext size: {len(ciphertext):,} bytes")
    print(f"✓ Overhead: {len(ciphertext) - len(plaintext):,} bytes")
    
    # Write output
    if args.verbose:
        print(f"\n[Writing Output File: {args.output}]")
    with open(args.output, 'wb') as f:
        f.write(ciphertext)
    print(f"✓ Encrypted file saved: {args.output}")
    
    print("\n✅ File encrypted successfully!")
    print(f"\nTo decrypt, use:")
    print(f"  python decrypt_file.py {args.output} decrypted.txt --eeg-key {args.eeg_key} --entanglement {args.entanglement} \\")
    print(f"    --receiver-hqc-sec receiver_hqc_secret.key --sender-dil-pub sender_dilithium_public.key")


if __name__ == "__main__":
    main()