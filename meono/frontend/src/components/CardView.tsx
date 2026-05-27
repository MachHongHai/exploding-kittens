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

  // Card Back (The "Double-Bezel" premium look)
  if (!card) {
    return (
      <motion.div 
        layoutId={layoutId}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className={`aspect-[2/3] ${baseSize} p-1.5 rounded-[1.5rem] bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md ${className}`}
      >
        <div className="w-full h-full rounded-[1.125rem] bg-gradient-to-br from-red-900 to-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border border-red-500/20 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-500 via-transparent to-transparent"></div>
          <span className="text-red-500/80 font-black text-2xl sm:text-4xl select-none tracking-tighter drop-shadow-md">EK</span>
        </div>
      </motion.div>
    );
  }

  // Premium Color Palettes for Card Faces
  let outerShell = "bg-white/10 border-white/20";
  let innerCore = "from-slate-100 to-slate-300 text-slate-800 shadow-[inset_0_1px_3px_rgba(255,255,255,1)]";
  
  switch (card.type) {
    case CardType.EXPLODING_KITTEN:
      outerShell = "bg-red-500/20 border-red-500/40";
      innerCore = "from-red-500 to-red-900 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]";
      break;
    case CardType.DEFUSE:
      outerShell = "bg-emerald-500/20 border-emerald-500/40";
      innerCore = "from-emerald-400 to-emerald-700 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]";
      break;
    case CardType.ATTACK:
      outerShell = "bg-orange-500/20 border-orange-500/40";
      innerCore = "from-orange-400 to-red-600 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]";
      break;
    case CardType.SKIP:
      outerShell = "bg-sky-500/20 border-sky-500/40";
      innerCore = "from-sky-300 to-blue-600 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]";
      break;
    case CardType.NOPE:
      outerShell = "bg-rose-500/20 border-rose-500/40";
      innerCore = "from-rose-500 to-rose-800 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]";
      break;
    case CardType.FAVOR:
      outerShell = "bg-purple-500/20 border-purple-500/40";
      innerCore = "from-purple-500 to-indigo-900 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]";
      break;
    case CardType.SHUFFLE:
    case CardType.SEE_THE_FUTURE:
      outerShell = "bg-fuchsia-500/20 border-fuchsia-500/40";
      innerCore = "from-fuchsia-400 to-fuchsia-700 text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]";
      break;
    default:
      outerShell = "bg-amber-500/20 border-amber-500/40";
      innerCore = "from-amber-200 to-yellow-500 text-amber-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]";
      break;
  }

  return (
    <motion.button
      layoutId={layoutId}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      whileHover={!disabled ? { y: -12, scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 100, damping: 25, duration: 0.8 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative aspect-[2/3] ${baseSize} p-1.5 rounded-[1.5rem] border backdrop-blur-md shadow-xl group ${outerShell} ${
        disabled ? 'opacity-50 cursor-not-allowed grayscale-[30%]' : 'cursor-pointer'
      } ${className}`}
    >
      <div className={`w-full h-full rounded-[1.125rem] bg-gradient-to-br flex flex-col items-center p-2 relative overflow-hidden ${innerCore}`}>
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-[1.125rem] pointer-events-none"></div>
        
        <span className="font-black text-[11px] sm:text-xs uppercase tracking-widest text-center mt-2 z-10 leading-tight">
          {card.name}
        </span>
        
        <div className="flex-1 flex items-center justify-center z-10">
          {card.type === CardType.EXPLODING_KITTEN && <span className="text-3xl sm:text-5xl filter drop-shadow-md">💣</span>}
          {card.type === CardType.DEFUSE && <span className="text-3xl sm:text-5xl filter drop-shadow-md">🛡️</span>}
          {card.type === CardType.ATTACK && <span className="text-3xl sm:text-5xl filter drop-shadow-md">⚔️</span>}
          {card.type === CardType.SKIP && <span className="text-3xl sm:text-5xl filter drop-shadow-md">⏭️</span>}
          {card.type === CardType.NOPE && <span className="text-3xl sm:text-5xl filter drop-shadow-md">🛑</span>}
          {card.type === CardType.FAVOR && <span className="text-3xl sm:text-5xl filter drop-shadow-md">🤲</span>}
          {(card.type === CardType.SHUFFLE || card.type === CardType.SEE_THE_FUTURE) && <span className="text-3xl sm:text-5xl filter drop-shadow-md">👁️</span>}
          {card.type.includes('CAT_CARD') && <span className="text-3xl sm:text-5xl filter drop-shadow-md">😺</span>}
        </div>
      </div>
    </motion.button>
  );
};
