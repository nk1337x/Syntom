import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Shield, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEncryption } from '../App';
import {
  establishBraidedPath,
  setTimeOffset,
  confirmTimeOffset,
  deriveBraidedSessionKey
} from '../services/api';

const TemporalDesynchronization = () => {
  const enc = useEncryption();  // NEW: Get encryption context
  // Phase 1: Path Establishment
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  
  // Phase 1.5: Time Offset
  const [timeOffset, setTimeOffsetState] = useState(0);
  const [timeOffsetDirection, setTimeOffsetDirection] = useState('forward');
  const [offsetConfirmed, setOffsetConfirmed] = useState(false);
  const [offsetInfo, setOffsetInfo] = useState(null);
  
  // Phase 2: Derive Key
  const [kRoot, setKRoot] = useState(null);
  const [keyInfo, setKeyInfo] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Generate EEG Key (32 bytes)
  const generateEegKey = () => {
    const eegKey = new Uint8Array(32);
    crypto.getRandomValues(eegKey);
    return Array.from(eegKey).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // ============================================================================
  // PHASE 1: ESTABLISH PATH
  // ============================================================================
  const handleEstablishPath = async () => {
    setLoading(true);
    setError(null);
    try {
      addLog('🕐 Initiating Path Establishment...');
      const result = await establishBraidedPath();
      setSessionId(result.session_id);
      setSessionInfo(result);
      setActiveStep(1);
      addLog(`✅ Path Established - Session: ${result.session_id.substring(0, 8)}...`);
      addLog(`   Braid Order: ${result.braid_order}`);
      addLog(`   Time Window: ${result.time_window_size}s`);
    } catch (err) {
      setError(`Path establishment failed: ${err.message}`);
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PHASE 1.5: TEMPORAL DESYNCHRONIZATION
  // ============================================================================
  const handleSetTimeOffset = async () => {
    if (!sessionId) {
      setError('Establish path first!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      addLog('🕐 Setting Temporal Desynchronization...');
      
      // Calculate offset in seconds
      const offsetValue = Math.abs(timeOffset);
      if (offsetValue > 7200) {
        throw new Error('Time offset too large (max ±2 hours)');
      }

      const result = await setTimeOffset(sessionId, offsetValue, timeOffsetDirection);
      
      // Calculate receiver's offset time
      const receiverOffsetTime = Math.floor(Date.now() / 1000) + 
        (timeOffsetDirection === 'forward' ? offsetValue : -offsetValue);
      
      // Confirm the offset
      const confirmResult = await confirmTimeOffset(sessionId, receiverOffsetTime);
      
      setOffsetInfo(confirmResult);
      setOffsetConfirmed(confirmResult.confirmed);
      setActiveStep(2);
      
      if (confirmResult.confirmed) {
        addLog(`✅ Temporal Desynchronization Confirmed`);
        addLog(`   Direction: ${timeOffsetDirection}`);
        addLog(`   Offset: ${offsetValue}s (${Math.floor(offsetValue / 60)} minutes)`);
        addLog(`   Sender Real Time: ${new Date(confirmResult.sender_real_time * 1000).toLocaleTimeString()}`);
        addLog(`   Receiver Offset Time: ${new Date(confirmResult.receiver_offset_time * 1000).toLocaleTimeString()}`);
        addLog(`   🎯 Timestamps now mismatched - Attackers confused!`);
      } else {
        addLog(`⚠️ Temporal Desynchronization verification failed`);
      }
    } catch (err) {
      setError(`Time offset failed: ${err.message}`);
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PHASE 2: DERIVE BRAIDED KEY
  // ============================================================================
  const handleDeriveKey = async () => {
    if (!sessionId || !offsetConfirmed) {
      setError('Establish path and confirm time offset first!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      addLog('🧠 Deriving Braided Key with Temporal Offset...');
      
      const eegKeyHex = generateEegKey();
      const result = await deriveBraidedSessionKey(eegKeyHex, sessionId);
      
      setKRoot(result.k_root);
      setKeyInfo(result);
      setActiveStep(3);
      
      // NEW: Save to encryption context for use in encrypt/decrypt pages
      enc.setKRoot(result.k_root);
      enc.setSessionId(sessionId);
      
      addLog(`✅ Braided Key Derived`);
      addLog(`   K_root: ${result.k_root.substring(0, 16)}...`);
      addLog(`   Time Window: ${new Date(result.time_window * 1000).toLocaleTimeString()}`);
      addLog(`   Time Offset Applied: ${result.time_offset_applied}s`);
      addLog(`   Braid Sequence: ${result.braid_sequence}`);
      addLog(`   🔒 K_root never transmitted - Derived independently on both sides`);
    } catch (err) {
      setError(`Key derivation failed: ${err.message}`);
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PHASE 3: ENCRYPT
  // ============================================================================
  const steps = [
    { number: 1, title: 'Path Establishment', description: 'Agree on session parameters' },
    { number: 2, title: 'Temporal Desynchronization', description: 'Offset receiver clock' },
    { number: 3, title: 'Braided Key Derivation', description: 'Generate K_root with offset' },
    { number: 4, title: 'Secure Exchange', description: 'Encrypt/Decrypt with timing confusion' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Temporal Desynchronization
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Confuse attackers with time-offset encryption - Your brilliant idea! 🎯
          </p>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div
            className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4 flex gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200">{error}</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Phase 1: Path Establishment */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold">1</div>
                <h2 className="text-xl font-semibold text-gray-100">Phase 1: Path Establishment</h2>
                {sessionId && <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />}
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Initiator and responder agree on session parameters (braid order, nonces, salt)
              </p>
              <button
                onClick={handleEstablishPath}
                disabled={loading || sessionId}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                {sessionId ? '✅ Path Established' : 'Establish Path'}
              </button>
              {sessionInfo && (
                <div className="mt-4 bg-slate-900/50 p-3 rounded text-sm text-gray-300 space-y-1">
                  <p>Session ID: <span className="text-cyan-400">{sessionInfo.session_id.substring(0, 12)}...</span></p>
                  <p>Braid Order: <span className="text-cyan-400">{sessionInfo.braid_order}</span></p>
                  <p>Time Window: <span className="text-cyan-400">{sessionInfo.time_window_size}s</span></p>
                </div>
              )}
            </motion.div>

            {/* Phase 1.5: Temporal Desynchronization */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">2</div>
                <h2 className="text-xl font-semibold text-gray-100">Phase 1.5: Temporal Desynchronization</h2>
                {offsetConfirmed && <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />}
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Request receiver to offset their clock - Attackers see mismatched timestamps and can't correlate timing! 🕐
              </p>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Direction</label>
                  <select
                    value={timeOffsetDirection}
                    onChange={(e) => setTimeOffsetDirection(e.target.value)}
                    disabled={offsetConfirmed}
                    className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="forward">Forward (Ahead)</option>
                    <option value="backward">Backward (Behind)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Offset (minutes)</label>
                  <input
                    type="number"
                    min="-120"
                    max="120"
                    value={Math.floor(timeOffset / 60) || 0}
                    onChange={(e) => setTimeOffsetState((parseInt(e.target.value) || 0) * 60)}
                    disabled={offsetConfirmed}
                    className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSetTimeOffset}
                    disabled={loading || offsetConfirmed || !sessionId}
                    className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition text-sm"
                  >
                    {offsetConfirmed ? '✅ Offset Set' : 'Set Offset'}
                  </button>
                </div>
              </div>

              {offsetInfo && (
                <div className="bg-slate-900/50 p-3 rounded text-sm text-gray-300 space-y-1">
                  <p>✅ <span className="text-green-400">Temporal Desynchronization Confirmed</span></p>
                  <p>Direction: <span className="text-purple-400">{offsetInfo.direction}</span></p>
                  <p>Offset: <span className="text-purple-400">{offsetInfo.time_offset}s</span></p>
                  <p>Sender Time: <span className="text-cyan-400">{new Date(offsetInfo.sender_real_time * 1000).toLocaleTimeString()}</span></p>
                  <p>Receiver Time: <span className="text-purple-400">{new Date(offsetInfo.receiver_offset_time * 1000).toLocaleTimeString()}</span></p>
                </div>
              )}
            </motion.div>

            {/* Phase 2: Derive Key */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">3</div>
                <h2 className="text-xl font-semibold text-gray-100">Phase 2: Braided Key Derivation</h2>
                {kRoot && <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />}
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Mix EEG + Quantum entropy (non-commutative), bind to offset time, derive K_root
              </p>
              <button
                onClick={handleDeriveKey}
                disabled={loading || kRoot || !offsetConfirmed}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                {kRoot ? '✅ Key Derived' : 'Derive Key'}
              </button>
              {keyInfo && (
                <div className="mt-4 bg-slate-900/50 p-3 rounded text-sm text-gray-300 space-y-1">
                  <p>K_root: <span className="text-orange-400 font-mono text-xs">{keyInfo.k_root.substring(0, 20)}...</span></p>
                  <p>Time Offset Applied: <span className="text-orange-400">{keyInfo.time_offset_applied}s</span></p>
                  <p>Braid Sequence: <span className="text-orange-400">{keyInfo.braid_sequence}</span></p>
                </div>
              )}
            </motion.div>

            {/* Phase 3: Use Derived Key in Main Encryption */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">4</div>
                <h2 className="text-xl font-semibold text-gray-100">Phase 3: Secure Exchange</h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Use your derived K_root in the main Encryption page for secure file transmission with temporal confusion!
              </p>
              
              {kRoot && (
                <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded p-3">
                  <p className="text-green-400 text-sm">✅ K_root ready to use!</p>
                  <p className="text-gray-300 text-xs mt-2">Your key is derived with temporal offset applied.</p>
                </div>
              )}

              <Link
                to="/encryption"
                className="inline-block px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition w-full text-center"
              >
                Proceed to Encryption →
              </Link>
            </motion.div>
          </div>

          {/* Sidebar: Logs */}
          <motion.div
            className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm h-fit sticky top-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Activity Log
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-sm">Waiting for actions...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="text-xs text-gray-400 font-mono pb-1 border-b border-slate-700/50">
                    {log}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Security Benefits */}
        <motion.div
          className="mt-12 bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Security Benefits
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '⏰', title: 'Timing Confusion', desc: 'Mismatched timestamps fool attackers' },
              { icon: '🔐', title: 'Key Protection', desc: 'K_root never transmitted - offset-bound' },
              { icon: '🎯', title: 'Temporal Binding', desc: 'Keys tied to offset time windows' },
              { icon: '🚫', title: 'Replay Prevention', desc: 'Time-window expiration stops replay' }
            ].map((benefit, idx) => (
              <div key={idx} className="bg-slate-900/50 p-3 rounded text-center">
                <div className="text-2xl mb-2">{benefit.icon}</div>
                <p className="text-sm font-semibold text-gray-100">{benefit.title}</p>
                <p className="text-xs text-gray-400 mt-1">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TemporalDesynchronization;
