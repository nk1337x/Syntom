import { useEffect, useRef } from 'react';
import { initGalaxyBackground } from '../utils/galaxy';
import '../styles/galaxy.css';

const GalaxyBackground = () => {
  const canvasRef = useRef(null);
  const starfieldRef = useRef(null);

  useEffect(() => {
    console.log('GalaxyBackground mounting...');
    
    if (canvasRef.current && !starfieldRef.current) {
      console.log('Initializing galaxy background');
      // Set canvas size to match window
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      
      // Initialize the galaxy animation
      try {
        starfieldRef.current = initGalaxyBackground(canvasRef.current);
        console.log('Galaxy background initialized successfully');
      } catch (error) {
        console.error('Error initializing galaxy:', error);
      }
    }

    return () => {
      // Cleanup if needed
      if (starfieldRef.current) {
        console.log('Cleaning up galaxy background');
        starfieldRef.current = null;
      }
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      id="galaxy-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        background: '#000000'
      }}
    />
  );
};

export default GalaxyBackground;
