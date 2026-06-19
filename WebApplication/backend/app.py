from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
from pathlib import Path
import io
import secrets
import time
import requests
import uuid
import sys

# Add parent directory to path for feature imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import from feature folders
try:
    from Post_Quantum_Cryptography.uhae_hqc import encrypt_stream, decrypt_stream
    HAS_FULL_CRYPTO = True
except ImportError as e:
    print(f"WARNING: Full crypto modules not fully available: {e}")
    print("WARNING: Falling back to basic encryption for testing.")
    HAS_FULL_CRYPTO = False

# Hybrid encryption from Post_Quantum_Cryptography
from Post_Quantum_Cryptography.hybrid_crypto import encrypt_file_to_package, decrypt_package_to_plaintext, extract_package_id
from Post_Quantum_Cryptography.crypto_core import secure_random_bytes, load_entanglement_seeds, generate_entanglement_seed_csv, generate_quantum_entropy
from Time_Security.time_dilation import compute_chunk_delay
import json as _json

# Braided key exchange modules
try:
    from Braided_Key_Exchange.path_establishment import establish_path_locally, SessionConfig
    from Braided_Key_Exchange.braided_key_derivation import derive_session_key
    from Braided_Key_Exchange.secure_channel import create_secure_sender, create_secure_receiver, SecureMessage
    HAS_BRAIDED_KEX = True
    print("SUCCESS: Braided key exchange modules loaded successfully")
except ImportError as e:
    print(f"WARNING: Braided key exchange modules not available: {e}")
    HAS_BRAIDED_KEX = False

# IPFS Integration module
try:
    from IPFS_Integration.auto_uploader import get_uploader
    from IPFS_Integration.pinata_service import PinataService
    HAS_IPFS_INTEGRATION = True
    print("SUCCESS: IPFS Integration module loaded successfully")
    # Test connection on startup
    try:
        test_service = PinataService()
        conn_result = test_service.test_connection()
        if conn_result[0]:
            print(f"SUCCESS: Pinata connection verified: {conn_result[1]}")
        else:
            print(f"WARNING: Pinata connection failed: {conn_result[1]}")
    except Exception as test_e:
        print(f"WARNING: Pinata connection test error: {test_e}")
except ImportError as e:
    print(f"WARNING: IPFS Integration not available: {e}")
    import traceback
    traceback.print_exc()
    HAS_IPFS_INTEGRATION = False

app = Flask(__name__)
CORS(app, expose_headers=['X-Original-Filename', 'X-Decrypted-Filename', 'X-IPFS-Hash', 'Content-Disposition'])

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@app.route("/", methods=["GET"])
def root():
    """Root route for quick manual checks."""
    return jsonify({
        "status": "ok",
        "message": "Backend is running",
        "endpoints": [
            "/health",
            "/getCameras",
            "/updateVectorStore",
            "/createFlorenceDocument",
            "/getResponse",
            "/encrypt",
            "/decrypt",
            "/share",
            "/receive",
            "/braided/establish_path",
            "/braided/derive_key",
            "/braided/test"
        ]
    }), 200


# ============================================================================
# NEW: Braided Key Exchange Endpoints
# ============================================================================

