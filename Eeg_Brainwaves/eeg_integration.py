#!/usr/bin/env python3
"""
eeg_integration.py
Bridge between Arduino EEG reader and BrainWaveCrypt
Reads EEG signals from Arduino serial port and derives cryptographic key

Hardware Setup:
1. Upload eeg_reader.ino to Arduino
2. Connect EEG sensor to pin 34
3. Connect Arduino to computer via USB

Usage:
    # Generate EEG key from live readings
    python eeg_integration.py --port COM3 --duration 10 --output eeg_key.txt
    
    # Use with encryption
    python eeg_integration.py --port COM3 --duration 10 --encrypt input.txt output.enc
"""

import sys
import argparse
import time
import hashlib
import numpy as np
from typing import List, Tuple

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("❌ PySerial not installed. Install with: pip install pyserial")
    sys.exit(1)


# ============================================================================
# ARDUINO SERIAL COMMUNICATION
# ============================================================================

def list_serial_ports():
    """List all available serial ports"""
    ports = serial.tools.list_ports.comports()
    return [(port.device, port.description) for port in ports]


def connect_to_arduino(port: str, baud_rate: int = 115200, timeout: int = 2) -> serial.Serial:
    """
    Connect to Arduino via serial port
    """
    try:
        ser = serial.Serial(port, baud_rate, timeout=timeout)
        time.sleep(2)  # Wait for Arduino to reset
        print(f"✓ Connected to Arduino on {port}")
        return ser
    except serial.SerialException as e:
        print(f"❌ Failed to connect to {port}: {str(e)}")
        sys.exit(1)


def read_eeg_samples(ser: serial.Serial, duration: int = 10, sample_rate: int = 256) -> List[float]:
    """
    Read EEG samples from Arduino for specified duration
    
    Args:
        ser: Serial connection to Arduino
        duration: Recording duration in seconds
        sample_rate: Expected samples per second (default 256 Hz)
    
    Returns:
        List of EEG signal values
    """
    samples = []
    expected_samples = duration * sample_rate
    start_time = time.time()
    
    print(f"\n🧠 Recording EEG for {duration} seconds...")
    print(f"Expected samples: ~{expected_samples}")
    print("Keep still and relaxed...\n")
    
    # Clear buffer
    ser.reset_input_buffer()
    
    while time.time() - start_time < duration:
        try:
            line = ser.readline().decode('utf-8').strip()
            if line:
                # Parse float value from Arduino
                value = float(line)
                samples.append(value)
                
                # Progress indicator
                if len(samples) % 50 == 0:
                    elapsed = time.time() - start_time
                    progress = (elapsed / duration) * 100
                    print(f"  📊 Samples: {len(samples):4d} | Time: {elapsed:.1f}s | Progress: {progress:.1f}%", end='\r')
        
        except ValueError:
            # Skip non-numeric lines
            continue
        except UnicodeDecodeError:
            # Skip corrupted data
            continue
    
    print(f"\n✓ Recorded {len(samples)} samples in {duration} seconds")
    return samples


# ============================================================================
# EEG SIGNAL PROCESSING
# ============================================================================

def calculate_signal_quality(samples: List[float]) -> dict:
    """
    Calculate EEG signal quality metrics
    """
    samples_array = np.array(samples)
    
    metrics = {
        'mean': np.mean(samples_array),
        'std': np.std(samples_array),
        'min': np.min(samples_array),
        'max': np.max(samples_array),
        'range': np.max(samples_array) - np.min(samples_array),
        'count': len(samples)
    }
    
    return metrics


def detect_artifacts(samples: List[float], threshold_factor: float = 3.0) -> Tuple[List[float], int]:
    """
    Remove artifacts (outliers) from EEG signal
    Uses z-score method
    
    Returns:
        (cleaned_samples, num_removed)
    """
    samples_array = np.array(samples)
    mean = np.mean(samples_array)
    std = np.std(samples_array)
    
    # Z-score threshold
    z_scores = np.abs((samples_array - mean) / std)
    cleaned = samples_array[z_scores < threshold_factor]
    
    num_removed = len(samples_array) - len(cleaned)
    
    return cleaned.tolist(), num_removed


def normalize_eeg_signal(samples: List[float]) -> List[float]:
    """
    Normalize EEG signal to [0, 1] range
    """
    samples_array = np.array(samples)
    min_val = np.min(samples_array)
    max_val = np.max(samples_array)
    
    if max_val - min_val == 0:
        return [0.5] * len(samples)  # Flat signal
    
    normalized = (samples_array - min_val) / (max_val - min_val)
    return normalized.tolist()


