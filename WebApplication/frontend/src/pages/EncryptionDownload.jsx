import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAlert, useEncryption } from "../App";

const EncryptionDownload = () => {
  const enc = useEncryption();
  const navigate = useNavigate();
  const alert = useAlert();

  useEffect(() => {
    if (!enc.resultUrl) {
      // nothing to download yet
      // don't redirect immediately; show message and a button — but here we redirect after short delay
    }
  }, [enc.resultUrl]);

  const handleDownload = () => {
    if (!enc.resultUrl) {
      alert.error("No processed file available yet.");
      return;
    }
    const a = document.createElement("a");
    a.href = enc.resultUrl;
    a.download = `processed-${enc.uploadedFileName ?? "file"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    alert.success("Download started");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/60 border border-gray-700 rounded-lg p-8 w-full max-w-xl text-center"
      >
        <h2 className="text-2xl font-semibold">Download</h2>
        <p className="text-sm text-gray-300 mt-2">
          {enc.uploadedFileName
            ? `${enc.uploadedFileName} — processed file status: ${enc.resultUrl ? 'Ready' : 'Pending'}`
            : 'No file uploaded yet.'}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={handleDownload}
            className={`px-4 py-2 rounded-md ${enc.resultUrl ? 'bg-gradient-to-r from-[#00E68F] to-[#007F5E] text-black' : 'bg-gray-800/30 text-gray-500 cursor-not-allowed'}`}
            disabled={!enc.resultUrl}
          >
            Download Encrypted File
          </button>

          <button
            onClick={() => navigate('/encryption')}
            className="px-3 py-2 bg-gray-800/40 text-gray-200 rounded-md"
          >
            Upload New
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EncryptionDownload;
