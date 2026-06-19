import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, Cpu, Activity, Loader2, Zap } from "lucide-react";
import { useAlert, useEncryption } from "../App";
import * as API from "../services/api";

const getSteps = (mode) => {
  const isDecrypt = mode === 'decrypt';
  return [
    { key: "brain", title: isDecrypt ? "Brainwave Reversal" : "Brainwave Layer", emoji: "🧠", icon: Activity, ms: 1200, color: "from-[#00E68F] to-[#00B378]" },
    { key: "pqc", title: isDecrypt ? "PQC Decryption" : "PQC Layer", emoji: "🧩", icon: Cpu, ms: 1400, color: "from-[#00B378] to-[#007F5E]" },
    { key: "dilation", title: isDecrypt ? "Time Restoration" : "Time Dilation Layer", emoji: "⏱", icon: Clock, ms: 1000, color: "from-[#007F5E] to-[#00E68F]" },
  ];
};

const EncryptionProcess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const [current, setCurrent] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const runningRef = useRef(false);
  const historySavedRef = useRef(false); // Track if history already saved
  const alertShownRef = useRef(false); // Track if alert already shown
  const enc = useEncryption();

  const state = location.state ?? null;
  const steps = getSteps(state?.mode || 'encrypt');
  
  // Function to save log to localStorage
  const saveToHistory = (fileName, operation, fileSize, status = 'success') => {
    // Prevent duplicate saves
    if (historySavedRef.current) {
      console.log('History already saved, skipping duplicate');
      return;
    }
    
    historySavedRef.current = true;
    
    const historyLog = {
      id: Date.now(),
      fileName: fileName,
      operation: operation, // 'encrypt' or 'decrypt'
      timestamp: new Date().toISOString(),
      fileSize: fileSize,
      fileType: fileName.split('.').pop(),
      status: status,
      layers: ['brain', 'pqc', 'dilation'],
      sessionId: enc.sessionId || null
    };

    // Get existing logs
    const existingLogs = localStorage.getItem('encryptionLogs');
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    
    // Check if this exact operation was just logged (within last 2 seconds)
    const now = new Date().getTime();
    const recentDuplicate = logs.find(log => 
      log.fileName === fileName && 
      log.operation === operation &&
      (now - new Date(log.timestamp).getTime()) < 2000
    );
    
    if (recentDuplicate) {
      console.log('Duplicate log detected, skipping');
      return;
    }
    
    // Add new log
    logs.unshift(historyLog);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.splice(100);
    }
    
    // Save to localStorage
    localStorage.setItem('encryptionLogs', JSON.stringify(logs));
  };
  
  useEffect(() => {
    if (!state || !state.fileData) {
      // Show idle state - no processing
      return;
    }

    // Start backend processing
    const processFile = async () => {
      let total = steps.reduce((s, st) => s + st.ms, 0);
      let elapsed = 0;
      runningRef.current = true;
      enc.setIsProcessing(true);
      enc.setProgress(0);

      const runStep = (i) => {
        if (!runningRef.current) return;
        setCurrent(i);
        const step = steps[i];
        setLogs((l) => [...l, `${step.title} started`]);

        const stepInterval = 100;
        let stepElapsed = 0;
        const t = setInterval(() => {
          stepElapsed += stepInterval;
          elapsed += stepInterval;
          const p = Math.min(100, Math.round((elapsed / total) * 100));
          setProgress(p);
          enc.setProgress(p);
          if (stepElapsed >= step.ms) {
            clearInterval(t);
            setLogs((l) => [...l, `${step.title} completed`]);
            if (i + 1 < steps.length) runStep(i + 1);
            else finish();
          }
        }, stepInterval);
      };

      const finish = async () => {
        setCurrent(steps.length);
        setProgress(100);
        enc.setProgress(100);
        setLogs((l) => [...l, `All layers completed`]);
        
        try {
          // Convert dataURL to file for backend processing
          fetch(state.fileData)
            .then((r) => r.blob())
            .then(async (blob) => {
              const file = new File([blob], state.fileName || "file", { type: blob.type });
              
              // Call backend encryption or decryption based on mode
              try {
                const isDecrypting = state.mode === "decrypt";
                const options = { 
                  mode: state.mode || "encrypt"
                };
                if (enc.kRoot && enc.sessionId) {
                  console.log(`Using braided key for ${isDecrypting ? 'decryption' : 'encryption'}:`, enc.sessionId);
                  options.eeg_key = enc.kRoot;
                  options.session_id = enc.sessionId;
                  if (!isDecrypting) {
                    options.k_root = enc.kRoot;  // Pass K_root directly for encryption
                  }
                }
                
                const result = isDecrypting ? 
                  await API.decryptFile(file, options) : 
                  await API.encryptFile(file, options);
                
                // Handle decryption result (returns {blob, filename})
                const resultBlob = isDecrypting ? result.blob : result;
                const resultFilename = isDecrypting ? result.filename : null;
                
                // Save to history
                saveToHistory(state.fileName, state.mode || 'encrypt', file.size, 'success');
                
                const url = URL.createObjectURL(resultBlob);
                enc.setResultUrl(url);
                
                // Set the decrypted filename if available
                if (resultFilename) {
                  enc.setUploadedFileName(resultFilename);
                }
                
                enc.setIsProcessing(false);
                setLogs((l) => [...l, `Backend ${isDecrypting ? 'decryption' : 'encryption'} completed`]);
                
                // Show success notification only once
                if (!alertShownRef.current) {
                  alertShownRef.current = true;
                  alert.success(`${isDecrypting ? 'Decryption' : 'Encryption'} completed successfully!`);
                }
                
                navigate('/encryption/result', { 
                  state: { 
                    fileName: state.fileName, 
                    [isDecrypting ? 'decryptedBlob' : 'encryptedBlob']: resultBlob,
                    mode: state.mode 
                  } 
                });
              } catch (error) {
                console.error("Backend error:", error);
                setLogs((l) => [...l, `❌ Backend unavailable: ${error.message}`]);
                
                // Save failed operation to history
                saveToHistory(state.fileName, state.mode || 'encrypt', file.size, 'failed');
                
                enc.setIsProcessing(false);
                alert.error("Backend server not running. Please start the backend to encrypt/decrypt files.");
                setTimeout(() => navigate('/encryption', { replace: true }), 2000);
              }
            });
        } catch (err) {
          console.error(err);
          alert.error("Failed to produce output file");
          enc.setIsProcessing(false);
        }
      };

      // small delay to let UI render nicely
      const starter = setTimeout(() => runStep(0), 300);

      return () => {
        runningRef.current = false;
        clearTimeout(starter);
      };
    };

    processFile();
  }, []);

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `processed-${state.fileName ?? "file"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Render UI
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Dark overlay matching landing page */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30 pointer-events-none" />
      
      <div className="w-full max-w-4xl relative z-10">
        {/* Header with spinner or idle state */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            {state?.fileData ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="text-[#00E68F]" size={32} />
              </motion.div>
            ) : (
              <Activity className="text-gray-500" size={32} />
            )}
            <h2 className="text-3xl font-bold">
              {state?.fileData ? "Processing Your File" : "Process Page"}
            </h2>
          </div>
          <p className="text-gray-400">
            {state?.fileName || "Upload a file to begin processing"}
          </p>
        </motion.div>

        {/* Encryption Layer Progress UI */}
        <motion.div
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl p-8 mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-6">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === current;
              const done = idx < current;
              const isPending = idx > current;
              const stepPercent = done ? 100 : isActive ? Math.min(100, progress) : 0;
              
              return (
                <motion.div
                  key={s.key}
                  className={`relative bg-gray-900/30 rounded-xl p-5 border transition-all duration-500 ${
                    isActive
                      ? "border-[#00E68F]/60 shadow-lg shadow-[#00E68F]/10"
                      : done
                      ? "border-green-500/40"
                      : "border-gray-700/40"
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                >
                  {/* Glow effect for active layer */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-[#00E68F]/5 to-transparent rounded-xl"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  <div className="relative flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 ${
                      done
                        ? "bg-green-500/20 text-green-400"
                        : isActive
                        ? `bg-gradient-to-br ${s.color} bg-opacity-20`
                        : "bg-gray-800/40 text-gray-500"
                    }`}>
                      <AnimatePresence mode="wait">
                        {done ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                          >
                            <CheckCircle size={28} className="text-green-400" />
                          </motion.div>
                        ) : isActive ? (
                          <motion.div
                            key="active"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Zap size={28} className="text-[#00E68F]" />
                          </motion.div>
                        ) : (
                          <span key="emoji">{s.emoji}</span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-100">{s.title}</h3>
                          {isActive && (
                            <motion.span
                              className="text-xs px-2 py-1 bg-[#00E68F]/20 text-[#00E68F] rounded-full"
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              Processing...
                            </motion.span>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${
                          done ? "text-green-400" : isActive ? "text-[#00E68F]" : "text-gray-500"
                        }`}>
                          {done ? "✅ Complete" : isActive ? `${Math.round(stepPercent)}%` : "Pending"}
                        </span>
                      </div>

                      {/* Progress Bar with Glow */}
                      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          className={`absolute inset-0 bg-gradient-to-r ${s.color} rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${stepPercent}%` }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        />
                        {isActive && stepPercent > 0 && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            style={{ width: "50%" }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Overall Progress */}
          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">Overall Progress</span>
              <span className="text-lg font-bold text-[#00E68F]">{progress}%</span>
            </div>
            <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#00E68F] via-cyan-400 to-[#007F5E] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ width: "50%" }}
              />
            </div>
          </div>
        </motion.div>

        {/* Logs Section */}
        <motion.div
          className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/40 rounded-xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-[#00E68F] rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-100">Process Logs</h3>
          </div>
          <div className="text-xs text-gray-300 h-32 overflow-auto bg-gray-950/50 p-3 rounded-lg font-mono space-y-1">
            <AnimatePresence>
              {logs.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="py-0.5 flex items-center gap-2"
                >
                  <span className="text-[#00E68F]">›</span>
                  <span>{l}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EncryptionProcess;