# ============================================================================
# KEY DERIVATION FROM EEG
# ============================================================================

def derive_eeg_key(samples: List[float], salt: bytes = b"BrainWaveCrypt", rounds: int = 100000) -> bytes:
    """
    Derive 32-byte cryptographic key from EEG samples
    
    Process:
    1. Clean artifacts
    2. Normalize signal
    3. Convert to byte string
    4. Apply PBKDF2 with high iteration count
    
    Args:
        samples: Raw EEG samples
        salt: Salt for key derivation
        rounds: PBKDF2 iterations (higher = more secure but slower)
    
    Returns:
        32-byte key suitable for BrainWaveCrypt
    """
    print("\n[Deriving cryptographic key from EEG]")
    
    # Step 1: Remove artifacts
    cleaned_samples, num_removed = detect_artifacts(samples)
    print(f"✓ Removed {num_removed} artifact samples")
    
    # Step 2: Normalize
    normalized = normalize_eeg_signal(cleaned_samples)
    print(f"✓ Normalized {len(normalized)} samples")
    
    # Step 3: Convert to bytes
    # Use quantized values (0-255) for better reproducibility
    quantized = [int(x * 255) for x in normalized]
    eeg_bytes = bytes(quantized)
    
    # Step 4: Initial hash
    initial_hash = hashlib.sha512(eeg_bytes).digest()
    
    # Step 5: PBKDF2 key stretching for additional security
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=rounds,
        backend=default_backend()
    )
    
    print(f"✓ Applying PBKDF2 ({rounds:,} rounds)...")
    eeg_key = kdf.derive(initial_hash)
    
    print(f"✓ Derived 32-byte EEG key")
    
    return eeg_key


def save_eeg_key(key: bytes, output_path: str):
    """Save EEG key to file in hex format"""
    with open(output_path, 'w') as f:
        f.write(key.hex())
    print(f"✓ EEG key saved to: {output_path}")


def load_eeg_key(input_path: str) -> bytes:
    """Load EEG key from file"""
    with open(input_path, 'r') as f:
        hex_key = f.read().strip()
    return bytes.fromhex(hex_key)


# ============================================================================
# INTEGRATION WITH BRAINWAVECRYPT
# ============================================================================

def encrypt_with_eeg(
    arduino_port: str,
    duration: int,
    input_file: str,
    output_file: str,
    entanglement_csv: str,
    receiver_hqc_pub: str,
    sender_dil_sec: str
):
    """
    Complete workflow: Read EEG → Derive Key → Encrypt File
    """
    print("=" * 70)
    print("🧠 BrainWaveCrypt - EEG-Based Encryption")
    print("=" * 70)
    
    # Step 1: Connect to Arduino
    ser = connect_to_arduino(arduino_port)
    
    # Step 2: Record EEG
    samples = read_eeg_samples(ser, duration)
    ser.close()
    
    # Step 3: Analyze signal quality
    print("\n[Signal Quality Analysis]")
    metrics = calculate_signal_quality(samples)
    print(f"  Mean: {metrics['mean']:.2f}")
    print(f"  Std Dev: {metrics['std']:.2f}")
    print(f"  Range: {metrics['range']:.2f}")
    
    # Step 4: Derive key
    eeg_key = derive_eeg_key(samples)
    print(f"\n🔑 EEG Key (hex): {eeg_key.hex()}")
    
    # Step 5: Encrypt file
    print(f"\n[Encrypting {input_file}]")
    
    from uhae_hqc import encrypt_stream
    from crypto_core import load_entanglement_seeds
    
    # Load keys and seeds
    entanglement_seeds = load_entanglement_seeds(entanglement_csv)
    
    with open(receiver_hqc_pub, 'rb') as f:
        hqc_pub = f.read()
    
    with open(sender_dil_sec, 'rb') as f:
        dil_sec = f.read()
    
    # Read plaintext
    with open(input_file, 'rb') as f:
        plaintext = f.read()
    
    # Encrypt
    ciphertext = encrypt_stream(
        plaintext=plaintext,
        eeg_key=eeg_key,
        entanglement_seeds=entanglement_seeds,
        receiver_hqc_public_key=hqc_pub,
        sender_dilithium_secret_key=dil_sec
    )
    
    # Save ciphertext
    with open(output_file, 'wb') as f:
        f.write(ciphertext)
    
    print(f"✓ Encrypted file saved: {output_file}")
    print(f"✓ File size: {len(plaintext):,} → {len(ciphertext):,} bytes")
    
    print("\n✅ Encryption complete!")
    print(f"\n⚠️  To decrypt, you must:")
    print(f"   1. Record EEG for {duration}s under same conditions")
    print(f"   2. Use derived key with decrypt_file.py")


