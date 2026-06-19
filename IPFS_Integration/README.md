# IPFS Integration - Pinata Cloud Storage

This module handles automatic upload of encrypted files to Pinata IPFS cloud storage.

## Features

- Automatic upload of encrypted files to IPFS via Pinata
- Metadata tagging for encrypted files
- Upload logging and tracking
- Retrieval of upload history
- Direct IPFS gateway URLs for file access

## Setup

1. Install required dependencies:
```bash
pip install requests python-dotenv
```

2. Configuration is already set in `.env` file with your Pinata credentials

## Usage

### Basic Upload

```python
from IPFS_Integration.auto_uploader import get_uploader

uploader = get_uploader()

result = uploader.upload_after_encryption(
    encrypted_file_path="path/to/encrypted/file.enc",
    session_id="unique-session-id",
    original_filename="document.pdf"
)

if result['success']:
    print(f"IPFS Hash: {result['ipfs_hash']}")
    print(f"Gateway URL: {result['gateway_url']}")
```

### Testing Connection

```bash
cd IPFS_Integration
python test_pinata.py
```

## Integration with Encryption Flow

The uploader automatically:
1. Receives encrypted file after encryption completes
2. Uploads to Pinata IPFS with metadata
3. Returns IPFS hash and gateway URL
4. Logs upload details for tracking

## Upload Logs

Upload logs are stored in `upload_logs/` directory with format:
- `{session_id}_ipfs.json` - Contains IPFS hash, gateway URL, timestamps

## Pinata Dashboard

View your uploaded files at:
- https://app.pinata.cloud/pinmanager

## Gateway URLs

Files can be accessed via:
- `https://gateway.pinata.cloud/ipfs/{IPFS_HASH}`

## API Endpoints

### Upload File
- Endpoint: `/pinning/pinFileToIPFS`
- Method: POST
- Auth: JWT Token

### List Pins
- Endpoint: `/data/pinList`
- Method: GET
- Auth: JWT Token

### Unpin File
- Endpoint: `/pinning/unpin/{hash}`
- Method: DELETE
- Auth: JWT Token

## Security Notes

- JWT token is stored in `.env` (DO NOT commit to git)
- Add `.env` to `.gitignore`
- Token expires on: 2027-01-30 (based on exp: 1801457471)
- Rotate credentials if compromised

## File Structure

```
IPFS_Integration/
├── __init__.py              # Module initialization
├── pinata_service.py        # Core Pinata API service
├── auto_uploader.py         # Automatic upload handler
├── test_pinata.py          # Test script
├── .env                    # Credentials (DO NOT COMMIT)
├── README.md               # This file
└── upload_logs/            # Upload history logs
```

## Environment Variables

```env
PINATA_API_KEY=your_api_key
PINATA_API_SECRET=your_api_secret
PINATA_JWT_TOKEN=your_jwt_token
```

## Error Handling

The service includes comprehensive error handling for:
- Network failures
- Authentication errors
- File not found errors
- Invalid responses
- Connection timeouts

## Support

For Pinata API documentation:
- https://docs.pinata.cloud/
