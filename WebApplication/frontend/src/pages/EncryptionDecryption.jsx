import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Download, Shield, Unlock, Key } from "lucide-react";
import { motion } from "framer-motion";
import { useAlert, useEncryption } from "../App";
import * as API from "../services/api";

const EncryptionDecryption = () => {
  const [file, setFile] = useState(null);
  const [ipfsCid, setIpfsCid] = useState("");
  const [fetchingFromIpfs, setFetchingFromIpfs] = useState(false);
  const alert = useAlert();
  const navigate = useNavigate();
  const enc = useEncryption();

  const handleFile = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setIpfsCid(""); // Clear CID when file is selected
  };

  const handleFetchFromIpfs = async () => {
    if (!ipfsCid.trim()) return alert.error("Please enter an IPFS CID");
    
    setFetchingFromIpfs(true);
    try {
      const response = await fetch(`http://localhost:5010/ipfs/fetch/${ipfsCid.trim()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch file from IPFS");
      }
      
      const blob = await response.blob();
      // Use X-Decrypted-Filename if available (has .bwc and encrypted_ prefix removed)
      const cleanFileName = response.headers.get("X-Decrypted-Filename");
      const encryptedFileName = response.headers.get("X-Original-Filename") || "encrypted_file";
      const fileName = cleanFileName || encryptedFileName;
      
      // Create file with the encrypted name so backend can extract original
      const file = new File([blob], encryptedFileName, { type: "application/octet-stream" });
      
      setFile(file);
      alert.success(`Fetched from IPFS: ${cleanFileName || encryptedFileName}`);
    } catch (error) {
      alert.error(error.message || "Failed to fetch from IPFS");
    } finally {
      setFetchingFromIpfs(false);
    }
  };

  const handleStart = async () => {
    if (!file) return alert.error("Please select a file");

    // Read file as data URL and navigate to processing page with state
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Set encryption context
      enc.setUploadedFileName(file.name);
      enc.setIsProcessing(true);
      enc.setProgress(0);
      enc.setResultUrl(null);
      
      // Navigate to process page with decrypt mode
      navigate("/encryption/process", {
        state: { fileName: file.name, fileData: dataUrl, mode: "decrypt" },
      });
    };
    reader.onerror = () => {
      alert.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const layerCards = [
    {
      icon: Unlock,
      emoji: "🔓",
      title: "Brainwave Reversal",
      description: "Reverses cognitive signal encryption to restore original keys.",
      color: "from-orange-500/20 to-orange-400/20",
      iconColor: "text-orange-400",
    },
    {
      icon: Shield,
      emoji: "🛡️",
      title: "PQC Decryption",
      description: "Quantum-safe decryption layer removes post-quantum protection.",
      color: "from-orange-400/20 to-amber-500/20",
      iconColor: "text-orange-500",
    },
    {
      icon: Key,
      emoji: "🔑",
      title: "Time Restoration",
      description: "Reverses temporal encryption shifts to recover original data.",
      color: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Dark overlay matching landing page */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30 pointer-events-none" />

      {/* Hero Section */}
      <div className="w-full max-w-6xl px-6 py-12 relative z-10">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.h1
            className="text-5xl md:text-6xl font-bold mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              SYNTOM Decrypt
            </span>
          </motion.h1>
          
          <motion.p
            className="text-xl md:text-2xl text-gray-300 font-light mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Reverse Multi-Layer Decryption
          </motion.p>
          
          <motion.p
            className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Safely decrypt files protected by SYNTOM's multi-layer security system.
            The decryption process reverses brainwave mapping, post-quantum protection,
            and temporal encryption in the correct sequence.
          </motion.p>
        </motion.div>

        {/* Layer Info Cards */}
        <motion.div
          className="grid md:grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          {layerCards.map((layer, idx) => (
            <motion.div
              key={layer.title}
              className={`bg-gradient-to-br ${layer.color} backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:border-gray-600 transition-colors duration-200`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 + idx * 0.15 }}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`text-3xl ${layer.iconColor}`}>
                    <layer.icon size={32} />
                  </div>
                  <span className="text-3xl">{layer.emoji}</span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  {layer.title}
                </h3>
                
                <p className="text-sm text-gray-400 leading-relaxed">
                  {layer.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Upload Section */}
        <motion.div
          className="max-w-2xl mx-auto bg-gray-900/90 backdrop-blur-sm rounded-xl p-8 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-center text-orange-500">
            Decrypt Protected File
          </h2>

          <p className="text-sm text-gray-300 mb-6 text-center">
            Upload an encrypted file to begin the multi-layer decryption process. 
            The system will reverse each security layer in the correct sequence.
          </p>

          <div className="space-y-4">
            <div className="flex gap-2 items-center justify-center">
              <div className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold">
                Decrypt Mode
              </div>
            </div>

            {/* IPFS CID Input Section */}
            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm0 2.5L20.177 7.5v9L12 21.5 3.823 16.5v-9L12 2.5z"/>
                </svg>
                <span className="text-sm font-semibold text-gray-300">Or fetch from IPFS Cloud</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ipfsCid}
                  onChange={(e) => {
                    setIpfsCid(e.target.value);
                    if (e.target.value) setFile(null); // Clear file when CID is entered
                  }}
                  placeholder="Paste IPFS CID (e.g., bafkreih...)"
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-purple-500 placeholder-gray-500"
                  disabled={fetchingFromIpfs}
                />
                <motion.button
                  onClick={handleFetchFromIpfs}
                  disabled={!ipfsCid.trim() || fetchingFromIpfs}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors flex items-center gap-2"
                  whileHover={ipfsCid.trim() && !fetchingFromIpfs ? { scale: 1.02 } : {}}
                  whileTap={ipfsCid.trim() && !fetchingFromIpfs ? { scale: 0.98 } : {}}
                >
                  {fetchingFromIpfs ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Fetch</span>
                    </>
                  )}
                </motion.button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enter the IPFS CID to automatically download your encrypted file from the cloud
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <label className="w-full">
                <div className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-orange-500 transition-colors duration-200 bg-gray-900/30">
                  <div className="text-center">
                    <Unlock className="mx-auto text-orange-400 mb-2" size={40} />
                    <p className="text-sm text-gray-300 font-medium">
                      {file ? (
                        <span className="text-orange-400">✓ {file.name}</span>
                      ) : (
                        "Click to select encrypted file or drag & drop"
                      )}
                    </p>
                    {!file && (
                      <p className="text-xs text-gray-500 mt-1">Upload local encrypted file</p>
                    )}
                  </div>
                </div>
                <input 
                  type="file" 
                  onChange={handleFile} 
                  className="hidden" 
                />
              </label>

              <div className="flex items-center gap-3 w-full justify-center">
                <motion.button
                  onClick={handleStart}
                  disabled={!file}
                  className="px-8 py-3 bg-orange-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
                  whileHover={file ? { scale: 1.02 } : {}}
                  whileTap={file ? { scale: 0.98 } : {}}
                >
                  <Unlock size={20} /> 
                  <span>Start Decryption</span>
                </motion.button>

                <motion.button
                  onClick={() => {
                    setFile(null);
                    alert.info("Cleared selection");
                  }}
                  className="px-5 py-3 bg-gray-800 text-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors border border-gray-700"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Download size={18} /> Clear
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EncryptionDecryption;
