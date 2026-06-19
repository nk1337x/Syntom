import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Brain, Zap, Activity, Cpu, Clock } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timeDilationRef = useRef(null);
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [currentState, setCurrentState] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const splineAppRef = useRef(null);
  // Refs for smooth animation and robust brain lookup
  const brainRef = useRef(null); // cached brain object
  const targetRef = useRef({ x: -100, y: 0, z: -50, rx: 0, ry: 0, rz: 0 });
  const currentRef = useRef({ x: -100, y: 0, z: -50, rx: 0, ry: 0, rz: 0 });

  const brainStates = [
    { name: "Workload", icon: Activity, color: "text-purple-400", bgColor: "bg-purple-500/10" },
    { name: "Error Detection", icon: Cpu, color: "text-red-400", bgColor: "bg-red-500/10" },
    { name: "Focus", icon: Brain, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
    { name: "Intent", icon: Zap, color: "text-green-400", bgColor: "bg-green-500/10" },
  ];

  useEffect(() => {
    const SCENE_URL = 'https://prod.spline.design/qFDyStM8I34dJ80q/scene.splinecode';
    
    const loadSpline = async () => {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@splinetool/runtime@1.9.28/build/runtime.js');
        const Runtime = mod.default ?? mod.Application ?? mod;

        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('Canvas ref not available');
          return;
        }

        console.log('Creating Spline app...');
        const app = new Runtime(canvas);
        splineAppRef.current = app;
        
        console.log('Loading scene:', SCENE_URL);
        await app.load(SCENE_URL);
        
        console.log('Spline scene loaded successfully');

        // Show floating dots/particles around the brain
        // (Particle animation code - no need to hide them)

        // robustly locate and cache the brain object; initialize current transform
        const locateBrain = () => {
          try {
            const brainObject = app.findObjectById?.('c8056fca-2939-4735-bac7-4c625ca87a79')
              || app.findObjectByName?.('Brain')
              || app.findObjectByName?.('brain');

            if (brainObject) {
              brainRef.current = brainObject;
              // populate currentRef from object if available
              try {
                if (brainObject.position) {
                  currentRef.current.x = brainObject.position.x ?? currentRef.current.x;
                  currentRef.current.y = brainObject.position.y ?? currentRef.current.y;
                  currentRef.current.z = brainObject.position.z ?? currentRef.current.z;
                }
                if (brainObject.rotation) {
                  currentRef.current.rx = brainObject.rotation.x ?? currentRef.current.rx;
                  currentRef.current.ry = brainObject.rotation.y ?? currentRef.current.ry;
                  currentRef.current.rz = brainObject.rotation.z ?? currentRef.current.rz;
                }
              } catch (e) {
                // ignore
              }
              console.log('Brain object located and cached');
              return true;
            }
          } catch (e) {
            console.log('Error locating brain:', e);
          }
          return false;
        };

        locateBrain();
        let findAttempts = 0;
        const findInterval = setInterval(() => {
          if (brainRef.current) {
            clearInterval(findInterval);
            return;
          }
          findAttempts += 1;
          if (locateBrain() || findAttempts > 10) {
            clearInterval(findInterval);
          }
        }, 700);

        setSplineLoaded(true);
        
        // Hide Spline watermark after scene loads
        setTimeout(() => {
          const watermarkSelectors = [
            'a[href*="spline.design"]',
            'a[href*="spline"]',
            '[class*="watermark"]',
            '#spline-watermark',
            'canvas + a',
            'canvas ~ a'
          ];
          
          watermarkSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              el.style.display = 'none';
              el.style.visibility = 'hidden';
              el.style.opacity = '0';
              el.remove();
            });
          });
        }, 1000);

        const resize = () => {
          const rect = canvas.parentElement?.getBoundingClientRect();
          if (rect) {
            canvas.width = rect.width;
            canvas.height = rect.height;
          }
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });

        return () => {
          window.removeEventListener('resize', resize);
        };
      } catch (err) {
        console.error('Failed to load Spline runtime or scene:', err);
        setError('Loading brain visualization...');
        setTimeout(() => setError(null), 2000);
      }
    };

    loadSpline();

    // Cycle through brain states
    const stateInterval = setInterval(() => {
      setCurrentState((prev) => (prev + 1) % brainStates.length);
    }, 3000);

    return () => clearInterval(stateInterval);
  }, []);

  // Smooth scroll-to-brain animation using rAF and lerp to avoid stutter/stalls
  useEffect(() => {
    if (!splineLoaded) return;
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothing = 0.12; // lower = snappier, higher = smoother/slower
    let rafId = null;

    const safeContainer = () => containerRef.current || document.scrollingElement || document.documentElement;

    const onScroll = () => {
      const container = safeContainer();
      if (!container) return;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(progress);

      // update target transform based on scroll progress (keeps left shift)
      targetRef.current.x = -100;
      targetRef.current.y = 40 * progress;
      targetRef.current.z = -50 - (progress * 450);
      targetRef.current.rx = -3.15 * progress;
      targetRef.current.ry = 3 * progress;
      targetRef.current.rz = 4.7 * progress;
    };

    // animation loop that lerps current transform -> target and applies to brain object
    const animate = () => {
      try {
        if (brainRef.current) {
          // smooth the values
          currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, smoothing);
          currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, smoothing);
          currentRef.current.z = lerp(currentRef.current.z, targetRef.current.z, smoothing);
          currentRef.current.rx = lerp(currentRef.current.rx, targetRef.current.rx, smoothing);
          currentRef.current.ry = lerp(currentRef.current.ry, targetRef.current.ry, smoothing);
          currentRef.current.rz = lerp(currentRef.current.rz, targetRef.current.rz, smoothing);

          const obj = brainRef.current;
          // apply transforms safely
          if (obj.position) {
            obj.position.x = currentRef.current.x;
            obj.position.y = currentRef.current.y;
            obj.position.z = currentRef.current.z;
          }
          if (obj.rotation) {
            obj.rotation.x = currentRef.current.rx;
            obj.rotation.y = currentRef.current.ry;
            obj.rotation.z = currentRef.current.rz;
          }
        }
      } catch (e) {
        // log but don't break the loop
        // console.debug('animate error', e);
      }
      rafId = window.requestAnimationFrame(animate);
    };

    // attach scroll listener
    const container = safeContainer();
    container && container.addEventListener('scroll', onScroll, { passive: true });

    // initialize targets from current scroll and start animation
    onScroll();
    rafId = window.requestAnimationFrame(animate);

    return () => {
      const c = safeContainer();
      c && c.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [splineLoaded]);

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-auto relative"
      style={{ scrollBehavior: 'auto', backgroundColor: 'transparent' }}
    >
      {/* Spline Brain Container - Fixed background */}
      <div className="fixed inset-0 z-0">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block"
          style={{ 
            display: 'block',
            width: '100%',
            height: '100%',
            touchAction: 'none',
            filter: 'brightness(2.5) contrast(1.2)'
          }}
        />
        
        {/* Overlay to hide watermark in bottom-right corner */}
        <div 
          className="absolute pointer-events-none"
          style={{ 
            bottom: '10px',
            right: '120px',
            width: '160px',
            height: '50px',
            background: '#000000',
            zIndex: 999999,
          }}
        />
        
        {/* Global CSS to hide any Spline watermarks */}
        <style>{`
          a[href*="spline"] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
          }
        `}</style>
        
        {/* Loading state */}
        {!splineLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'transparent' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-[#00E68F] border-t-transparent rounded-full"
            />
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'transparent' }}>
            <div className="text-gray-500 text-sm">{error}</div>
          </div>
        )}
        
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30 pointer-events-none" />
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10">
        {/* Section 1: Title and Initial Content */}
        <div className="min-h-screen pt-8 px-16">
          {/* Title */}
          <div className="text-center mb-20">
            <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-2">
              <span className="block text-[#10ee91]">
                SYNTOM
              </span>
              <span className="block text-2xl md:text-3xl text-gray-200 font-light mt-2">
                Quantum Anyonic Time-Dilated Encryption
              </span>
            </h1>
          </div>

          {/* Two-column layout: Stats on left, Framework card on right */}
          <div className="flex items-stretch justify-between gap-8">
            {/* Left: Live System Stats */}
            <div className="flex-shrink-0 w-80 space-y-6">
              <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/40 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-2 rounded-full bg-[#10ee91] animate-pulse"></div>
                  <h3 className="text-xl font-bold text-white">Live System Stats</h3>
                </div>

                <div className="space-y-4">
                  {/* Encryption Strength */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                      <span className="text-lg">🔐</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Encryption Strength</div>
                      <div className="text-base font-bold text-white">512-bit PQC</div>
                    </div>
                  </div>

                  {/* Neural Entropy */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                      <span className="text-lg">🧠</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Neural Entropy</div>
                      <div className="text-base font-bold text-[#10ee91]">Active</div>
                    </div>
                  </div>

                  {/* Temporal Sync */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <span className="text-lg">⏳</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Temporal Sync</div>
                      <div className="text-base font-bold text-white">Stable</div>
                    </div>
                  </div>

                  {/* Layer Integration */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                      <span className="text-lg">🛰</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Layer Integration</div>
                      <div className="text-base font-bold text-white">98%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Stack Card */}
              <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/40 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Technical Stack</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                    <span className="text-gray-300">Kyber-1024 (PQC)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                    <span className="text-gray-300">Neural Wave Processing</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                    <span className="text-gray-300">AES-256-GCM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <span className="text-gray-300">BLAKE3 Hashing</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                    <span className="text-gray-300">Temporal Key Derivation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: SYNTOM Framework Card */}
            <div className="flex-1 flex items-center justify-end">
              <div className="max-w-md w-full">
                <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/40 rounded-2xl p-10" style={{ minHeight: '32rem' }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">The SYNTOM Framework</h2>
                  <div className="text-sm text-gray-400">Biometric • Quantum-safe • Temporal</div>
                </div>

                <div className="space-y-5 text-sm text-gray-300 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#0f2b2a] border border-[#0f2b2a] flex items-center justify-center">
                      <Brain className="text-[#10ee91] w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Brainwave Encryption</h4>
                      <p className="text-gray-300">Transforms cognitive signal patterns into unique encryption keys that evolve with every interaction.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#061223] border border-[#06323a] flex items-center justify-center">
                      <Lock className="text-[#10ee91] w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Post-Quantum Cryptography</h4>
                      <p className="text-gray-300">Employs lattice-based algorithms and quantum-resistant primitives to ensure future-proof data protection.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#051f12] border border-[#073a25] flex items-center justify-center">
                      <Clock className="text-[#10ee91] w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Time Dilation Layer</h4>
                      <p className="text-gray-300">Applies temporal encryption, synchronizing keys across multiple time frames to make real-time decryption impossible.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <motion.button
                    onClick={() => {
                      const el = timeDilationRef.current;
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="px-5 py-2 bg-[#10ee91] text-black rounded-lg font-bold text-sm shadow-md shadow-[#10ee91]/20 hover:transform hover:-translate-y-0.5 transition"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label="Proceed to Time Dilation"
                  >
                    Proceed
                  </motion.button>

                  <motion.button
                    onClick={() => navigate('/encryption/decrypt')}
                    className="px-5 py-2 bg-gray-800/60 text-gray-100 rounded-lg font-semibold text-sm border border-gray-700/40 hover:bg-gray-800/70 transition"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label="Proceed to decryption"
                  >
                    Proceed
                  </motion.button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Section 2: Three-Layer Architecture Cards */}
        <div ref={timeDilationRef} className="min-h-screen flex items-center justify-center px-16 py-20">
          <div className="max-w-7xl w-full">
            <h2 className="text-4xl font-bold text-center text-white mb-4">
              The Three-Layer Architecture
            </h2>
            <p className="text-center text-gray-400 mb-16 max-w-2xl mx-auto">
              A revolutionary fusion of quantum cryptography, neural encryption, and temporal security
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Layer 1: Quantum Encryption (PQC) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative bg-gradient-to-br from-blue-900/20 to-cyan-900/20 backdrop-blur-lg border border-cyan-500/30 rounded-2xl p-8 hover:border-cyan-400/60 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(34, 211, 238, 0.15)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="w-16 h-16 mb-6 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
                    <Lock className="w-8 h-8 text-cyan-400" />
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-cyan-400 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/30">
                      LAYER 1
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4">Quantum Encryption (PQC)</h3>
                  
                  <p className="text-gray-300 mb-4 leading-relaxed">
                    Post-Quantum Cryptographic algorithms resistant to quantum computer attacks. Utilizing lattice-based and hash-based schemes to ensure long-term security.
                  </p>
                  
                  <ul className="space-y-2 text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><span className="text-white font-medium">512-bit security:</span> Future-proof encryption strength</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Lattice-based:</span> Resistant to quantum attacks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><span className="text-white font-medium">NIST-approved:</span> Industry standard compliance</span>
                    </li>
                  </ul>
                </div>
              </motion.div>

              {/* Layer 2: Brainwave Fusion */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 hover:border-purple-400/60 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(168, 85, 247, 0.15)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="w-16 h-16 mb-6 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                    <Brain className="w-8 h-8 text-purple-400" />
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-purple-400 px-3 py-1 bg-purple-500/10 rounded-full border border-purple-500/30">
                      LAYER 2
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4">Brainwave Fusion</h3>
                  
                  <p className="text-gray-300 mb-4 leading-relaxed">
                    Mental pattern encryption using Alpha, Beta, and Gamma brainwave signatures. Your unique neural activity becomes an unbreakable biometric key.
                  </p>
                  
                  <ul className="space-y-2 text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Neural entropy:</span> Biometric-grade randomness</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Multi-wave fusion:</span> Alpha, Beta, Gamma combined</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Impossible to replicate:</span> Your mind is the key</span>
                    </li>
                  </ul>
                </div>
              </motion.div>

              {/* Layer 3: Time Dilation */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-lg border border-emerald-500/30 rounded-2xl p-8 hover:border-emerald-400/60 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(16, 238, 145, 0.15)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="w-16 h-16 mb-6 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30">
                    <Clock className="w-8 h-8 text-emerald-400" />
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-emerald-400 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/30">
                      LAYER 3
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4">Time Dilation</h3>
                  
                  <p className="text-gray-300 mb-4 leading-relaxed">
                    Space-time encryption windows derived from neural wave phases. Keys exist only in precise temporal windows, adding a fourth dimension to security.
                  </p>
                  
                  <ul className="space-y-2 text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Temporal gating:</span> Time-locked decryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Entropy windows:</span> Ephemeral key validity</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span><span className="text-white font-medium">Anti-replay:</span> Prevents future attacks</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>

            {/* CTA Button */}
            <div className="mt-12 flex justify-center">
              <motion.button
                onClick={() => navigate('/encryption')}
                className="px-8 py-4 bg-gradient-to-r from-[#10ee91] to-[#00E68F] text-black rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                Experience the Future of Encryption
                <ArrowRight className="inline-block ml-2 w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Section 3: Wave Animations - Right Side Vertical */}
        <div className="min-h-screen flex items-center justify-end px-16">
          <div className="max-w-xl w-full space-y-8">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-white mb-8"
            >
              Neural Wave Encryption
            </motion.h2>
            
            {/* Alpha Wave */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="group bg-gray-800/40 backdrop-blur-md border border-purple-500/40 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-purple-500/60"
              style={{
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.1)',
              }}
            >
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-purple-400">Alpha Wave</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-purple-300 font-mono">8-13 Hz</span>
                  </div>
                </div>
                
                <div className="mb-4 overflow-hidden relative" style={{ height: '80px', willChange: 'transform' }}>
                  <style>{`
                    @keyframes alphaFlow {
                      from { transform: translateX(0); }
                      to { transform: translateX(-400px); }
                    }
                    .alpha-wave { animation: alphaFlow 7s linear infinite; }
                  `}</style>
                  <svg className="w-full h-full" viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    {/* Perfectly repeating seamless wave - pattern repeats every 200px */}
                    <g className="alpha-wave">
                      <path
                        d="M-400,40 Q-300,15 -200,40 Q-100,65 0,40 Q100,15 200,40 Q300,65 400,40 Q500,15 600,40 Q700,65 800,40 Q900,15 1000,40 Q1100,65 1200,40"
                        fill="none"
                        stroke="url(#purpleGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </g>
                    
                    {/* Multiple staggered particles for continuous flow */}
                    <circle r="4" fill="#a855f7" opacity="0.9">
                      <animateMotion
                        path="M0,40 Q100,15 200,40 Q300,65 400,40 Q500,15 600,40 Q700,65 800,40 Q900,15 1000,40"
                        dur="7s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3.5" fill="#c084fc" opacity="0.8">
                      <animateMotion
                        path="M0,40 Q100,15 200,40 Q300,65 400,40 Q500,15 600,40 Q700,65 800,40 Q900,15 1000,40"
                        dur="7s"
                        begin="2.33s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#ec4899" opacity="0.7">
                      <animateMotion
                        path="M0,40 Q100,15 200,40 Q300,65 400,40 Q500,15 600,40 Q700,65 800,40 Q900,15 1000,40"
                        dur="7s"
                        begin="4.67s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    
                    <defs>
                      <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                
                <p className="text-gray-300 text-sm leading-relaxed">
                  <span className="text-purple-300 font-semibold">Relaxed consciousness state</span> — Optimal for generating high-entropy encryption keys through calm, focused neural patterns
                </p>
              </div>
            </motion.div>

            {/* Beta Wave */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="group bg-gray-800/40 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-cyan-500/60"
              style={{
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)',
              }}
            >
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-cyan-400">Beta Wave</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-300 font-mono">13-30 Hz</span>
                  </div>
                </div>
                
                <div className="mb-4 overflow-hidden relative" style={{ height: '80px', willChange: 'transform' }}>
                  <style>{`
                    @keyframes betaFlow {
                      from { transform: translateX(0); }
                      to { transform: translateX(-200px); }
                    }
                    .beta-wave { animation: betaFlow 4.4s linear infinite; }
                  `}</style>
                  <svg className="w-full h-full" viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    {/* Perfectly repeating seamless wave - pattern repeats every 100px */}
                    <g className="beta-wave">
                      <path
                        d="M-200,40 Q-150,10 -100,40 Q-50,70 0,40 Q50,10 100,40 Q150,70 200,40 Q250,10 300,40 Q350,70 400,40 Q450,10 500,40 Q550,70 600,40 Q650,10 700,40 Q750,70 800,40 Q850,10 900,40 Q950,70 1000,40"
                        fill="none"
                        stroke="url(#cyanGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </g>
                    
                    {/* Multiple staggered particles for continuous flow */}
                    <circle r="4" fill="#06b6d4" opacity="0.9">
                      <animateMotion
                        path="M0,40 Q50,10 100,40 Q150,70 200,40 Q250,10 300,40 Q350,70 400,40 Q450,10 500,40 Q550,70 600,40 Q650,10 700,40 Q750,70 800,40 Q850,10 900,40"
                        dur="4.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3.5" fill="#22d3ee" opacity="0.8">
                      <animateMotion
                        path="M0,40 Q50,10 100,40 Q150,70 200,40 Q250,10 300,40 Q350,70 400,40 Q450,10 500,40 Q550,70 600,40 Q650,10 700,40 Q750,70 800,40 Q850,10 900,40"
                        dur="4.4s"
                        begin="1.47s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#3b82f6" opacity="0.7">
                      <animateMotion
                        path="M0,40 Q50,10 100,40 Q150,70 200,40 Q250,10 300,40 Q350,70 400,40 Q450,10 500,40 Q550,70 600,40 Q650,10 700,40 Q750,70 800,40 Q850,10 900,40"
                        dur="4.4s"
                        begin="2.93s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    
                    <defs>
                      <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                
                <p className="text-gray-300 text-sm leading-relaxed">
                  <span className="text-cyan-300 font-semibold">Active processing state</span> — Dynamic cognitive engagement produces complex, unpredictable patterns ideal for real-time key generation
                </p>
              </div>
            </motion.div>

            {/* Gamma Wave */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="group bg-gray-800/40 backdrop-blur-md border border-green-500/40 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-green-500/60"
              style={{
                boxShadow: '0 0 20px rgba(16, 238, 145, 0.1)',
              }}
            >
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-green-400">Gamma Wave</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-300 font-mono">30-100 Hz</span>
                  </div>
                </div>
                
                <div className="mb-4 overflow-hidden relative" style={{ height: '80px', willChange: 'transform' }}>
                  <style>{`
                    @keyframes gammaFlow {
                      from { transform: translateX(0); }
                      to { transform: translateX(-100px); }
                    }
                    .gamma-wave { animation: gammaFlow 2.4s linear infinite; }
                  `}</style>
                  <svg className="w-full h-full" viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    {/* Perfectly repeating seamless wave - pattern repeats every 50px */}
                    <g className="gamma-wave">
                      <path
                        d="M-100,40 Q-75,5 -50,40 Q-25,75 0,40 Q25,5 50,40 Q75,75 100,40 Q125,5 150,40 Q175,75 200,40 Q225,5 250,40 Q275,75 300,40 Q325,5 350,40 Q375,75 400,40 Q425,5 450,40 Q475,75 500,40 Q525,5 550,40 Q575,75 600,40 Q625,5 650,40 Q675,75 700,40 Q725,5 750,40 Q775,75 800,40 Q825,5 850,40 Q875,75 900,40"
                        fill="none"
                        stroke="url(#greenGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </g>
                    
                    {/* Multiple staggered particles for continuous flow */}
                    <circle r="4" fill="#10ee91" opacity="0.9">
                      <animateMotion
                        path="M0,40 Q25,5 50,40 Q75,75 100,40 Q125,5 150,40 Q175,75 200,40 Q225,5 250,40 Q275,75 300,40 Q325,5 350,40 Q375,75 400,40 Q425,5 450,40 Q475,75 500,40 Q525,5 550,40 Q575,75 600,40 Q625,5 650,40 Q675,75 700,40 Q725,5 750,40 Q775,75 800,40 Q825,5 850,40"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3.5" fill="#00E68F" opacity="0.8">
                      <animateMotion
                        path="M0,40 Q25,5 50,40 Q75,75 100,40 Q125,5 150,40 Q175,75 200,40 Q225,5 250,40 Q275,75 300,40 Q325,5 350,40 Q375,75 400,40 Q425,5 450,40 Q475,75 500,40 Q525,5 550,40 Q575,75 600,40 Q625,5 650,40 Q675,75 700,40 Q725,5 750,40 Q775,75 800,40 Q825,5 850,40"
                        dur="2.4s"
                        begin="0.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3.5" fill="#34d399" opacity="0.8">
                      <animateMotion
                        path="M0,40 Q25,5 50,40 Q75,75 100,40 Q125,5 150,40 Q175,75 200,40 Q225,5 250,40 Q275,75 300,40 Q325,5 350,40 Q375,75 400,40 Q425,5 450,40 Q475,75 500,40 Q525,5 550,40 Q575,75 600,40 Q625,5 650,40 Q675,75 700,40 Q725,5 750,40 Q775,75 800,40 Q825,5 850,40"
                        dur="2.4s"
                        begin="1.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#059669" opacity="0.7">
                      <animateMotion
                        path="M0,40 Q25,5 50,40 Q75,75 100,40 Q125,5 150,40 Q175,75 200,40 Q225,5 250,40 Q275,75 300,40 Q325,5 350,40 Q375,75 400,40 Q425,5 450,40 Q475,75 500,40 Q525,5 550,40 Q575,75 600,40 Q625,5 650,40 Q675,75 700,40 Q725,5 750,40 Q775,75 800,40 Q825,5 850,40"
                        dur="2.4s"
                        begin="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    
                    <defs>
                      <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10ee91" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#10ee91" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                
                <p className="text-gray-300 text-sm leading-relaxed">
                  <span className="text-green-300 font-semibold">Peak cognitive performance</span> — Highest frequency neural oscillations deliver maximum entropy and unparalleled security layers
                </p>
              </div>
            </motion.div>

            {/* Encrypt Now Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              onClick={() => navigate('/encryption')}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#10ee91] to-[#007F5E] text-black rounded-xl font-bold text-lg shadow-lg shadow-[#10ee91]/50 mt-6 relative overflow-hidden group"
              whileHover={{ scale: 1.02, boxShadow: "0 0 50px rgba(16, 238, 145, 0.6)" }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10">Encrypt Now with Neural Fusion</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#00E68F] to-[#10ee91] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