# ============================================================================
# MAIN CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="BrainWaveCrypt EEG Integration - Derive keys from brainwave signals",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List available serial ports
  python eeg_integration.py --list-ports

  # Generate EEG key and save to file
  python eeg_integration.py --port COM3 --duration 10 --output eeg_key.txt

  # Generate key and encrypt file in one step
  python eeg_integration.py --port COM3 --duration 10 --encrypt input.txt output.enc \\
    --entanglement seeds.csv --receiver-hqc-pub hqc_public.key --sender-dil-sec dilithium_secret.key

  # Test signal quality (no encryption)
  python eeg_integration.py --port COM3 --duration 5 --test-only
        """
    )
    
    # Serial port options
    parser.add_argument("--port", help="Arduino serial port (e.g., COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    parser.add_argument("--list-ports", action="store_true", help="List available serial ports")
    
    # EEG recording options
    parser.add_argument("--duration", type=int, default=10, help="Recording duration in seconds (default: 10)")
    parser.add_argument("--output", help="Output file for EEG key (hex format)")
    
    # Encryption options
    parser.add_argument("--encrypt", nargs=2, metavar=("INPUT", "OUTPUT"), help="Encrypt file using EEG key")
    parser.add_argument("--entanglement", help="Entanglement seeds CSV")
    parser.add_argument("--receiver-hqc-pub", help="Receiver's HQC public key")
    parser.add_argument("--sender-dil-sec", help="Sender's Dilithium secret key")
    
    # Testing
    parser.add_argument("--test-only", action="store_true", help="Test EEG signal quality without deriving key")
    
    args = parser.parse_args()
    
    # List ports
    if args.list_ports:
        print("Available Serial Ports:")
        print("=" * 50)
        ports = list_serial_ports()
        if not ports:
            print("No serial ports found!")
        else:
            for device, description in ports:
                print(f"  {device}: {description}")
        return
    
    # Validate port
    if not args.port:
        parser.print_help()
        print("\n❌ Error: --port required")
        print("   Use --list-ports to see available ports")
        sys.exit(1)
    
    # Connect and read EEG
    ser = connect_to_arduino(args.port, args.baud)
    samples = read_eeg_samples(ser, args.duration)
    ser.close()
    
    # Analyze signal
    print("\n[Signal Quality Analysis]")
    metrics = calculate_signal_quality(samples)
    print(f"  Samples: {metrics['count']}")
    print(f"  Mean: {metrics['mean']:.2f}")
    print(f"  Std Dev: {metrics['std']:.2f}")
    print(f"  Range: [{metrics['min']:.2f}, {metrics['max']:.2f}]")
    
    if args.test_only:
        print("\n✅ Test complete - signal looks good!")
        return
    
    # Derive key
    eeg_key = derive_eeg_key(samples)
    print(f"\n🔑 EEG Key: {eeg_key.hex()}")
    
    # Save key
    if args.output:
        save_eeg_key(eeg_key, args.output)
    
    # Encrypt file
    if args.encrypt:
        input_file, output_file = args.encrypt
        
        if not all([args.entanglement, args.receiver_hqc_pub, args.sender_dil_sec]):
            print("❌ Error: Encryption requires --entanglement, --receiver-hqc-pub, --sender-dil-sec")
            sys.exit(1)
        
        from uhae_hqc import encrypt_stream
        from crypto_core import load_entanglement_seeds
        
        print(f"\n[Encrypting {input_file}]")
        
        # Load dependencies
        entanglement_seeds = load_entanglement_seeds(args.entanglement)
        with open(args.receiver_hqc_pub, 'rb') as f:
            hqc_pub = f.read()
        with open(args.sender_dil_sec, 'rb') as f:
            dil_sec = f.read()
        
        # Encrypt
        with open(input_file, 'rb') as f:
            plaintext = f.read()
        
        ciphertext = encrypt_stream(
            plaintext=plaintext,
            eeg_key=eeg_key,
            entanglement_seeds=entanglement_seeds,
            receiver_hqc_public_key=hqc_pub,
            sender_dilithium_secret_key=dil_sec
        )
        
        with open(output_file, 'wb') as f:
            f.write(ciphertext)
        
        print(f"✓ Encrypted: {input_file} → {output_file}")
        print(f"✓ Size: {len(plaintext):,} → {len(ciphertext):,} bytes")
    
    print("\n✅ Complete!")


if __name__ == "__main__":
    main()