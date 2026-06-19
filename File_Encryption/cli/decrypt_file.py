#!/usr/bin/env python3
"""
decrypt_file.py
CLI tool for decrypting files with BrainWaveCrypt

Usage:
    python decrypt_file.py input.enc output.txt --eeg-key HEX_STRING --entanglement seeds.csv --receiver-hqc-sec receiver_hqc.sec --sender-dil-pub sender_dil.pub
"""

import sys
import argparse
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Post_Quantum_Cryptography.uhae_hqc import decrypt_stream
from Post_Quantum_Cryptography.crypto_core import load_entanglement_seeds


def load_key_from_file(filepath: str) -> bytes:
    """Load binary key from file"""
    with open(filepath, 'rb') as f:
        return f.read()


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
        description="BrainWaveCrypt - Decrypt files encrypted with post-quantum cryptography",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic decryption
  python decrypt_file.py input.enc output.txt --eeg-key ABCD1234... --entanglement seeds.csv --receiver-hqc-sec receiver.sec --sender-dil-pub sender.pub

  # Verbose output
  python decrypt_file.py input.enc output.txt --eeg-key ABCD1234... --entanglement seeds.csv --receiver-hqc-sec receiver.sec --sender-dil-pub sender.pub -v
        """
    )
    
    # Main arguments
    parser.add_argument("input", help="Input encrypted file")
    parser.add_argument("output", help="Output decrypted file")
    
    # Required decryption arguments
    parser.add_argument("--eeg-key", required=True, help="EEG key (32 bytes, hex or base64) - must match encryption key")
    parser.add_argument("--entanglement", required=True, help="Path to entanglement seeds CSV - must be same as encryption")
    parser.add_argument("--receiver-hqc-sec", required=True, help="Receiver's HQC secret key file")
    parser.add_argument("--sender-dil-pub", required=True, help="Sender's Dilithium public key file")
    
    # Optional
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Check files exist
    if not os.path.exists(args.input):
        print(f"❌ Error: Input file not found: {args.input}")
        sys.exit(1)
    
    if not os.path.exists(args.entanglement):
        print(f"❌ Error: Entanglement seeds file not found: {args.entanglement}")
        sys.exit(1)
    
    if not os.path.exists(args.receiver_hqc_sec):
        print(f"❌ Error: Receiver HQC secret key not found: {args.receiver_hqc_sec}")
        sys.exit(1)
    
    if not os.path.exists(args.sender_dil_pub):
        print(f"❌ Error: Sender Dilithium public key not found: {args.sender_dil_pub}")
        sys.exit(1)
    
    # Parse EEG key
    print("🧠 BrainWaveCrypt File Decryption")
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
    receiver_hqc_sec = load_key_from_file(args.receiver_hqc_sec)
    print(f"✓ Receiver HQC secret key: {len(receiver_hqc_sec)} bytes")
    
    sender_dil_pub = load_key_from_file(args.sender_dil_pub)
    print(f"✓ Sender Dilithium public key: {len(sender_dil_pub)} bytes")
    
    # Read encrypted file
    if args.verbose:
        print(f"\n[Reading Encrypted File: {args.input}]")
    with open(args.input, 'rb') as f:
        ciphertext = f.read()
    print(f"✓ Ciphertext size: {len(ciphertext):,} bytes")
    
    # Decrypt
    print("\n[Decrypting...]")
    print("  - Parsing encrypted header")
    print("  - HQC-128 key decapsulation")
    print("  - Quantum entropy reconstruction")
    print("  - Time dilation recomputation")
    print("  - Dilithium signature verification")
    print("  - AES-256-GCM chunk decryption")
    print("  - Ratchet verification")
    
    try:
        plaintext = decrypt_stream(
            ciphertext=ciphertext,
            eeg_key=eeg_key,
            entanglement_seeds=entanglement_seeds,
            receiver_hqc_secret_key=receiver_hqc_sec,
            sender_dilithium_public_key=sender_dil_pub
        )
    except ValueError as e:
        print(f"\n❌ Decryption failed: {str(e)}")
        print("\nPossible causes:")
        print("  • Incorrect EEG key")
        print("  • Wrong entanglement seeds file")
        print("  • Mismatched cryptographic keys")
        print("  • Corrupted ciphertext")
        print("  • Tampering detected (signature verification failed)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error during decryption: {str(e)}")
        sys.exit(1)
    
    print(f"✓ Decryption complete")
    print(f"✓ Plaintext size: {len(plaintext):,} bytes")
    print(f"✓ Signature verified - message authentic")
    
    # Write output
    if args.verbose:
        print(f"\n[Writing Output File: {args.output}]")
    with open(args.output, 'wb') as f:
        f.write(plaintext)
    print(f"✓ Decrypted file saved: {args.output}")
    
    print("\n✅ File decrypted successfully!")
    
    # Show preview if text file
    if args.verbose:
        try:
            preview = plaintext[:200].decode('utf-8', errors='ignore')
            print(f"\n[Preview of decrypted content]")
            print(f"{preview}...")
        except:
            print("\n[Binary file - no preview available]")


if __name__ == "__main__":
    main()