@app.route("/braided/establish_path", methods=["POST"])
def braided_establish_path():
    """
    Phase 1: Establish path (session parameters agreement)
    
    Returns: SessionConfig as JSON
    """
    if not HAS_BRAIDED_KEX:
        return jsonify({"status": "error", "message": "Braided key exchange not available"}), 503
    
    try:
        # Create session config
        session_config = establish_path_locally()
        
        # Save session to file for later phases
        session_data = {
            "session_id": session_config.session_id,
            "braid_order": session_config.braid_order.name,
            "time_window_size": session_config.time_window_size,
            "time_offset_tolerance": session_config.time_offset_tolerance,
            "hkdf_hash": session_config.hkdf_hash,
            "hkdf_salt": session_config.hkdf_salt.hex() if session_config.hkdf_salt else None,
            "initiator_nonce": session_config.initiator_nonce.hex(),
            "responder_nonce": session_config.responder_nonce.hex(),
            "time_offset_seconds": 0,
            "time_offset_direction": "forward",
            "sender_real_time": time.time()
        }
        
        session_json_path = UPLOAD_DIR / f"session_{session_config.session_id}.json"
        with open(session_json_path, "w") as f:
            _json.dump(session_data, f)
        
        # Return as JSON
        return jsonify({
            "status": "ok",
            "session_id": session_config.session_id,
            "braid_order": session_config.braid_order.name,
            "time_window_size": session_config.time_window_size,
            "time_offset_tolerance": session_config.time_offset_tolerance,
            "hkdf_hash": session_config.hkdf_hash,
            "hkdf_salt": session_config.hkdf_salt.hex() if session_config.hkdf_salt else None,
            "initiator_nonce": session_config.initiator_nonce.hex(),
            "responder_nonce": session_config.responder_nonce.hex()
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/braided/derive_key", methods=["POST"])
def braided_derive_key():
    """
    Phase 2: Derive K_root using braided key derivation
    
    Expects: {eeg_key_hex: "...", session_id: "..."}
    Returns: {k_root: "...", entropy_hash_eeg: "...", entropy_hash_quantum: "..."}
    """
    if not HAS_BRAIDED_KEX:
        return jsonify({"status": "error", "message": "Braided key exchange not available"}), 503
    
    try:
        data = request.get_json() or {}
        eeg_key_hex = data.get("eeg_key")
        session_id = data.get("session_id")
        
        if not eeg_key_hex or not session_id:
            return jsonify({"status": "error", "message": "Missing eeg_key or session_id"}), 400
        
        eeg_key = bytes.fromhex(eeg_key_hex)
        
        # Load or recreate session config
        session_json_path = UPLOAD_DIR / f"session_{session_id}.json"
        if session_json_path.exists():
            with open(session_json_path, "r") as sf:
                session_data = _json.load(sf)
            from Braided_Key_Exchange.path_establishment import BraidOrder
            braid_order = BraidOrder[session_data["braid_order"]]
            hkdf_salt = bytes.fromhex(session_data["hkdf_salt"]) if session_data["hkdf_salt"] else None
            session_config = SessionConfig(
                session_id=session_data["session_id"],
                braid_order=braid_order,
                time_window_size=session_data["time_window_size"],
                time_offset_tolerance=session_data["time_offset_tolerance"],
                hkdf_hash=session_data["hkdf_hash"],
                hkdf_salt=hkdf_salt,
                initiator_nonce=bytes.fromhex(session_data["initiator_nonce"]),
                responder_nonce=bytes.fromhex(session_data["responder_nonce"])
            )
            
            # Get time offset if set (NEW: Temporal Desynchronization)
            time_offset = session_data.get("time_offset_seconds", 0)
            direction = session_data.get("time_offset_direction", "forward")
            if direction == "backward":
                time_offset = -time_offset
        else:
            return jsonify({"status": "error", "message": "Session not found"}), 404
        
        # Derive braided key WITH TEMPORAL OFFSET
        from Braided_Key_Exchange.braided_key_derivation import BraidedKeyDeriver
        deriver = BraidedKeyDeriver(session_config, time_offset)
        key_material = deriver.derive_key(eeg_key)
        
        return jsonify({
            "status": "ok",
            "k_root": key_material.k_root.hex(),
            "entropy_hash_eeg": key_material.entropy_hash_eeg.hex(),
            "entropy_hash_quantum": key_material.entropy_hash_quantum.hex(),
            "time_window": key_material.time_window,
            "braid_sequence": key_material.braid_sequence,  # Already a string
            "time_offset_applied": time_offset  # ← Show offset applied
        }), 200
    
    except ValueError as ve:
        print(f"ValueError in derive_key: {ve}")
        return jsonify({"status": "error", "message": f"Invalid key format: {ve}"}), 400
    except Exception as e:
        print(f"Exception in derive_key: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/braided/set_time_offset", methods=["POST"])
def braided_set_time_offset():
    """
    Phase 1.5: Temporal Desynchronization
    
    Sender requests receiver to offset their clock for security
    This creates temporal confusion - attackers can't correlate timestamps
    
    Expects: {session_id: "...", time_offset_seconds: int, direction: "forward"|"backward"}
    Returns: {status, message, time_offset_seconds, direction, receiver_should_set_time_to}
    """
    if not HAS_BRAIDED_KEX:
        return jsonify({"status": "error", "message": "Braided key exchange not available"}), 503
    
    try:
        data = request.get_json() or {}
        session_id = data.get("session_id")
        time_offset_seconds = data.get("time_offset_seconds")
        direction = data.get("direction", "forward")
        
        if not session_id or time_offset_seconds is None:
            return jsonify({"status": "error", "message": "Missing session_id or time_offset_seconds"}), 400
        
        # Validate offset range (±2 hours max)
        if abs(time_offset_seconds) > 7200:
            return jsonify({"status": "error", "message": "Time offset too large (max ±2 hours)"}), 400
        
        # Load and update session config
        session_json_path = UPLOAD_DIR / f"session_{session_id}.json"
        if session_json_path.exists():
            with open(session_json_path, "r") as sf:
                session_data = _json.load(sf)
            
            sender_real_time = time.time()
            session_data["time_offset_seconds"] = time_offset_seconds
            session_data["time_offset_direction"] = direction
            session_data["sender_real_time"] = sender_real_time
            
            with open(session_json_path, "w") as sf:
                _json.dump(session_data, sf)
            
            # Calculate what receiver's time should be
            if direction == "forward":
                receiver_time = sender_real_time + time_offset_seconds
            else:
                receiver_time = sender_real_time - time_offset_seconds
            
            print(f"🕐 Temporal Desynchronization Set:")
            print(f"   Sender real time: {sender_real_time}")
            print(f"   Receiver offset: {direction} {time_offset_seconds}s")
            print(f"   Receiver target time: {receiver_time}")
            
            return jsonify({
                "status": "ok",
                "message": f"Time offset {direction} by {time_offset_seconds}s set for receiver",
                "session_id": session_id,
                "time_offset_seconds": time_offset_seconds,
                "direction": direction,
                "sender_real_time": int(sender_real_time),
                "receiver_should_set_time_to": int(receiver_time)
            }), 200
        else:
            return jsonify({"status": "error", "message": "Session not found"}), 404
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/braided/confirm_time_offset", methods=["POST"])
def braided_confirm_time_offset():
    """
    Phase 1.5: Receiver confirms time offset has been applied
    
    Expects: {session_id: "...", receiver_time_now: int}
    Returns: {status, confirmed, sender_real_time, receiver_offset_time, time_offset, direction, time_difference}
    """
    if not HAS_BRAIDED_KEX:
        return jsonify({"status": "error", "message": "Braided key exchange not available"}), 503
    
    try:
        data = request.get_json() or {}
        session_id = data.get("session_id")
        receiver_time_now = data.get("receiver_time_now")
        
        if not session_id or receiver_time_now is None:
            return jsonify({"status": "error", "message": "Missing session_id or receiver_time_now"}), 400
        
        session_json_path = UPLOAD_DIR / f"session_{session_id}.json"
        if session_json_path.exists():
            with open(session_json_path, "r") as sf:
                session_data = _json.load(sf)
            
            time_offset = session_data.get("time_offset_seconds", 0)
            direction = session_data.get("time_offset_direction", "forward")
            sender_real_time = session_data.get("sender_real_time", time.time())
            
            # Calculate current sender time (accounting for elapsed time since offset was set)
            current_sender_time = time.time()
            elapsed = current_sender_time - sender_real_time
            
            # Calculate expected receiver time (offset + elapsed time since setup)
            if direction == "forward":
                expected_time = sender_real_time + time_offset + elapsed
            else:
                expected_time = sender_real_time - time_offset + elapsed
            
            # Verify receiver's time matches offset (allow 10 second tolerance)
            time_diff = abs(receiver_time_now - expected_time)
            confirmed = time_diff < 10
            
            session_data["receiver_time_offset_confirmed"] = confirmed
            session_data["receiver_offset_time"] = receiver_time_now
            
            with open(session_json_path, "w") as sf:
                _json.dump(session_data, sf)
            
            print(f"SUCCESS: Temporal Desynchronization Confirmed:")
            print(f"   Expected receiver time: {expected_time}")
            print(f"   Actual receiver time: {receiver_time_now}")
            print(f"   Time difference: {time_diff:.2f}s")
            print(f"   Confirmed: {confirmed}")
            
            return jsonify({
                "status": "ok",
                "message": "Time offset confirmed" if confirmed else "Time offset verification failed",
                "confirmed": confirmed,
                "sender_real_time": int(sender_real_time),
                "receiver_offset_time": int(receiver_time_now),
                "time_offset": time_offset,
                "direction": direction,
                "time_difference": time_diff
            }), 200
        else:
            return jsonify({"status": "error", "message": "Session not found"}), 404
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/braided/test", methods=["POST"])
def braided_test():
    """
    Quick test: Full encryption/decryption cycle
    
    Expects: {eeg_key_hex: "...", plaintext: "..."}
    Returns: {encrypted: "...", decrypted: "...", success: bool}
    """
    if not HAS_BRAIDED_KEX:
        return jsonify({"status": "error", "message": "Braided key exchange not available"}), 503
    
    try:
        data = request.get_json() or {}
        eeg_key_hex = data.get("eeg_key")
        plaintext = data.get("plaintext", "test message")
        
        if not eeg_key_hex:
            return jsonify({"status": "error", "message": "Missing eeg_key"}), 400
        
        eeg_key = bytes.fromhex(eeg_key_hex)
        plaintext_bytes = plaintext.encode() if isinstance(plaintext, str) else plaintext
        
        # Phase 1: Establish path
        session_config = establish_path_locally()
        
        # Phase 2+3: Encrypt
        sender = create_secure_sender(session_config, eeg_key)
        secure_message = sender.send(plaintext_bytes)
        encrypted_bytes = secure_message.to_bytes()
        
        # Phase 3: Decrypt
        receiver = create_secure_receiver(session_config, eeg_key)
        decrypted_bytes = receiver.receive(secure_message)
        decrypted = decrypted_bytes.decode() if isinstance(plaintext, str) else decrypted_bytes
        
        success = decrypted == plaintext
        
        return jsonify({
            "status": "ok",
            "success": success,
            "encrypted_size": len(encrypted_bytes),
            "plaintext": plaintext,
            "decrypted": decrypted,
            "session_id": session_config.session_id,
            "braid_order": session_config.braid_order.name
        }), 200
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health", methods=["GET"])

def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200


@app.route("/getCameras", methods=["GET"])
def get_cameras():
    cameras = ["FrontEntrance", "ParkingLot", "BackAlley"]
    return jsonify({"cameras": cameras})


@app.route("/updateVectorStore", methods=["POST"])
def update_vector_store():
    data = request.get_json() or {}
    place = data.get("place")
    if not place:
        return jsonify({"status": "error", "message": "missing place"}), 400
    return jsonify({"status": "ok", "place": place})


@app.route("/createFlorenceDocument", methods=["POST"])
def create_florence_document():
    place = request.form.get("place")
    video = request.files.get("video")
    if not place or not video:
        return jsonify({"status": "error", "message": "missing place or video"}), 400

    safe_name = os.path.basename(video.filename)
    dest = UPLOAD_DIR / safe_name
    video.save(dest)

    return jsonify({"status": "ok", "filename": safe_name, "place": place})


@app.route("/getResponse", methods=["POST"])
def get_response():
    data = request.get_json() or {}
    query = data.get("query", "")

    reply = (
        "I analyzed the footage and found multiple events. "
        "Example timestamps: [0:00:12], [0:01:45], [0:03:10]. "
        "Ask me to jump to any timestamp or to summarize a particular interval."
    )

    return jsonify({"response": reply})


@app.route("/encrypt", methods=["POST"])
def encrypt_file():
    """
    Encrypt a file using Optimized Hybrid: 
    - AES-256-GCM for data
    - HQC to protect AES key
    - Dilithium (ML-DSA-44 default) to sign header
    - Optional zlib compression
    - Counter-based nonces
    
    NEW: Optional braided key exchange integration
    - If eeg_key provided: Use braided key exchange (K_root derived from EEG + quantum entropy)
    - If eeg_key not provided: Use standard hybrid encryption
    """
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"status": "error", "message": "missing file"}), 400
        
        file_content = file.read()
        
        # Check if braided key exchange is requested
        eeg_key_hex = request.form.get("eeg_key")
        session_id = request.form.get("session_id")
        use_braided = eeg_key_hex is not None and HAS_BRAIDED_KEX
        
        print(f"📨 /encrypt request received")
        print(f"   File: {file.filename}")
        print(f"   eeg_key present: {eeg_key_hex is not None}")
        print(f"   session_id: {session_id}")
        print(f"   use_braided: {use_braided}")
        
        # Get optimization parameters from request
        compression = request.form.get("compression", "true").lower() == "true"
        signature_variant = request.form.get("signature_variant", "ML-DSA-44")
        
        # Braided key exchange path
        if use_braided:
            try:
                print(f"🔐 Using BRAIDED encryption path...")
                eeg_key = bytes.fromhex(eeg_key_hex)
                
                # Load existing session if provided, otherwise establish new one
                if session_id:
                    print(f"   Loading existing session: {session_id}")
                    # Load session config from previously established path
                    session_json_path = UPLOAD_DIR / f"session_{session_id}.json"
                    if not session_json_path.exists():
                        print(f"   ❌ Session not found: {session_json_path}")
                        return jsonify({"status": "error", "message": "Session not found"}), 400
                    
                    with open(session_json_path, "r") as sf:
                        session_data = _json.load(sf)
                    
                    # Reconstruct SessionConfig
                    from Braided_Key_Exchange.path_establishment import BraidOrder
                    braid_order = BraidOrder[session_data["braid_order"]]
                    hkdf_salt = bytes.fromhex(session_data["hkdf_salt"]) if session_data["hkdf_salt"] else None
                    
                    session_config = SessionConfig(
                        session_id=session_data["session_id"],
                        braid_order=braid_order,
                        time_window_size=session_data["time_window_size"],
                        time_offset_tolerance=session_data["time_offset_tolerance"],
                        hkdf_hash=session_data["hkdf_hash"],
                        hkdf_salt=hkdf_salt,
                        initiator_nonce=bytes.fromhex(session_data["initiator_nonce"]),
                        responder_nonce=bytes.fromhex(session_data["responder_nonce"])
                    )
                    print(f"   SUCCESS: Session loaded and reconstructed")
                else:
                    print(f"   Creating NEW session (no session_id provided)")
                    # Phase 1: Path Establishment
                    session_config = establish_path_locally()
                
                # Phase 2: Key Derivation (braided mixing)
                # Check if K_root was passed from frontend (from Temporal page)
                k_root_hex = request.form.get("k_root")
                if k_root_hex:
                    print(f"   [KEY] Using K_root from frontend (from Temporal page)...")
                    k_root = bytes.fromhex(k_root_hex)
                else:
                    print(f"   [KEY] Deriving NEW session key...")
                    key_material = derive_session_key(eeg_key, session_config)
                    k_root = key_material.k_root
                print(f"   SUCCESS: K_root ready: {k_root.hex()[:16]}...")
                
                # Phase 3: Secure encryption with braided K_root
                print(f"   [ENCRYPT] Creating secure sender and encrypting...")
                sender = create_secure_sender(session_config, eeg_key)
                # Use the k_root we have (either from frontend or newly derived)
                secure_message = sender.send_with_kroot(file_content, k_root)
                print(f"   SUCCESS: File encrypted as SecureMessage")
                
                # Serialize and return
                encrypted_bytes = secure_message.to_bytes()
                print(f"   [PACKAGE] SecureMessage serialized: {len(encrypted_bytes)} bytes")
                out_name = f"encrypted_{os.path.basename(file.filename) or 'file'}"
                headers = {"Content-Disposition": f"attachment; filename={out_name}"}
                
                # Store session config AND k_root for receiver (overwrite if exists)
                session_json_path = UPLOAD_DIR / f"session_{secure_message.session_id}.json"
                with open(session_json_path, "w") as sf:
                    _json.dump({
                        "session_id": session_config.session_id,
                        "braid_order": str(session_config.braid_order.name),
                        "time_window_size": session_config.time_window_size,
                        "time_offset_tolerance": session_config.time_offset_tolerance,
                        "hkdf_hash": session_config.hkdf_hash,
                        "hkdf_salt": session_config.hkdf_salt.hex() if session_config.hkdf_salt else None,
                        "initiator_nonce": session_config.initiator_nonce.hex(),
                        "responder_nonce": session_config.responder_nonce.hex(),
                        "k_root": k_root.hex()  # Store K_root for decryption
                    }, sf)
                
                # === NEW: IPFS Upload Integration ===
                if HAS_IPFS_INTEGRATION:
                    try:
                        # Save encrypted file temporarily for upload
                        temp_encrypted_path = UPLOAD_DIR / out_name
                        with open(temp_encrypted_path, 'wb') as ef:
                            ef.write(encrypted_bytes)
                        
                        print(f"   [IPFS] Uploading to IPFS...")
                        uploader = get_uploader()
                        ipfs_result = uploader.upload_after_encryption(
                            encrypted_file_path=str(temp_encrypted_path),
                            session_id=secure_message.session_id,
                            original_filename=file.filename or 'file',
                            encryption_details={
                                'algorithm': 'Braided Key Exchange + AES-256-GCM',
                                'braid_order': str(session_config.braid_order.name),
                                'timestamp': time.time()
                            }
                        )
                        
                        if ipfs_result['success']:
                            print(f"   SUCCESS: IPFS Upload successful!")
                            print(f"      IPFS Hash: {ipfs_result['ipfs_hash']}")
                            print(f"      Gateway URL: {ipfs_result['gateway_url']}")
                            
                            # Store IPFS info in session JSON
                            with open(session_json_path, "r") as sf:
                                session_data = _json.load(sf)
                            session_data['ipfs_hash'] = ipfs_result['ipfs_hash']
                            session_data['ipfs_gateway_url'] = ipfs_result['gateway_url']
                            session_data['ipfs_pinata_url'] = ipfs_result['pinata_url']
                            with open(session_json_path, "w") as sf:
                                _json.dump(session_data, sf)
                        else:
                            print(f"   WARNING: IPFS Upload failed: {ipfs_result.get('error')}")
                        
                        # Clean up temp file (optional - keep for local backup)
                        # temp_encrypted_path.unlink()
                        
                    except Exception as ipfs_e:
                        print(f"   WARNING: IPFS upload error (non-fatal): {ipfs_e}")
                # === END IPFS Integration ===
                
                return Response(encrypted_bytes, headers=headers, mimetype="application/octet-stream")
            
            except ValueError as ve:
                return jsonify({"status": "error", "message": f"Invalid EEG key format: {ve}"}), 400
            except Exception as be:
                print(f"WARNING: Braided encryption failed: {be}")
                # Fall through to standard encryption
        
        # Standard hybrid encryption path (existing code)
        # Hybrid flow with optimizations
        try:
            from Post_Quantum_Cryptography.crypto_core import HQC_KEM, Dilithium_Sign
            from Post_Quantum_Cryptography.hybrid_crypto import encrypt_file_to_package, extract_package_id
            
            hqc = HQC_KEM()
            receiver_pk, receiver_sk = hqc.generate_keypair()
            dil = Dilithium_Sign(variant=signature_variant)
            sender_pk, sender_sk = dil.generate_keypair()

            package_bytes = encrypt_file_to_package(
                plaintext=file_content,
                original_name=os.path.basename(file.filename) or "file",
                receiver_hqc_public_key=receiver_pk,
                sender_dilithium_secret_key=sender_sk,
                compression=compression,
                signature_variant=signature_variant
            )

            # Extract package_id from the just-created package and store keys
            pkg_id = extract_package_id(package_bytes)
            keys_path = UPLOAD_DIR / f"keys_{pkg_id}.json"
            with open(keys_path, "w") as kf:
                _json.dump({
                    "receiver_sk": receiver_sk.hex(),
                    "sender_pk": sender_pk.hex(),
                    "compression": compression,
                    "signature_variant": signature_variant
                }, kf)

            out_name = f"encrypted_{os.path.basename(file.filename) or 'file'}"
            headers = {"Content-Disposition": f"attachment; filename={out_name}"}
            
            # Note: IPFS upload now manual via /ipfs/upload endpoint
            
            return Response(package_bytes, headers=headers, mimetype="application/octet-stream")
        except Exception as e:
            print(f"⚠️  Hybrid crypto failed: {e}. Falling back to demo XOR.")
            encrypted_bytes = _xor_encrypt_with_header(file_content, os.path.basename(file.filename) or "file")
            out_name = f"encrypted_{os.path.basename(file.filename) or 'file'}"
            headers = {"Content-Disposition": f"attachment; filename={out_name}"}
            
            # Note: IPFS upload now manual via /ipfs/upload endpoint
            
            return Response(encrypted_bytes, headers=headers, mimetype="application/octet-stream")
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route("/decrypt", methods=["POST"])
def decrypt_file():
    """
    Decrypt a package produced by /encrypt (optimized hybrid AES+HQC+Dilithium).
    
    NEW: Supports braided key exchange decryption
    - If eeg_key provided: Decrypt braided encrypted file
    - If eeg_key not provided: Use standard hybrid decryption
    """
    try:
        # Debug: Print what we're receiving
        print(f"📨 /decrypt request received")
        print(f"   Files: {list(request.files.keys())}")
        print(f"   Form fields: {list(request.form.keys())}")
        
        file = request.files.get("file")
        if not file:
            print(f"❌ No file found in request.files")
            return jsonify({"status": "error", "message": "missing file"}), 400
        
        print(f"✅ File received: '{file.filename}'")
        print(f"   📏 File size: {file.content_length if hasattr(file, 'content_length') else 'unknown'} bytes")
        package_bytes = file.read()
        print(f"   📦 Read {len(package_bytes)} bytes from upload")
        
        # Check if braided key exchange is being used
        eeg_key_hex = request.form.get("eeg_key")
        session_id = request.form.get("session_id")
        use_braided = eeg_key_hex is not None and session_id is not None and HAS_BRAIDED_KEX
        
        print(f"   eeg_key present: {eeg_key_hex is not None}")
        print(f"   session_id: {session_id}")
        print(f"   use_braided: {use_braided}")
        
        # Braided key exchange decryption path
        if use_braided:
            try:
                print(f"🔐 Attempting braided decryption...")
                eeg_key = bytes.fromhex(eeg_key_hex)
                print(f"   ✅ EEG key converted: {len(eeg_key)} bytes")
                
                # Deserialize SecureMessage
                print(f"   📦 Deserializing SecureMessage from {len(package_bytes)} bytes...")
                secure_message = SecureMessage.from_bytes(package_bytes)
                print(f"   ✅ SecureMessage deserialized")
                
                # Load stored session config
                session_json_path = UPLOAD_DIR / f"session_{session_id}.json"
                if not session_json_path.exists():
                    print(f"   ❌ Session file not found: {session_json_path}")
                    return jsonify({"status": "error", "message": "Session config not found"}), 400
                
                print(f"   📂 Loading session from: {session_json_path}")
                with open(session_json_path, "r") as sf:
                    session_data = _json.load(sf)
                print(f"   ✅ Session loaded")
                
                # Reconstruct SessionConfig
                from Braided_Key_Exchange.path_establishment import BraidOrder
                braid_order = BraidOrder[session_data["braid_order"]]
                hkdf_salt = bytes.fromhex(session_data["hkdf_salt"]) if session_data["hkdf_salt"] else None
                
                session_config = SessionConfig(
                    session_id=session_data["session_id"],
                    braid_order=braid_order,
                    time_window_size=session_data["time_window_size"],
                    time_offset_tolerance=session_data["time_offset_tolerance"],
                    hkdf_hash=session_data["hkdf_hash"],
                    hkdf_salt=hkdf_salt,
                    initiator_nonce=bytes.fromhex(session_data["initiator_nonce"]),
                    responder_nonce=bytes.fromhex(session_data["responder_nonce"])
                )
                print(f"   ✅ SessionConfig reconstructed")
                
                # Get stored K_root instead of re-deriving (to match encryption key with time offset)
                k_root = bytes.fromhex(session_data.get("k_root", ""))
                if not k_root:
                    print(f"   ⚠️  No stored K_root, deriving new one (may fail if time offset was used)")
                    # Fallback: derive key (won't work with time offset)
                    from Braided_Key_Exchange.braided_key_derivation import derive_session_key
                    key_material = derive_session_key(eeg_key, session_config)
                    k_root = key_material.k_root
                else:
                    print(f"   ✅ Using stored K_root from encryption: {k_root.hex()[:16]}...")
                
                # Phase 3: Decrypt with braided K_root (inject k_root directly)
                print(f"   🔓 Creating secure receiver with stored K_root...")
                # Create receiver with the stored k_root by bypassing derivation
                receiver = create_secure_receiver(session_config, eeg_key)
                # Inject the k_root directly
                receiver._k_root = k_root
                print(f"   ✅ Receiver created, attempting decryption...")
                plaintext = receiver.receive_with_kroot(secure_message, k_root)
                print(f"   ✅ Decryption successful! {len(plaintext)} bytes recovered")
                
                out_name = f"decrypted_braided_file"
                headers = {"Content-Disposition": f"attachment; filename={out_name}"}
                return Response(plaintext, headers=headers, mimetype="application/octet-stream")
            
            except ValueError as ve:
                print(f"   ❌ ValueError in braided decryption: {ve}")
                import traceback
                traceback.print_exc()
                return jsonify({"status": "error", "message": f"Invalid EEG key format: {ve}"}), 400
            except Exception as be:
                print(f"   ❌ Exception in braided decryption: {be}")
                import traceback
                traceback.print_exc()
                # Fall through to standard decryption
        
        # Standard hybrid decryption path (existing code)
        print(f"   🔄 Attempting standard hybrid decryption...")
        try:
            from Post_Quantum_Cryptography.hybrid_crypto import decrypt_package_to_plaintext, extract_package_id
            
            # Check if this is a valid encrypted package
            print(f"   📦 Validating package format from {len(package_bytes)} bytes...")
            if len(package_bytes) < 12:
                raise ValueError("File too small to be a valid encrypted package")
            
            # Check magic bytes
            magic_bytes = package_bytes[:8]
            expected_magic = b"BWC-OPT3"
            print(f"   🔍 Magic bytes: {magic_bytes} (expected: {expected_magic})")
            
            if magic_bytes != expected_magic:
                print(f"   ⚠️  Not a BWC encrypted file, magic mismatch")
                # Try to identify what type of file this might be
                file_info = ""
                if magic_bytes.startswith(b"\\x50\\x4B"):
                    file_info = " (appears to be a ZIP/Office document)"
                elif magic_bytes.startswith(b"\\xFF\\xD8\\xFF"):
                    file_info = " (appears to be a JPEG image)"
                elif magic_bytes.startswith(b"%PDF"):
                    file_info = " (appears to be a PDF document)"
                elif magic_bytes.startswith(b"\\x89PNG"):
                    file_info = " (appears to be a PNG image)"
                
                raise ValueError(f"File does not appear to be encrypted with this system{file_info}. Please upload a file that was encrypted using this application.")
            
            # Extract package ID
            pkg_id = extract_package_id(package_bytes)
            print(f"   ✅ Package ID extracted: {pkg_id}")
            
            keys_path = UPLOAD_DIR / f"keys_{pkg_id}.json"
            print(f"   🔍 Looking for keys file: {keys_path}")
            
            if keys_path.exists():
                print(f"   ✅ Keys file found, loading...")
                with open(keys_path, "r") as kf:
                    keys = _json.load(kf)
                receiver_sk = bytes.fromhex(keys["receiver_sk"])
                print(f"   ✅ Receiver secret key loaded ({len(receiver_sk)} bytes)")
            else:
                print(f"   ⚠️  Keys file not found, generating fresh keypair (may fail)")
                # Fallback: generate fresh keypair (demo only; will fail signature or unwrap)
                from Post_Quantum_Cryptography.crypto_core import HQC_KEM
                hqc = HQC_KEM()
                _, receiver_sk = hqc.generate_keypair()
            
            print(f"   🔓 Attempting decryption with hybrid crypto...")
            plaintext, hdr = decrypt_package_to_plaintext(package_bytes, receiver_hqc_secret_key=receiver_sk)
            print(f"   ✅ Decryption successful! {len(plaintext)} bytes recovered")
            
            out_name = f"decrypted_{hdr.get('filename','file')}"
            headers = {"Content-Disposition": f"attachment; filename={out_name}"}
            return Response(plaintext, headers=headers, mimetype="application/octet-stream")
        except Exception as e:
            print(f"   ❌ Hybrid decrypt failed: {e}")
            import traceback
            traceback.print_exc()
            
            # Try fallback XOR decryption for demo files
            print(f"   🔄 Attempting fallback XOR decryption...")
            try:
                decrypted_bytes, original_filename = _xor_decrypt_with_header(package_bytes)
                print(f"   📝 Filename from header: {original_filename}")
                
                # If header extraction failed but we have filename from IPFS metadata, use that
                if original_filename == "file" and file.filename:
                    # Try to extract from uploaded filename
                    uploaded_name = file.filename
                    print(f"   📝 Uploaded filename from request: {uploaded_name}")
                    
                    # Strip "encrypted_" or "encrypted-" prefix
                    if uploaded_name.startswith('encrypted_'):
                        uploaded_name = uploaded_name[10:]
                        print(f"   ✂️  Stripped 'encrypted_' prefix: {uploaded_name}")
                    elif uploaded_name.startswith('encrypted-'):
                        uploaded_name = uploaded_name[10:]
                        print(f"   ✂️  Stripped 'encrypted-' prefix: {uploaded_name}")
                    
                    if uploaded_name and uploaded_name != "file":
                        original_filename = uploaded_name
                        print(f"   ✅ Using filename from upload: {original_filename}")
                
                out_name = f"decrypted_{original_filename}"
                print(f"   ✅ XOR decryption successful!")
                print(f"   📦 Final output filename: {out_name}")
                headers = {"Content-Disposition": f"attachment; filename={out_name}"}
                return Response(decrypted_bytes, headers=headers, mimetype="application/octet-stream")
            except Exception as fallback_e:
                print(f"   ❌ Fallback decryption also failed: {fallback_e}")
                return jsonify({
                    "status": "error", 
                    "message": f"Decryption failed. Original error: {str(e)}. This file may not be encrypted with this system or the encryption keys are missing."
                }), 400
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/share", methods=["POST"])
def share_file():
    """Share a file to another host with transport-only protections (time dilation + entanglement-based pacing).
    Expects multipart form with fields: file (binary), target_ip (string). The receiver must run this backend.
    """
    try:
        target_ip = request.form.get("target_ip")
        f = request.files.get("file")
        if not target_ip or not f:
            return jsonify({"status": "error", "message": "missing target_ip or file"}), 400

        data = f.read()

        # Transport pacing using synthetic entropy and time dilation
        # Create deterministic seeds per session
        seeds = [secure_random_bytes(32) for _ in range(4)]

        def gen():
            chunk_size = 64 * 1024
            idx = 0
            for off in range(0, len(data), chunk_size):
                chunk = data[off:off+chunk_size]
                ent = generate_quantum_entropy(seeds[idx % len(seeds)])
                delay_us = compute_chunk_delay(ent, idx, b"transport-eeg")
                time.sleep(delay_us / 1_000_000.0)
                idx += 1
                yield chunk

        url = f"http://{target_ip}:5010/receive"
        r = requests.post(url, data=gen(), headers={"X-BWC-Transfer": "dilated-entangled"}, timeout=120)
        return jsonify({"status": "ok", "target": target_ip, "code": r.status_code}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/receive", methods=["POST"])
def receive_file():
    """Receive a streamed file from /share. Saves into uploads with a generated name."""
    try:
        name = f"received_{uuid.uuid4().hex}.bin"
        dest = UPLOAD_DIR / name
        with open(dest, "wb") as out:
            while True:
                chunk = request.stream.read(64 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        return jsonify({"status": "ok", "saved_as": name}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



# Demo XOR functions for fallback (when full crypto not available)
def _xor(data: bytes, key: int) -> bytes:
    return bytes(b ^ key for b in data)


def _xor_encrypt(data: bytes) -> bytes:
    """Simple 3-layer XOR for demo/fallback"""
    # Layer 1: Brainwave (XOR 0x13)
    layer1 = _xor(data, 0x13)
    # Layer 2: PQC (XOR 0xA7)
    layer2 = _xor(layer1, 0xA7)
    # Layer 3: Time Dilation (XOR 0x5C)
    return _xor(layer2, 0x5C)


def _xor_encrypt_with_header(data: bytes, filename: str) -> bytes:
    """XOR encryption with filename header for demo/fallback"""
    # Create header: filename length (2 bytes) + filename (UTF-8) + encrypted data
    filename_bytes = filename.encode('utf-8')
    filename_len = len(filename_bytes)
    if filename_len > 65535:
        filename_bytes = filename_bytes[:65535]
        filename_len = 65535
    
    header = filename_len.to_bytes(2, 'big') + filename_bytes
    encrypted_data = _xor_encrypt(data)
    return header + encrypted_data


def _xor_decrypt(data: bytes) -> bytes:
    """Simple 3-layer XOR reverse for demo/fallback (XOR is its own inverse)"""
    # Layer 3: Time Dilation (XOR 0x5C)
    layer3 = _xor(data, 0x5C)
    # Layer 2: PQC (XOR 0xA7)
    layer2 = _xor(layer3, 0xA7)
    # Layer 1: Brainwave (XOR 0x13)
    return _xor(layer2, 0x13)


def _xor_decrypt_with_header(data: bytes) -> tuple[bytes, str]:
    """XOR decryption that extracts filename header"""
    if len(data) < 2:
        # No header, return as-is
        return _xor_decrypt(data), "file"
    
    # Extract filename from header
    filename_len = int.from_bytes(data[0:2], 'big')
    if filename_len == 0 or filename_len > 1000:
        # Invalid header or no header, decrypt entire thing
        return _xor_decrypt(data), "file"
    
    try:
        filename_bytes = data[2:2+filename_len]
        filename = filename_bytes.decode('utf-8')
        encrypted_data = data[2+filename_len:]
        plaintext = _xor_decrypt(encrypted_data)
        return plaintext, filename
    except:
        # Header parsing failed, decrypt entire thing
        return _xor_decrypt(data), "file"


def reverse_pqc_encryption(data: bytes) -> bytes:
    return _xor(data, 0xA7)


def reverse_time_dilation_encryption(data: bytes) -> bytes:
    return _xor(data, 0x5C)


# ============================================================================
# IPFS Integration Endpoints
# ============================================================================

@app.route("/ipfs/info/<session_id>", methods=["GET"])
def get_ipfs_info(session_id):
    """Get IPFS upload information for a session"""
    if not HAS_IPFS_INTEGRATION:
        return jsonify({"status": "error", "message": "IPFS integration not available"}), 503
    
    try:
        uploader = get_uploader()
        info = uploader.get_upload_info(session_id)
        
        if info:
            return jsonify({
                "status": "success",
                "data": info
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "No IPFS upload found for this session"
            }), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/ipfs/list", methods=["GET"])
def list_ipfs_uploads():
    """List all IPFS uploads"""
    if not HAS_IPFS_INTEGRATION:
        return jsonify({"status": "error", "message": "IPFS integration not available"}), 503
    
    try:
        uploader = get_uploader()
        uploads = uploader.list_all_uploads()
        
        return jsonify({
            "status": "success",
            "count": len(uploads),
            "uploads": uploads
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/ipfs/test", methods=["GET"])
def test_ipfs_connection():
    """Test IPFS/Pinata connection"""
    if not HAS_IPFS_INTEGRATION:
        return jsonify({"status": "error", "message": "IPFS integration not available"}), 503
    
    try:
        from IPFS_Integration.pinata_service import get_pinata_service
        pinata = get_pinata_service()
        success, message = pinata.test_connection()
        
        if success:
            return jsonify({
                "status": "success",
                "message": message
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": message
            }), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/ipfs/fetch/<cid>", methods=["GET"])
def fetch_from_ipfs(cid):
    """Fetch an encrypted file from IPFS using CID"""
    if not HAS_IPFS_INTEGRATION:
        return jsonify({"status": "error", "message": "IPFS integration not available"}), 503
    
    try:
        print(f"📥 Fetching file from IPFS: {cid}")
        
        # First, try to get filename from Pinata metadata
        filename = "encrypted_file"
        try:
            uploader = get_uploader()
            pinata_service = uploader.pinata_service
            
            # Query Pinata for pin metadata
            metadata_response = requests.get(
                f"https://api.pinata.cloud/data/pinList?hashContains={cid}",
                headers=pinata_service.headers,
                timeout=10
            )
            
            if metadata_response.status_code == 200:
                pins = metadata_response.json().get('rows', [])
                if pins:
                    pin_name = pins[0].get('metadata', {}).get('name', '')
                    if pin_name:
                        filename = pin_name
                        print(f"   📝 Found filename from Pinata metadata: {filename}")
        except Exception as e:
            print(f"   ⚠️  Could not retrieve filename from Pinata metadata: {e}")
            
            # Fallback: Try to find from our local logs
            try:
                uploader = get_uploader()
                all_uploads = uploader.list_all_uploads()
                for upload in all_uploads:
                    if upload.get('ipfs_hash') == cid:
                        filename = upload.get('encrypted_filename', filename)
                        print(f"   📝 Found filename from local logs: {filename}")
                        break
            except Exception as e2:
                print(f"   ⚠️  Could not retrieve filename from logs: {e2}")
        
        # Fetch file content from Pinata gateway
        gateway_url = f"https://gateway.pinata.cloud/ipfs/{cid}"
        response = requests.get(gateway_url, timeout=30)
        
        if response.status_code != 200:
            return jsonify({
                "status": "error",
                "message": f"Failed to fetch from IPFS: {response.status_code}"
            }), 502
        
        print(f"   ✅ Retrieved {len(response.content)} bytes from IPFS")
        
        # Return the file with proper headers including original filename metadata
        # Strip "encrypted_" or "encrypted-" prefix to get original name
        original_name = filename
        if filename.startswith('encrypted_'):
            original_name = filename[10:]  # Remove "encrypted_"
        elif filename.startswith('encrypted-'):
            original_name = filename[10:]  # Remove "encrypted-"
        
        print(f"   🏷️  Encrypted filename: {filename}")
        print(f"   🏷️  Original filename: {original_name}")
        
        headers = {
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Original-Filename": filename,
            "X-Decrypted-Filename": original_name,  # Add the clean original name
            "X-IPFS-Hash": cid
        }
        
        return Response(response.content, headers=headers, mimetype="application/octet-stream")
        
    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": "IPFS gateway timeout"}), 504
    except Exception as e:
        print(f"   ❌ Error fetching from IPFS: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/ipfs/upload", methods=["POST"])
def manual_ipfs_upload():
    """Manually upload an encrypted file to IPFS"""
    if not HAS_IPFS_INTEGRATION:
        return jsonify({"status": "error", "message": "IPFS integration not available"}), 503
    
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"status": "error", "message": "No file provided"}), 400
        
        original_filename = request.form.get("original_filename", "file")
        
        print(f"📤 Manual IPFS upload requested")
        print(f"   File: {file.filename}")
        print(f"   Original: {original_filename}")
        
        # Save file temporarily
        import uuid
        session_id = str(uuid.uuid4())
        temp_path = UPLOAD_DIR / file.filename
        file.save(temp_path)
        
        print(f"   ☁️  Uploading to IPFS...")
        uploader = get_uploader()
        ipfs_result = uploader.upload_after_encryption(
            encrypted_file_path=str(temp_path),
            session_id=session_id,
            original_filename=original_filename,
            encryption_details={
                'algorithm': 'Manual Upload',
                'timestamp': time.time()
            }
        )
        
        if ipfs_result['success']:
            print(f"   ✅ IPFS Upload successful!")
            print(f"      IPFS Hash: {ipfs_result['ipfs_hash']}")
            print(f"      Gateway URL: {ipfs_result['gateway_url']}")
            
            return jsonify({
                "status": "success",
                "ipfs_hash": ipfs_result['ipfs_hash'],
                "gateway_url": ipfs_result['gateway_url'],
                "pinata_url": ipfs_result['pinata_url'],
                "session_id": session_id
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": ipfs_result.get('error', 'Upload failed')
            }), 500
            
    except Exception as e:
        print(f"   ❌ Upload error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010, debug=True)
