import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Download, Brain, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAlert, useEncryption } from "../App";
import * as API from "../services/api";

const EncryptionUpload = () => {
  // This page is encryption-only (always use 'encrypt' mode)
  const [file, setFile] = useState(null);
  const alert = useAlert();
  const navigate = useNavigate();
  const enc = useEncryption();

  const handleFile = (e) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) {
      alert.error("Please select a file to upload");
      return;
    }

    // Read file as data URL and navigate to processing page with state
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      // set encryption context so sidebar blooms
      enc.setUploadedFileName(file.name);
      enc.setIsProcessing(true);
      enc.setProgress(0);
      enc.setResultUrl(null);
      
      // Always navigate to process page - it will handle backend encryption
      navigate("/encryption/process", {
        state: { fileName: file.name, fileData: dataUrl, mode: "encrypt" },
      });
    };
    reader.onerror = () => {
      alert.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  };
  // class for the single Encrypt button
  const encryptClass = "px-3 py-2 rounded-md cursor-pointer bg-gradient-to-r from-[#00E68F] to-[#007F5E] text-black font-semibold";

  const layerCards = [
    {
      icon: Brain,
      emoji: "🧠",
      title: "Brainwave Layer",
      description: "Uses cognitive signal mapping for unique encryption keys.",
      color: "from-[#00E68F]/20 to-[#00B378]/20",
      iconColor: "text-[#00E68F]",
    },
    {
      icon: Shield,
      emoji: "🧩",
      title: "PQC Layer",
      description: "Protects against quantum-level attacks.",
      color: "from-[#00B378]/20 to-[#007F5E]/20",
      iconColor: "text-[#00B378]",
    },
    {
      icon: Clock,
      emoji: "⏳",
      title: "Time Dilation Layer",
      description: "Dynamically shifts encryption over time to prevent replay attacks.",
      color: "from-[#007F5E]/20 to-[#00E68F]/20",
      iconColor: "text-[#00E68F]",
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
            <span className="bg-gradient-to-r from-[#00E68F] via-[#00B378] to-[#007F5E] bg-clip-text text-transparent">
              SYNTOM
            </span>
          </motion.h1>
          
          <motion.p
            className="text-xl md:text-2xl text-gray-300 font-light mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Neurowave Cryption using Quantum Anyonic Time-Dilated Key Exchange
          </motion.p>
          
          <motion.p
            className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Advanced multi-layer security combining brainwave biometric mapping, post-quantum cryptography,
            anyonic braiding, and temporal key expiration to create an unprecedented level of data protection.
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
              className={`relative bg-gradient-to-br ${layer.color} backdrop-blur-sm border border-gray-700/40 rounded-xl p-6 group hover:border-gray-600/60 transition-all duration-300`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 + idx * 0.15 }}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#00E68F]/0 to-[#00E68F]/0 group-hover:from-[#00E68F]/5 group-hover:to-transparent rounded-xl transition-all duration-300" />
              
              <div className="relative z-10">
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

        {/* Upload Section - Enhanced with green theme */}
        <motion.div
          className="max-w-2xl mx-auto bg-gray-900/90 backdrop-blur-sm rounded-xl p-8 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-center text-[#00E68F]">
            Quantum-Brain Encryption
          </h2>

          <p className="text-sm text-gray-300 mb-6 text-center">
            Upload a file to begin the multi-layer encryption process. 
            Watch as each layer processes your data with advanced security algorithms.
          </p>

          <div className="space-y-4">
            <div className="flex gap-2 items-center justify-center">
              <div className="px-4 py-2 rounded-lg bg-[#00E68F] text-black font-semibold">
                Encrypt Mode
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <label className="w-full">
                <div className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-[#00E68F] transition-colors duration-200 bg-gray-900/30">
                  <div className="text-center">
                    <UploadCloud className="mx-auto text-[#00E68F] mb-2" size={40} />
                    <p className="text-sm text-gray-300 font-medium">
                      {file ? (
                        <span className="text-[#00E68F]">✓ {file.name}</span>
                      ) : (
                        "Click to select file or drag & drop"
                      )}
                    </p>
                    {!file && (
                      <p className="text-xs text-gray-500 mt-1">Any file type supported</p>
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
                  onClick={handleUpload}
                  disabled={!file}
                  className="px-8 py-3 bg-[#00E68F] text-black rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00B378] transition-colors"
                  whileHover={file ? { scale: 1.02 } : {}}
                  whileTap={file ? { scale: 0.98 } : {}}
                >
                  <UploadCloud size={20} /> 
                  <span>Upload & Encrypt</span>
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

export default EncryptionUpload;
