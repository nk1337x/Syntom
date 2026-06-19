import { useState, useEffect, createContext, useContext } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle, XCircle, InfoIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/common/Sidebar";
import LandingPage from "./pages/LandingPage";
import EncryptionUpload from "./pages/EncryptionUpload";
import EncryptionProcess from "./pages/EncryptionProcess";
import EncryptionResult from "./pages/EncryptionResult";
import EncryptionDecryption from "./pages/EncryptionDecryption";
import HistoryLogs from "./pages/HistoryLogs";
import { Navigate } from "react-router-dom";
import GalaxyBackground from "./components/GalaxyBackground";

// Create Alert Context
export const AlertContext = createContext(null);

// Encryption context: tracks upload/processing/result state for sidebar and pages
export const EncryptionContext = createContext(null);

export const useEncryption = () => {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error("useEncryption must be used within EncryptionProvider");
  return ctx;
};

// Enhanced Alert types and their corresponding styles
const ALERT_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: "bg-green-500 bg-opacity-20",
    textColor: "text-green-400",
    borderColor: "border-green-500",
    accentColor: "from-green-500 to-green-600",
    iconColor: "text-green-400",
  },
  error: {
    icon: XCircle,
    bgColor: "bg-red-500 bg-opacity-20",
    textColor: "text-red-400",
    borderColor: "border-red-500",
    accentColor: "from-red-500 to-red-600",
    iconColor: "text-red-400",
  },
  warning: {
    icon: AlertCircle,
    bgColor: "bg-amber-500 bg-opacity-20",
    textColor: "text-amber-400",
    borderColor: "border-amber-500",
    accentColor: "from-amber-500 to-amber-600",
    iconColor: "text-amber-400",
  },
  info: {
    icon: InfoIcon,
    bgColor: "bg-blue-500 bg-opacity-20",
    textColor: "text-blue-400",
    borderColor: "border-blue-500",
    accentColor: "from-blue-500 to-blue-600",
    iconColor: "text-blue-400",
  },
};

// Alert Provider Component
const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  // Show alert function
  const showAlert = (message, type = "info", duration = 5000) => {
    const id = Date.now();
    const newAlert = { id, message, type, duration };
    setAlerts((prev) => [...prev, newAlert]);

    // Auto dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissAlert(id);
      }, duration);
    }

    return id;
  };

  // Dismiss alert function
  const dismissAlert = (id) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, isExiting: true } : alert
      )
    );

    // Remove from state after animation completes
    setTimeout(() => {
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, 300);
  };

  // Alert Context Value
  const alertContextValue = {
    alerts,
    showAlert,
    dismissAlert,
    success: (message, duration) => showAlert(message, "success", duration),
    error: (message, duration) => showAlert(message, "error", duration),
    warning: (message, duration) => showAlert(message, "warning", duration),
    info: (message, duration) => showAlert(message, "info", duration),
  };

  // Override the native alert on mount
  useEffect(() => {
    // Store the original alert function
    const originalAlert = window.alert;

    // Override the alert function
    window.alert = (message) => {
      // Determine type based on message content
      let type = "info";
      if (message && typeof message === "string") {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("error") || lowerMsg.includes("fail")) {
          type = "error";
        } else if (lowerMsg.includes("success")) {
          type = "success";
        } else if (lowerMsg.includes("warn") || lowerMsg.includes("please")) {
          type = "warning";
        }
      }

      // Show our custom alert
      showAlert(message, type);
    };

    // Restore the original alert function on unmount
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return (
    <AlertContext.Provider value={alertContextValue}>
      {children}
      <AlertContainer alerts={alerts} dismiss={dismissAlert} />
    </AlertContext.Provider>
  );
};

// Encryption provider to share upload/processing/result state across the app
const EncryptionProvider = ({ children }) => {
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const [kRoot, setKRoot] = useState(null);  // NEW: K_root from braided key exchange
  const [sessionId, setSessionId] = useState(null);  // NEW: Session ID for braided exchange

  const reset = () => {
    setUploadedFileName(null);
    setIsProcessing(false);
    setProgress(0);
    if (resultUrl) {
      try {
        URL.revokeObjectURL(resultUrl);
      } catch (e) {}
    }
    setResultUrl(null);

  };

  const value = {
    uploadedFileName,
    setUploadedFileName,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    resultUrl,
    setResultUrl,
    kRoot,
    setKRoot,
    sessionId,
    setSessionId,
    reset,
  };

  return (
    <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>
  );
};

// Alert Container Component
const AlertContainer = ({ alerts, dismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-md pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            alert={alert}
            dismiss={() => dismiss(alert.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Enhanced Individual Alert Component
const Alert = ({ alert, dismiss }) => {
  const {
    icon: Icon,
    bgColor,
    textColor,
    borderColor,
    accentColor,
    iconColor,
  } = ALERT_TYPES[alert.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pointer-events-auto"
    >
      <div
        className={`
          flex items-center w-full p-4 rounded-lg
          backdrop-blur-md shadow-xl
          border border-gray-700 ${borderColor}
          ${bgColor} overflow-hidden relative
        `}
      >
        {/* Accent color bar */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accentColor}`}
        ></div>

        {/* Icon with animated glow effect */}
        <div
          className={`flex-shrink-0 mr-3 p-2 rounded-full bg-gray-800 bg-opacity-50 ${iconColor}`}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Icon size={18} />
          </motion.div>
        </div>

        {/* Alert message */}
        <div className={`flex-grow text-sm font-medium ${textColor}`}>
          {alert.message}
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity bg-gray-800 bg-opacity-50 rounded-full p-1"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>
    </motion.div>
  );
};

// Hook to use alerts
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

function AppContent() {  
  const location = useLocation();
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    // Remove the animation after 4 seconds
    const timer = setTimeout(() => setShowAnimation(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
        <div className="flex h-screen bg-transparent text-gray-100 overflow-hidden relative">
        
        <AnimatePresence>
          {showAnimation ? (
            <motion.div
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-center w-full h-full bg-transparent text-gray-200 relative z-10"
            >
              <div className="text-center">
                {/* Logo */}
                <motion.img
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  src="/unisys_logo.png" // Logo
                  alt="Syntom"
                  className="w-25 h-12 mx-auto mb-5"
                />
                {/* Glowing Text */}
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="text-5xl font-heading font-bold mb-7 text-white"
                >
                  Syntom
                </motion.h1>
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.8 }}
                  className="text-2xl font-heading font-semibold text-green-300"
                >
                  Neurowave Cryption using Quantum Anyonic Time-Dilated Key Exchange
                </motion.h2>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="main-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex w-full"
            >
              {/* Sidebar - always visible */}
              <Sidebar />

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/landing" replace />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/encryption" element={<EncryptionUpload />} />
                  <Route path="/encryption/process" element={<EncryptionProcess />} />
                  <Route path="/encryption/result" element={<EncryptionResult />} />
                  <Route path="/encryption/decrypt" element={<EncryptionDecryption />} />
                  <Route path="/history" element={<HistoryLogs />} />
                </Routes>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
  );
}

function App() {
  return (
    <AlertProvider>
      <EncryptionProvider>
        {/* Galaxy Background Animation - Always visible */}
        <GalaxyBackground />
        <AppContent />
      </EncryptionProvider>
    </AlertProvider>
  );
}

export default App;
