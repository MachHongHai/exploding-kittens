import React from 'react';
import { motion } from 'framer-motion';
import { CardType } from '../../../shared/src/types';
import type { Card } from '../../../shared/src/types';

interface CardViewProps {
  card?: Card; // If undefined, render card back
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  layoutId?: string;
}

export const CardView: React.FC<CardViewProps> = ({ card, onClick, disabled, className = "", layoutId }) => {
  const baseSize = className.includes("w-") ? "" : "w-24 sm:w-32";
  const imagePath = card ? `/cards/${card.type}.png` : "";
  const [imgError, setImgError] = React.useState(false);
  const [backImgError, setBackImgError] = React.useState(false);

  // Card Back (The "Double-Bezel" premium look)
  if (!card) {
    return (
      <motion.button
        layoutId={layoutId}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        whileHover={!disabled ? { y: -12, scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        onClick={onClick}
        disabled={disabled}
        className={`aspect-[2/3] ${baseSize} p-1.5 rounded-[1.5rem] bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${className}`}
      >
        <div className="w-full h-full rounded-[1.125rem] bg-gradient-to-br from-red-900 to-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border border-red-500/20 flex flex-col items-center justify-center relative overflow-hidden pointer-events-none">
          {!backImgError ? (
            <img 
              src="/cards/CARD_BACK.png" 
              alt="Card Back"
              className="absolute inset-0 w-full h-full object-cover rounded-[1.125rem] z-10"
              onError={() => setBackImgError(true)}
            />
          ) : (
            <>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-500 via-transparent to-transparent z-0"></div>
              <span className="text-red-500/80 font-black text-2xl sm:text-4xl select-none tracking-tighter drop-shadow-md z-10">EK</span>
            </>
          )}
          {/* Holographic Top Glare */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[1.125rem] pointer-events-none mix-blend-overlay z-20"></div>
        </div>
      </motion.button>
    );
  }

  // Premium Color Palettes for Card Faces
  let outerShell = "bg-white/10 border-white/20";
  let innerCore = "from-slate-200 to-slate-400 text-slate-900 shadow-[inset_0_1px_4px_rgba(255,255,255,0.9)]";
  let glowColor = "rgba(255,255,255,0.5)";

  switch (card.type) {
    case CardType.EXPLODING_KITTEN:
      outerShell = "bg-red-600/30 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
      innerCore = "from-red-500 via-red-700 to-black text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.5)]";
      glowColor = "rgba(239,68,68,0.8)";
      break;
    case CardType.DEFUSE:
      outerShell = "bg-emerald-500/30 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
      innerCore = "from-emerald-400 via-emerald-600 to-emerald-900 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)]";
      glowColor = "rgba(16,185,129,0.8)";
      break;
    case CardType.ATTACK:
      outerShell = "bg-orange-500/30 border-orange-500/50";
      innerCore = "from-orange-400 via-orange-600 to-red-800 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.5)]";
      glowColor = "rgba(249,115,22,0.8)";
      break;
    case CardType.SKIP:
      outerShell = "bg-sky-500/30 border-sky-500/50";
      innerCore = "from-sky-300 via-sky-500 to-blue-800 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)]";
      glowColor = "rgba(14,165,233,0.8)";
      break;
    case CardType.NOPE:
      outerShell = "bg-rose-500/30 border-rose-500/50";
      innerCore = "from-rose-500 via-rose-700 to-rose-950 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.5)]";
      glowColor = "rgba(244,63,94,0.8)";
      break;
    case CardType.FAVOR:
      outerShell = "bg-purple-500/30 border-purple-500/50";
      innerCore = "from-purple-400 via-purple-600 to-indigo-950 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.5)]";
      glowColor = "rgba(168,85,247,0.8)";
      break;
    case CardType.SHUFFLE:
    case CardType.SEE_THE_FUTURE:
      outerShell = "bg-fuchsia-500/30 border-fuchsia-500/50";
      innerCore = "from-fuchsia-400 via-fuchsia-600 to-purple-900 text-white shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)]";
      glowColor = "rgba(217,70,239,0.8)";
      break;
    default:
      outerShell = "bg-amber-400/30 border-amber-400/50";
      innerCore = "from-amber-200 via-amber-400 to-yellow-600 text-amber-950 shadow-[inset_0_1px_4px_rgba(255,255,255,0.8)]";
      glowColor = "rgba(251,191,36,0.8)";
      break;
  }

  return (
    <motion.button
      layoutId={layoutId}
      initial={{ scale: 0.8, opacity: 0, rotateY: 90 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: 50 }}
      whileHover={!disabled ? {
        y: -15,
        scale: 1.08,
        rotateX: 5,
        rotateY: -5,
        boxShadow: `0 20px 25px -5px ${glowColor}, 0 8px 10px -6px rgba(0, 0, 0, 0.5)`
      } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 200, damping: 20, duration: 0.4 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative aspect-[2/3] ${baseSize} p-1.5 rounded-[1.5rem] border backdrop-blur-md shadow-[0_8px_15px_rgba(0,0,0,0.4)] group transition-all duration-300 ${outerShell} ${disabled ? 'opacity-50 cursor-not-allowed grayscale-[40%]' : 'cursor-pointer'
        } ${className}`}
      style={{ perspective: 1000 }}
    >
      <div className={`w-full h-full rounded-[1.125rem] bg-gradient-to-br flex flex-col items-center relative overflow-hidden ${innerCore}`}>
        
        {!imgError ? (
          <img 
            src={imagePath}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover z-10"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center w-full h-full p-2 z-10 relative">
            <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-center mt-3 z-10 leading-tight drop-shadow-sm px-1">
              {card.name}
            </span>
            <div className="flex-1 flex items-center justify-center z-10 w-full relative">
              <motion.div 
                className="text-4xl sm:text-6xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                whileHover={{ scale: 1.1, rotate: [-2, 2, -2] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                {card.type === CardType.EXPLODING_KITTEN && "💣"}
                {card.type === CardType.DEFUSE && "🛡️"}
                {card.type === CardType.ATTACK && "⚔️"}
                {card.type === CardType.SKIP && "⏭️"}
                {card.type === CardType.NOPE && "🛑"}
                {card.type === CardType.FAVOR && "🤲"}
                {(card.type === CardType.SHUFFLE || card.type === CardType.SEE_THE_FUTURE) && "👁️"}
                {card.type.includes('CAT_CARD') && "😺"}
              </motion.div>
            </div>
          </div>
        )}

        {/* Holographic Top Glare */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[1.125rem] pointer-events-none mix-blend-overlay z-20"></div>

        {/* Diagonal Sheen Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.5)_10px,rgba(255,255,255,0.5)_20px)] pointer-events-none z-20"></div>
      </div>
    </motion.button>
  );
};
