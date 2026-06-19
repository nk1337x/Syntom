# Syntom

A cutting-edge cryptographic framework combining post-quantum cryptography, EEG biometrics, and quantum-resistant security protocols.

## Features

- **Post-Quantum Cryptography** – HQC-128 KEM & Dilithium3 signatures via liboqs
- **EEG Biometric Integration** – Brain-derived entropy and biometric authentication
- **Quantum Security** – Qiskit-powered quantum entanglement protocols
- **Advanced Key Exchange** – Braided key derivation with path establishment
- **File Encryption** – AES-GCM encrypted file operations with CLI tools
- **IPFS Storage** – Distributed file storage via Pinata cloud integration
- **Hybrid Session Management** – Multi-layered session security
- **Time-Based Security** – Time dilation cryptographic mechanisms

## Project Structure

```
├── Post_Quantum_Cryptography/   # Core crypto primitives & hybrid schemes
├── Eeg_Brainwaves/              # EEG integration & biometric features
├── Braided_Key_Exchange/        # Advanced key derivation protocols
├── File_Encryption/             # File encryption CLI tools
├── IPFS_Integration/            # Pinata-based distributed storage
├── Session_Management/          # Secure session handling
├── Time_Security/               # Time-based security mechanisms
└── WebApplication/              # Frontend & backend interfaces
```

## Quick Start

```bash
# Install dependencies
pip install -r IPFS_Integration/requirements.txt

# Run encryption workflow
python -m File_Encryption.cli.encrypt_file <input_file>

# Test IPFS integration
cd IPFS_Integration && python test_pinata.py
```

## Requirements

- Python 3.8+
- liboqs-python (post-quantum crypto)
- qiskit (quantum protocols)
- cryptography, requests, python-dotenv

## License

Proprietary - BrainWaveCrypt Project
