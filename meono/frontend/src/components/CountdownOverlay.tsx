import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CountdownOverlayProps {
  expiresAt?: number;
  label: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ expiresAt, label }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const updateTimer = () => {
      const msLeft = expiresAt - Date.now();
      const secs = Math.ceil(msLeft / 1000);
      setSecondsLeft(Math.max(0, secs));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100); // Check frequently for smooth 1s updates
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isVisible = expiresAt && secondsLeft > 0 && secondsLeft <= 5;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
          <motion.div
            key={secondsLeft} // Force re-render/animation on number change
            initial={{ scale: 2.5, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0, rotate: 15 }}
            transition={{ 
              type: 'spring', 
              stiffness: 300, 
              damping: 15 
            }}
            className="text-[9.5rem] md:text-[16rem] font-black font-cartoon leading-none text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-yellow-500 select-none"
            style={{
              WebkitTextStroke: '5px #000',
              filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.8)) drop-shadow(0 0 50px rgba(239,68,68,0.6))',
            }}
          >
            {secondsLeft}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
