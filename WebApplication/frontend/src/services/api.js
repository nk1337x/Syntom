/**
 * API Service - Centralized backend communication
 * Base URL: http://localhost:5010
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5010";

// ==================== CCTV & CAMERA ENDPOINTS ====================

/**
 * Get all available cameras
 * @returns {Promise<Array>} List of camera names
 */
export const getCameras = async () => {
  try {
    const response = await fetch(`${API_BASE}/getCameras`, {
      method: "GET",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.cameras || [];
  } catch (error) {
    console.error("Error fetching cameras:", error);
    throw error;
  }
};

// ==================== VECTOR STORE ENDPOINTS ====================

/**
 * Update vector store with a new place/location
 * @param {string} place - Location name
 * @returns {Promise<Object>} Confirmation with place info
 */
export const updateVectorStore = async (place) => {
  try {
    const response = await fetch(`${API_BASE}/updateVectorStore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error updating vector store:", error);
    throw error;
  }
};

// ==================== FLORENCE DOCUMENT ENDPOINTS ====================

/**
 * Create a Florence Document with video upload
 * @param {string} place - Location name
 * @param {File} videoFile - Video file to upload
 * @returns {Promise<Object>} Response with filename and status
 */
export const createFlorenceDocument = async (place, videoFile) => {
  try {
    const formData = new FormData();
    formData.append("place", place);
    formData.append("video", videoFile);

    const response = await fetch(`${API_BASE}/createFlorenceDocument`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error creating Florence document:", error);
    throw error;
  }
};

// ==================== CHATBOT & QUERY ENDPOINTS ====================

/**
 * Send a query to the chatbot and get response
 * @param {string} query - User's query/question
 * @returns {Promise<Object>} Chatbot response
 */
export const getResponse = async (query) => {
  try {
    const response = await fetch(`${API_BASE}/getResponse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error getting response:", error);
    throw error;
  }
};

// ==================== FILE ENCRYPTION ENDPOINTS ====================

/**
 * Encrypt a file using the backend crypto service
 * @param {File} file - File to encrypt
 * @param {Object} options - Encryption options (may include eeg_key, session_id for braided encryption)
 * @returns {Promise<Blob>} Encrypted file
 */
export const encryptFile = async (file, options = {}) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    // If braided key options are provided, add them to form data
    // instead of JSON options to ensure backend receives them properly
    if (options.eeg_key && options.session_id) {
      formData.append("eeg_key", options.eeg_key);
      formData.append("session_id", options.session_id);
      if (options.k_root) {
        formData.append("k_root", options.k_root);  // Pass K_root directly
      }
      // Remove from options to avoid duplication
      const { eeg_key, session_id, k_root, ...remainingOptions } = options;
      if (Object.keys(remainingOptions).length > 0) {
        formData.append("options", JSON.stringify(remainingOptions));
      }
    } else {
      formData.append("options", JSON.stringify(options));
    }

    const response = await fetch(`${API_BASE}/encrypt`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (error) {
    console.error("Error encrypting file:", error);
    throw error;
  }
};

/**
 * Decrypt a file using the backend crypto service
 * @param {File} file - File to decrypt
 * @param {Object} options - Decryption options (may include eeg_key, session_id for braided decryption)
 * @returns {Promise<Blob>} Decrypted file
 */
export const decryptFile = async (file, options = {}) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    // If braided key options are provided, add them to form data
    // instead of JSON options to ensure backend receives them properly
    if (options.eeg_key && options.session_id) {
      formData.append("eeg_key", options.eeg_key);
      formData.append("session_id", options.session_id);
      // Remove from options object since we're passing as form fields
      const { eeg_key, session_id, ...remainingOptions } = options;
      if (Object.keys(remainingOptions).length > 0) {
        formData.append("options", JSON.stringify(remainingOptions));
      }
    } else {
      formData.append("options", JSON.stringify(options));
    }

    const response = await fetch(`${API_BASE}/decrypt`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const blob = await response.blob();
    
    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'decrypted_file';
    if (contentDisposition) {
      const matches = /filename=([^;]+)/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1].trim();
      }
    }
    
    // Return both blob and filename
    return { blob, filename };
  } catch (error) {
    console.error("Error decrypting file:", error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Name for the downloaded file
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Check API connectivity
 * @returns {Promise<boolean>} True if API is reachable
 */
export const checkAPIHealth = async () => {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Share an encrypted file to another host
 * @param {File|Blob} file - Encrypted file to share
 * @param {string} targetIp - Target IP address (must run backend on port 5010)
 * @returns {Promise<Object>} Share result
 */
export const shareFile = async (file, targetIp) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_ip", targetIp);

    const response = await fetch(`${API_BASE}/share`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error sharing file:", error);
    throw error;
  }
};

// ==================== BRAIDED KEY EXCHANGE ENDPOINTS ====================

/**
 * Phase 1: Establish braided path (create session)
 * @returns {Promise<Object>} Session configuration
 */
export const establishBraidedPath = async () => {
  try {
    const response = await fetch(`${API_BASE}/braided/establish_path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message || "Failed to establish path");
    return data;
  } catch (error) {
    console.error("❌ Error establishing braided path:", error);
    throw error;
  }
};

/**
 * Phase 2: Derive braided session key
 * @param {string} eegKeyHex - EEG key in hex format
 * @param {string} sessionId - Session ID from Phase 1
 * @returns {Promise<Object>} K_root and key info
 */
export const deriveBraidedSessionKey = async (eegKeyHex, sessionId) => {
  try {
    const response = await fetch(`${API_BASE}/braided/derive_key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eeg_key: eegKeyHex,
        session_id: sessionId
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message || "Failed to derive key");
    return data;
  } catch (error) {
    console.error("❌ Error deriving braided session key:", error);
    throw error;
  }
};

/**
 * Phase 3: Encrypt message with braided encryption
 * @param {string} plaintext - Message to encrypt
 * @param {string} eegKeyHex - EEG key in hex format
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Encrypted data
 */
export const encryptWithBraided = async (plaintext, eegKeyHex, sessionId) => {
  try {
    const response = await fetch(`${API_BASE}/braided/encrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plaintext,
        eeg_key: eegKeyHex,
        session_id: sessionId
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message || "Failed to encrypt");
    return data;
  } catch (error) {
    console.error("❌ Error encrypting with braided:", error);
    throw error;
  }
};

/**
 * Phase 3: Decrypt message with braided encryption
 * @param {string} ciphertext - Encrypted message (hex)
 * @param {string} eegKeyHex - EEG key in hex format
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Decrypted plaintext
 */
export const decryptWithBraided = async (ciphertext, eegKeyHex, sessionId) => {
  try {
    const response = await fetch(`${API_BASE}/braided/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext,
        eeg_key: eegKeyHex,
        session_id: sessionId
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message || "Failed to decrypt");
    return data;
  } catch (error) {
    console.error("❌ Error decrypting with braided:", error);
    throw error;
  }
};

// ==================== TEMPORAL DESYNCHRONIZATION ENDPOINTS ====================

/**
 * Phase 1.5: Set time offset for receiver
 * Sender requests receiver to offset their clock for security
 * @param {string} sessionId - Session ID from Phase 1
 * @param {number} offsetSeconds - Seconds to offset (±7200 max)
 * @param {string} direction - "forward" or "backward"
 * @returns {Promise<Object>} Offset confirmation
 */
export const setTimeOffset = async (sessionId, offsetSeconds, direction = "forward") => {
  try {
    const response = await fetch(`${API_BASE}/braided/set_time_offset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        time_offset_seconds: Math.abs(offsetSeconds),
        direction: direction
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message);
    return data;
  } catch (error) {
    console.error("❌ Error setting time offset:", error);
    throw error;
  }
};

/**
 * Phase 1.5: Confirm time offset applied on receiver side
 * @param {string} sessionId - Session ID
 * @param {number} receiverTimeNow - Receiver's current offset time
 * @returns {Promise<Object>} Confirmation result
 */
export const confirmTimeOffset = async (sessionId, receiverTimeNow) => {
  try {
    const response = await fetch(`${API_BASE}/braided/confirm_time_offset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        receiver_time_now: receiverTimeNow
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message);
    return data;
  } catch (error) {
    console.error("❌ Error confirming time offset:", error);
    throw error;
  }
};

export default {
  getCameras,
  updateVectorStore,
  createFlorenceDocument,
  getResponse,
  encryptFile,
  decryptFile,
  downloadBlob,
  checkAPIHealth,
  shareFile,
  establishBraidedPath,
  deriveBraidedSessionKey,
  encryptWithBraided,
  decryptWithBraided,
  setTimeOffset,
  confirmTimeOffset
}
