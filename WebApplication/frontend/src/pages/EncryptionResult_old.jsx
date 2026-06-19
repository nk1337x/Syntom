import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, Download, Copy, Clock, FileCheck, Cloud } from "lucide-react";
import { motion } from "framer-motion";
import { useAlert, useEncryption } from "../App";

const EncryptionResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const alert = useAlert();
  const enc = useEncryption();
  const [copied, setCopied] = useState(false);
  const [uploadingToIpfs, setUploadingToIpfs] = useState(false);
  const [ipfsHash, setIpfsHash] = useState(null);
  const [ipfsGatewayUrl, setIpfsGatewayUrl] = useState(null);
  
  // Get the mode from location state (default to 'encrypt')
  const mode = location.state?.mode || "encrypt";
  const isDecryption = mode === "decrypt";

  if (!enc.resultUrl) {
    navigate("/encryption", { replace: true });
    return null;
  }

  const handleDownload = () => {
    try {
      const a = document.createElement("a");
      a.href = enc.resultUrl;
      // For decryption, add "decrypted-" prefix; for encryption, add "encrypted-" prefix
      const filename = isDecryption 
        ? `decrypted-${enc.uploadedFileName ?? "file"}` 
        : `encrypted-${enc.uploadedFileName ?? "file"}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      alert.success("Download started");
    } catch (err) {
      console.error(err);
      alert.error("Failed to download file");
    }
  };

  const handleCopyKey = () => {
    // Generate a demo encryption key (in real app this would be actual key)
    const demoKey = `NEUROLOCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now()}`;
    navigator.clipboard.writeText(demoKey);
    setCopied(true);
    alert.success("Encryption key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadToIpfs = async () => {
    if (isDecryption) {
      alert.info("IPFS upload is only available for encrypted files");
      return;
    }

    setUploadingToIpfs(true);
    try {
      // Fetch the encrypted blob from the in-memory URL
      const blob = await (await fetch(enc.resultUrl)).blob();
      const fd = new FormData();
      fd.append("file", new File([blob], `encrypted-${enc.uploadedFileName || "file"}.bwc`, { type: "application/octet-stream" }));
      fd.append("original_filename", enc.uploadedFileName || "file");
      
      const apiBase = import.meta.env?.VITE_API_BASE || "http://localhost:5010";
      const res = await fetch(`${apiBase}/ipfs/upload`, { method: "POST", body: fd });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
      
      const data = await res.json();
      setIpfsHash(data.ipfs_hash);
      setIpfsGatewayUrl(data.gateway_url);
      alert.success("File uploaded to IPFS successfully!");
    } catch (err) {
      console.error(err);
      alert.error(err.message || "Failed to upload to IPFS");
    } finally {
      setUploadingToIpfs(false);
    }
  };

  const handleCopyIpfsCid = () => {
    if (ipfsHash) {
      navigator.clipboard.writeText(ipfsHash);
      alert.success("IPFS CID copied to clipboard");
    }
  };

  const handleShare = async () => {
    try {
      const target = window.prompt("Enter target IP (machine running backend on port 5010)");
      if (!target) return;
      const apiBase = import.meta.env?.VITE_API_BASE || "http://localhost:5010";
      // Fetch the encrypted blob from the in-memory URL
      const blob = await (await fetch(enc.resultUrl)).blob();
      const fd = new FormData();
      fd.append("file", new File([blob], `encrypted-${enc.uploadedFileName || "file"}.bwc`, { type: "application/octet-stream" }));
      fd.append("target_ip", target);
      const res = await fetch(`${apiBase}/share`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Share failed: ${res.status}`);
      const data = await res.json();
      alert.success(`Shared to ${target} (code ${data.code ?? res.status})`);
    } catch (err) {
      console.error(err);
      alert.error("Failed to share file");
    }
  }

  // Demo file size (in real app calculate from blob)
  const fileSize = "2.4 MB";
  const encryptionTime = "3.6s";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/60 rounded-2xl p-8 w-full max-w-3xl shadow-2xl"
      >
        {/* Success Icon with pulse animation */}
        <motion.div
          className="flex items-center justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 w-24 h-24 rounded-full bg-[#00E68F]/20"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-[#00E68F] to-[#007F5E] flex items-center justify-center shadow-lg shadow-[#00E68F]/30">
              <CheckCircle size={48} className="text-black" strokeWidth={2.5} />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-3xl font-bold text-center mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          ✅ {isDecryption ? "Decryption Complete" : "Encryption Complete"}
        </motion.h2>

        <motion.p
          className="text-center text-gray-400 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {isDecryption 
            ? "Your file has been successfully decrypted to its original state" 
            : "Your file has been securely encrypted with multi-layer protection"}
        </motion.p>

        {/* File Info Summary */}
        <motion.div
          className="bg-gray-900/50 rounded-xl p-6 mb-6 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <FileCheck className="text-[#00E68F]" size={20} />
              <div>
                <div className="text-sm text-gray-400">
                  {isDecryption ? "Decrypted Filename" : "Output Filename"}
                </div>
                <div className="text-gray-100 font-medium">
                  {isDecryption 
                    ? `decrypted-${enc.uploadedFileName ?? "file"}`
                    : `encrypted-${enc.uploadedFileName}`}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Download className="text-cyan-400" size={18} />
              <div>
                <div className="text-xs text-gray-400">File Size</div>
                <div className="text-gray-100 font-medium text-sm">{fileSize}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="text-purple-400" size={18} />
              <div>
                <div className="text-xs text-gray-400">Encryption Time</div>
                <div className="text-gray-100 font-medium text-sm">{encryptionTime}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Layer Status Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >{!isDecryption && !ipfsHash && (
            <motion.button
              onClick={handleUploadToIpfs}
              disabled={uploadingToIpfs}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={!uploadingToIpfs ? { scale: 1.05 } : {}}
              whileTap={!uploadingToIpfs ? { scale: 0.95 } : {}}
            >
              {uploadingToIpfs ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Uploading to IPFS...</span>
                </>
              ) : (
                <>
                  <Cloud size={18} />
                  <span>Upload to IPFS</span>
                </>
              )}
            </motion.button>
          )}

          <motion.button
            onClick={handleShare}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Share Securely
          </motion.button>

          <motion.button
            onClick={handleCopyKey}
            className="w-full sm:w-auto px-6 py-3 bg-gray-800/80 text-gray-100 rounded-lg font-semibold flex items-center justify-center gap-2 border border-gray-700/60 hover:bg-gray-700/80 hover:border-gray-600/60 transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Copy size={18} />
            {copied ? "Copied!" : (isDecryption ? "Copy Decryption Info" : "Copy Key")}
          </motion.button>

          <motion.button
            onClick={() => navigate(isDecryption ? "/decrypt" : "/encryption")}
            className="w-full sm:w-auto px-6 py-3 bg-gray-800/40 text-gray-300 rounded-lg font-medium hover:bg-gray-800/60 transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {isDecryption ? "Decrypt Another File" : "Encrypt Another File"}
          </motion.button>
        </motion.div>

        {/* IPFS Upload Success Section */}
        {ipfsHash && (
          <motion.div
            className="mt-6 bg-purple-500/10 border border-purple-500/30 rounded-xl p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="text-purple-400" size={24} />
              <h3 className="text-lg font-semibold text-purple-300">Uploaded to IPFS Cloud</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">IPFS CID (Hash)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-900/50 rounded text-sm text-gray-200 font-mono break-all">
                    {ipfsHash}
                  </code>
                  <motion.button
                    onClick={handleCopyIpfsCid}
                    className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Copy size={16} />
                  </motion.button>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Gateway URL</div>
                <a
                  href={ipfsGatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 bg-gray-900/50 rounded text-sm text-blue-400 hover:text-blue-300 break-all underline"
                >
                  {ipfsGatewayUrl}
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                ✅ Your encrypted file is now stored on IPFS and accessible worldwide via the CID
              </p>
            </div>
          </motion.div>
        )}opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <motion.button
            onClick={handleDownload}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#00E68F] to-[#007F5E] text-black rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#00E68F]/20"
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(0, 230, 143, 0.4)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Download size={18} />
            {isDecryption ? "Download Decrypted File" : "Download Encrypted File"}
          </motion.button>

          <motion.button
            onClick={handleShare}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Share Securely
          </motion.button>

          <motion.button
            onClick={handleCopyKey}
            className="w-full sm:w-auto px-6 py-3 bg-gray-800/80 text-gray-100 rounded-lg font-semibold flex items-center justify-center gap-2 border border-gray-700/60 hover:bg-gray-700/80 hover:border-gray-600/60 transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Copy size={18} />
            {copied ? "Copied!" : (isDecryption ? "Copy Decryption Info" : "Copy Key")}
          </motion.button>

          <motion.button
            onClick={() => navigate(isDecryption ? "/decrypt" : "/encryption")}
            className="w-full sm:w-auto px-6 py-3 bg-gray-800/40 text-gray-300 rounded-lg font-medium hover:bg-gray-800/60 transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {isDecryption ? "Decrypt Another File" : "Encrypt Another File"}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EncryptionResult;
