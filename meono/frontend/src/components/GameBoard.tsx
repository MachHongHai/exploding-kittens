import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType } from '../../../shared/src/types';
import type { GameState, PlayerAction } from '../../../shared/src/types';
import { CardView } from './CardView';
import woodTabletop from '../assets/wood_tabletop.png';

interface GameBoardProps {
  gameState: GameState;
  socketId: string;
  onAction: (action: PlayerAction, callback?: (res: any) => void) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, socketId, onAction }) => {
  const [targetPlayerId, setTargetPlayerId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  
  // Watch for shuffle action
  useEffect(() => {
    if (gameState.lastAction?.includes("played Shuffle")) {
      setIsShuffling(true);
      const timer = setTimeout(() => setIsShuffling(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState.lastAction]);

  const myPlayer = gameState.players.find(p => p.id === socketId);
  const opponents = gameState.players.filter(p => p.id !== socketId);
  
  const isMyTurn = gameState.currentPlayerId === socketId && gameState.status === 'PLAYING';
  const isExploding = gameState.waitingForDefuse === socketId;
  const hasDefuse = myPlayer?.hand?.some(c => c.type === CardType.DEFUSE);

  // Future logic
  const isSeeingFuture = !!gameState.futureCards;

  // Stealing logic
  const isStealer = gameState.waitingForSteal?.stealerId === socketId;
  const victimId = gameState.waitingForSteal?.victimId;
  const victim = gameState.players.find(p => p.id === victimId);

  // Favor logic
  const isFavorVictim = gameState.waitingForFavor?.victimId === socketId;
  const favorRequester = gameState.players.find(p => p.id === gameState.waitingForFavor?.requesterId);

  // Theft animation logic (for when I'M being stolen from BLINDLY via Pairs)
  const isBeingStolenFrom = gameState.lastTheft?.victimId === socketId && !gameState.waitingForFavor;

  // Helper properties to identify any valid Nope opportunity
  const nopeCard = myPlayer?.hand?.find(c => c.type === CardType.NOPE);
  const isWindowActive = !!gameState.actionWindow && !(gameState.actionWindow.initiatorId === socketId && gameState.actionWindow.nopeCount === 0) && gameState.actionWindow.lastNoperId !== socketId;
  
  // Late Nope opportunities (after action window has resolved)
  const isAttackOrSkipNopeable = !!gameState.lastNopeableAction &&
    (gameState.lastNopeableAction.type === 'ATTACK' || gameState.lastNopeableAction.type === 'SKIP') &&
    gameState.currentPlayerId === socketId;

  const isResolvedNopeNopeable = !!gameState.lastNopeableAction &&
    gameState.lastNopeableAction.type === 'NOPE' &&
    gameState.lastNopeableAction.initiatorId !== socketId;

  const isStealOrFavorNopeable = !!gameState.lastNopeableAction &&
    (gameState.lastNopeableAction.type === '2-CARD' || 
     gameState.lastNopeableAction.type === '3-CARD' || 
     gameState.lastNopeableAction.type === 'FAVOR') &&
    gameState.lastNopeableAction.targetId === socketId;
  
  const isNopeOpportunity = isWindowActive || 
    (gameState.waitingForFavor?.victimId === socketId) || 
    (gameState.waitingForSteal?.victimId === socketId) || 
    isBeingStolenFrom || 
    isAttackOrSkipNopeable ||
    isResolvedNopeNopeable ||
    isStealOrFavorNopeable;

  const toggleCardSelection = (cardId: string) => {
    setActionError(null);

    // Quick-play Nope card directly from hand during any active Nope opportunity
    if (isNopeOpportunity && nopeCard && cardId === nopeCard.id) {
      onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
      return;
    }

    if (gameState.actionWindow) return; // Block other card clicks during the action window

    if (isExploding || isStealer || isSeeingFuture) return;
    
    // If being asked for a favor, select the card to give
    if (isFavorVictim) {
      setSelectedCardIds([cardId]); // Only one card for favor
      return;
    }

    if (!isMyTurn) return;

    setSelectedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleStealPick = (cardIndex: number) => {
    if (!isStealer || !victimId) return;
    onAction({ type: 'STEAL_CARD', victimId, cardIndex });
  };

  const handleGiveCard = () => {
    if (!isFavorVictim || !gameState.waitingForFavor || selectedCardIds.length === 0) return;
    onAction({ type: 'GIVE_CARD', requesterId: gameState.waitingForFavor.requesterId, cardId: selectedCardIds[0] });
    setSelectedCardIds([]);
  };

  const handleConfirmFuture = () => {
    onAction({ type: 'CONFIRM_FUTURE' });
  };

  const renderActionWindow = () => {
    return null;
  };

  const renderFavorOverlay = () => {
    const showFavor = isFavorVictim && favorRequester;
    const selectedCard = myPlayer?.hand?.find(c => c.id === selectedCardIds[0]);

    return (
      <AnimatePresence>
        {showFavor && (
          <motion.div 
            key="favor-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-purple-950/90 border border-purple-500/30 rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] z-40 text-center flex flex-col items-center justify-center pointer-events-auto"
          >
            <h2 className="text-2xl font-cartoon text-purple-400 mb-1 uppercase tracking-tighter italic">
              FAVOR REQUESTED
            </h2>
            <p className="text-xs text-slate-300 font-cartoon uppercase tracking-widest mb-6">
              Give <span className="text-white bg-purple-500/30 px-2 py-0.5 rounded border border-purple-500/50">{favorRequester.name}</span> a card
            </p>

            <AnimatePresence mode="wait">
              {selectedCard ? (
                <motion.div 
                  key="give-btn"
                  initial={{ y: 10, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -10, opacity: 0 }} 
                  className="flex flex-col items-center gap-4 w-full"
                >
                  <button 
                    onClick={handleGiveCard}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-cartoon py-3 rounded-full text-sm shadow-[0_0_30px_rgba(168,85,247,0.4)] uppercase tracking-wider transition-all hover:scale-102 active:scale-98"
                  >
                    Give "{selectedCard.name}"
                  </button>
                  <span className="text-[9px] text-purple-400 font-cartoon uppercase tracking-widest animate-pulse">Tap another card to change</span>
                </motion.div>
              ) : (
                <motion.div 
                  key="select-msg"
                  initial={{ y: 10, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -10, opacity: 0 }}
                  className="text-slate-500 text-xs font-cartoon uppercase tracking-widest border border-dashed border-white/10 rounded-2xl py-6 px-4 w-full"
                >
                  Select a card from your hand below...
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const handlePlayCombo = (requestedCardType?: CardType) => {
    if (!isMyTurn || selectedCardIds.length === 0 || gameState.actionWindow) return;
    
    const selectedCards = myPlayer?.hand?.filter(c => selectedCardIds.includes(c.id)) || [];
    const isSameType = selectedCards.every(c => c.type === selectedCards[0].type);

    let action: PlayerAction | null = null;

    if (selectedCards.length === 1) {
      if (selectedCards[0].type.startsWith('CAT_CARD')) {
        setActionError("Cat cards must be played in pairs!");
        return;
      }
      if (selectedCards[0].type === CardType.FAVOR) {
        if (!targetPlayerId) { setActionError("Select a target player first!"); return; }
        action = { type: 'PLAY_CARDS', cardIds: selectedCardIds, targetId: targetPlayerId };
      } else {
        action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
      }
    } else if (selectedCards.length === 2) {
      if (!isSameType) { setActionError("Pairs must be the same card type!"); return; }
      if (!targetPlayerId) { setActionError("Select a target player to steal from!"); return; }
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds, targetId: targetPlayerId };
    } else if (selectedCards.length === 3) {
      if (!isSameType) { setActionError("3 of a kind must be the same card type!"); return; }
      if (!targetPlayerId) { setActionError("Select a target player to steal from!"); return; }
      
      if (!requestedCardType) {
        setShowGuessModal(true);
        setActionError(null);
        return;
      }
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds, targetId: targetPlayerId, requestedCardType };
    } else {
      setActionError("Invalid combination length!");
      return;
    }

    if (action) {
      onAction(action, (res) => {
        if (res && !res.success) {
          setActionError(res.message);
          if (selectedCards.length !== 3) setSelectedCardIds([]);
        } else {
          setSelectedCardIds([]);
          setTargetPlayerId(null);
          setShowGuessModal(false);
          setActionError(null);
        }
      });
    }
  };

  if (gameState.status === 'GAME_OVER') {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen text-white p-6 relative"
        style={{
          backgroundImage: `url(${woodTabletop})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
        
        <div className="relative z-10 text-center">
          <motion.h1 
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-6xl md:text-8xl font-cartoon text-orange-500 mb-6 uppercase tracking-wider drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
          >
            GAME OVER
          </motion.h1>
          <motion.p 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-cartoon text-amber-100 mb-12 drop-shadow"
          >
            🏆 {gameState.winner} won! 🏆
          </motion.p>
          <button 
            onClick={() => window.location.reload()} 
            className="font-cartoon text-sm px-8 py-3.5 rounded-2xl bg-amber-950/80 border border-amber-600/40 hover:bg-amber-900/90 text-amber-200 transition-all shadow-[0_5px_15px_rgba(0,0,0,0.5)] active:translate-y-0.5 tracking-widest uppercase"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Calculate kitten percentage
  const totalCards = gameState.drawPileCount;
  const kittens = gameState.explodingKittensCount ?? 0;
  const kittenPercent = totalCards > 0 ? Math.round((kittens / totalCards) * 100) : 0;
  const needleRotation = -90 + (kittenPercent * 1.8);

  const actionHistory = gameState.actionHistory || [];

  const N = myPlayer?.hand?.length || 0;
  const getCardFanStyle = (index: number) => {
    if (N <= 1) return { rotate: 0, y: 15, x: 0 };
    const mid = (N - 1) / 2;
    const spread = Math.min(22 / N, 5.5);
    const rotate = (index - mid) * spread;
    const y = Math.abs(index - mid) * Math.abs(index - mid) * 2 + 15; // Shifts baseline downward to crop cards
    const x = (index - mid) * -18; // Pulls cards closer for overlap
    return { rotate, y, x };
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden text-white select-none flex flex-col justify-between"
      style={{
        backgroundImage: `url(${woodTabletop})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      onPointerUp={() => {
        if (isDragging && selectedCardIds.length > 0) handlePlayCombo();
        setIsDragging(false);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1 && selectedCardIds.length > 0) setIsDragging(true);
      }}
    >
      {/* Background shade overlays for depth & premium feel */}
      <div className="absolute inset-0 bg-black/35 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(0,0,0,0.65)_90%)] pointer-events-none z-0" />

      {/* 1. Top Header: Opponents Row & Leave Game */}
      <div className="relative z-20 w-full flex items-center justify-between px-6 pt-3 pb-1">
        {/* Leave Game button (top-left) */}
        <button 
          onClick={() => window.location.reload()}
          className="font-cartoon text-[10px] bg-red-950/60 text-red-200 border border-red-800/40 hover:bg-red-900/80 px-3.5 py-2 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] active:translate-y-0.5 tracking-wider uppercase shrink-0"
        >
          Leave Game
        </button>

        {/* Opponent Row (centered & spaced out at top) */}
        <div className="flex-1 flex items-center justify-evenly px-4 md:px-12 max-w-7xl mx-auto w-full gap-8 md:gap-16">
          {opponents.map((opp, idx) => {
            const isTargeted = targetPlayerId === opp.id;
            const isTheirTurn = gameState.currentPlayerId === opp.id;
            const isStealing = gameState.lastTheft?.stealerId === opp.id;

            // Define themed styles (similar to OTHO, ADAM, BARBARA, LYDIA)
            let nameColor = "text-amber-100";
            let circleColor = "border-amber-900/60 bg-amber-950/40 text-white";
            
            if (opp.isEliminated) {
              nameColor = "text-stone-400";
              circleColor = "border-stone-600 bg-stone-900/20 opacity-50 text-stone-500";
            } else {
              const themeIndex = idx % 3;
              if (themeIndex === 0) {
                // OTHO (Green Theme)
                nameColor = "text-[#4ade80]";
                circleColor = "border-[#22c55e]/80 bg-[#15803d]/40 text-[#4ade80]";
              } else if (themeIndex === 1) {
                // ADAM (Orange Theme)
                nameColor = "text-[#f97316]";
                circleColor = "border-[#ea580c]/80 bg-[#c2410c]/40 text-[#f97316]";
              } else {
                // BARBARA (Pink Theme)
                nameColor = "text-[#ec4899]";
                circleColor = "border-[#db2777]/80 bg-[#be185d]/40 text-[#ec4899]";
              }
            }

            return (
              <motion.div 
                key={opp.id}
                layout
                onClick={() => setTargetPlayerId(opp.id)}
                className={`flex flex-col items-center cursor-pointer relative shrink-0 ${opp.isEliminated ? 'opacity-50' : ''}`}
              >
                {/* Opponent Name above the circle */}
                <span className={`font-cartoon text-xs font-bold ${nameColor} uppercase tracking-wider mb-2 drop-shadow`}>
                  {opp.name}
                </span>

                {/* Avatar Badge & overlapping card fan relative wrapper */}
                <div className="relative w-22 h-22 flex items-center justify-center shrink-0">
                  {/* Glowing aura around active player circle */}
                  {isTheirTurn && !opp.isEliminated && (
                    <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full blur opacity-75 animate-pulse -z-10"></div>
                  )}

                  {/* Turn Indicator Badge */}
                  {isTheirTurn && !opp.isEliminated && (
                    <div className="absolute -top-4 bg-orange-600 border border-orange-400 text-white font-cartoon text-[8px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider animate-bounce z-30">
                      TURNS: {opp.turnsToPlay}
                    </div>
                  )}

                  {/* Circular Badge */}
                  <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center shadow-md relative overflow-hidden transition-all duration-300 ${circleColor} ${
                    isTargeted 
                      ? 'ring-4 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.5)] border-amber-400 scale-105' 
                      : isTheirTurn && !opp.isEliminated
                        ? 'ring-4 ring-yellow-400 animate-pulse border-yellow-300'
                        : ''
                  }`}>
                    {opp.isEliminated ? (
                      <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-3 7c-.55 0-1-.45-1-1 0-1.66 1.34-3 3-3 .55 0 1 .45 1 1s-.45 1-1 1c-.55 0-1 .45-1 1 0 .55-.45 1-1 1zm6 0c-.55 0-1-.45-1-1 0-.55-.45-1-1-1s-1 .45-1 1c0 1.66 1.34 3 3 3 .55 0 1-.45 1-1s-.45-1-1-1z" />
                      </svg>
                    ) : (
                      <svg className="w-13 h-13 fill-current" viewBox="0 0 40 40">
                        <path d="M8,12 L3,2 L14,9 Z" />
                        <path d="M32,12 L37,2 L26,9 Z" />
                        <circle cx="20" cy="20" r="11" />
                        <circle cx="15" cy="18" r="4.2" fill="#fff" stroke="#000" strokeWidth="0.5" />
                        <circle cx="25" cy="18" r="4.2" fill="#fff" stroke="#000" strokeWidth="0.5" />
                        <circle cx="14" cy="17.5" r="1.2" fill="#000" />
                        <circle cx="26" cy="18.5" r="1.2" fill="#000" />
                        <polygon points="20,22 18,20 22,20" fill="#f87171" />
                        <path d="M18,24 Q20,25.5 22,24" stroke="#f87171" strokeWidth="1" fill="none" />
                      </svg>
                    )}
                  </div>

                  {/* Card Hand Tray (Red overlapping cards, placed *in front* of the bottom of the circle) */}
                  {!opp.isEliminated && (
                    <div className={`absolute bottom-[-16px] left-1/2 -translate-x-1/2 flex justify-center z-20 ${
                      isStealer && opp.id === victimId ? 'pointer-events-auto' : 'pointer-events-none'
                    }`}
                         style={{ 
                           gap: opp.handCount > 5 ? `-${Math.min(24, 12 + (opp.handCount - 5) * 1.5)}px` : '-12px' 
                         }}
                    >
                      {opp.handCount > 0 && Array.from({ length: opp.handCount }).map((_, cardIdx) => {
                        const mid = (opp.handCount - 1) / 2;
                        const rotation = (cardIdx - mid) * (opp.handCount > 8 ? 8 : 12);
                        const translateY = Math.abs(cardIdx - mid) * 1.5;
                        const isStealTarget = isStealer && opp.id === victimId;
                        return (
                          <motion.button 
                            key={cardIdx} 
                            type="button"
                            onClick={() => isStealTarget && handleStealPick(cardIdx)}
                            whileHover={isStealTarget ? { y: -15, scale: 1.3, zIndex: 100 } : {}}
                            whileTap={isStealTarget ? { scale: 0.9 } : {}}
                            className={`w-7 h-10 rounded-md shadow-lg flex items-center justify-center shrink-0 origin-bottom transition-all ${
                              isStealTarget 
                                ? 'bg-gradient-to-b from-orange-500 to-red-600 border-2 border-amber-300 cursor-pointer shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-pulse' 
                                : 'bg-[#dc2626] border border-red-400'
                            }`}
                            style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
                          >
                            <span className="text-[6px] text-white font-cartoon scale-[0.7] leading-none">
                              {isStealTarget ? '?' : 'EK'}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isStealing && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1.1 }} className="absolute -bottom-2 bg-purple-600 text-white text-[8px] font-cartoon px-1.5 py-0.5 rounded shadow z-30">
                    STOLE!
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Dummy spacer */}
        <div className="w-[88px] shrink-0 hidden md:block"></div>
      </div>

      {/* 2. Center Board Section */}
      <div className="relative z-10 flex-1 flex flex-row items-center justify-between px-8 py-2 max-w-6xl mx-auto w-full h-[45vh] max-h-[360px]">
        
        {/* Left Side: Kitten Chance Dial */}
        <div className="flex flex-col items-center justify-center p-2.5 bg-black/45 border border-amber-950/20 backdrop-blur-sm rounded-3xl w-36 h-36 shadow-xl shrink-0 relative">
          <div className="text-[9px] font-cartoon text-amber-200/50 uppercase tracking-widest text-center absolute top-2">
            Chance of Kitten
          </div>

          <div className="relative w-24 h-20 mt-3 flex items-center justify-center overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 60">
              {/* Background Arc */}
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="#1c1917" 
                strokeWidth="10" 
                strokeLinecap="round" 
              />
              {/* Green Sector */}
              <path 
                d="M 10 50 A 40 40 0 0 1 40 18" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="10" 
              />
              {/* Yellow Sector */}
              <path 
                d="M 40 18 A 40 40 0 0 1 60 18" 
                fill="none" 
                stroke="#fbbf24" 
                strokeWidth="10" 
              />
              {/* Red Sector */}
              <path 
                d="M 60 18 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth="10" 
              />

              {/* Needle pointer */}
              <g transform="translate(50, 50)">
                <motion.polygon 
                  points="-2.5,0 0,-38 2.5,0" 
                  fill="#f97316"
                  stroke="#ea580c"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                  animate={{ rotate: needleRotation }}
                  transition={{ type: 'spring', stiffness: 50, damping: 13 }}
                  style={{ originX: 0, originY: 0 }}
                />
                <circle cx="0" cy="0" r="5" fill="#ea580c" />
                <circle cx="0" cy="0" r="2" fill="#fff" />
              </g>
            </svg>

            {/* Digital percentage readout */}
            <div className="absolute bottom-0.5 font-cartoon text-lg text-white drop-shadow bg-black/60 border border-white/10 px-2.5 py-0.5 rounded-lg shadow">
              {kittenPercent}%
            </div>
          </div>
        </div>

        {/* Middle Area: Draw & Discard Piles with relative cable cord */}
        <div className="relative flex-1 flex flex-row items-center justify-center gap-10 md:gap-16 pointer-events-auto">
          {/* Connecting Red Cable Cord */}
          <svg className="absolute pointer-events-none z-0 -left-6 top-16 w-36 h-20 overflow-visible hidden md:block" fill="none">
            <path 
              d="M 5, 5 C 30, 60 90, 60 120, 15" 
              stroke="#b91c1c" 
              strokeWidth="3" 
              strokeLinecap="round"
              opacity="0.75"
            />
          </svg>

          {/* Draw Pile */}
          <div className="flex flex-col items-center relative">
            <AnimatePresence>
              {isShuffling && (
                <>
                  <motion.div
                    key="shuffle-ghost-1"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{
                      scale: 0.85,
                      opacity: [0, 0.8, 0.8, 0],
                      x: [-20, -80, 80, -20],
                      y: [0, -10, -20, 0],
                      rotate: [0, -15, 15, 0],
                    }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 1.0 }}
                    className="absolute top-0 left-0 pointer-events-none"
                  >
                    <CardView disabled className="shadow-[0_0_20px_rgba(239,68,68,0.3)] border-red-500/20 w-20 sm:w-24 h-30 sm:h-36" />
                  </motion.div>
                  <motion.div
                    key="shuffle-ghost-2"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{
                      scale: 0.85,
                      opacity: [0, 0.8, 0.8, 0],
                      x: [20, 80, -80, 20],
                      y: [0, -20, -10, 0],
                      rotate: [0, 15, -15, 0],
                    }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 1.0, delay: 0.15 }}
                    className="absolute top-0 left-0 pointer-events-none"
                  >
                    <CardView disabled className="shadow-[0_0_20px_rgba(239,68,68,0.3)] border-red-500/20 w-20 sm:w-24 h-30 sm:h-36" />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <motion.button 
              animate={isShuffling ? { 
                x: [0, -10, 10, -10, 10, 0],
                rotate: [0, -5, 5, -5, 5, 0],
                scale: [1, 1.05, 1]
              } : {}}
              transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0 }}
              onClick={() => isMyTurn && !isExploding && onAction({ type: 'DRAW_CARD' })}
              disabled={!isMyTurn || isExploding}
              className={`relative group transition-all duration-500 z-10 shrink-0 aspect-[2/3] w-20 sm:w-24 rounded-[1.2rem] p-1.5 bg-[#4d0c0c] border-4 border-[#e25c34]/80 shadow-[0_8px_20px_rgba(0,0,0,0.6)] ${
                isMyTurn && !isExploding ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed opacity-90'
              }`}
            >
              <div className="w-full h-full rounded-[0.9rem] bg-gradient-to-br from-red-500 to-red-700 flex flex-col items-center justify-center p-2 relative overflow-hidden shadow-[inset_0_1px_4px_rgba(255,255,255,0.4)]">
                {/* Fat custom cat vector SVG */}
                <svg className="w-14 h-14 text-[#e25c34] fill-current" viewBox="0 0 64 64">
                  <path d="M16 48C16 38 22 32 32 32C42 32 48 38 48 48C48 52 44 54 32 54C20 54 16 52 16 48Z" />
                  <polygon points="20,36 12,22 26,28" />
                  <polygon points="44,36 52,22 38,28" />
                  <circle cx="32" cy="34" r="12" />
                  <circle cx="28" cy="32" r="1.5" fill="#facc15" />
                  <circle cx="36" cy="32" r="1.5" fill="#facc15" />
                  <circle cx="28" cy="32" r="0.75" fill="#000" />
                  <circle cx="36" cy="32" r="0.75" fill="#000" />
                </svg>
              </div>
            </motion.button>

            {/* Card Count wood block */}
            <span className="mt-2.5 font-cartoon tracking-wider text-amber-100 text-[10px] shadow-lg bg-[#3b1d11] border-2 border-[#542d1b] px-3 py-0.5 rounded-md z-10 select-none">
              {gameState.drawPileCount} CARDS LEFT
            </span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center">
            <div className="relative w-20 sm:w-24 h-30 sm:h-36">
              {gameState.discardPile.length === 0 ? (
                <div className="w-full h-full border-4 border-dashed border-amber-900/20 rounded-[1.2rem] flex items-center justify-center bg-black/30 shadow-inner">
                  <span className="text-amber-100/10 font-cartoon uppercase text-[10px]">Empty</span>
                </div>
              ) : (
                gameState.discardPile.map((card, i) => {
                  const isTop = i === gameState.discardPile.length - 1;
                  const rotation = (i * 11) % 23 - 11;
                  return (
                    <div 
                      key={card.id + i} 
                      className="absolute inset-0 transition-all duration-700"
                      style={{ transform: `rotate(${rotation}deg)`, zIndex: i }}
                    >
                      <CardView card={card} disabled={!isTop} layoutId={card.id} className="w-20 sm:w-24 h-30 sm:h-36" />
                    </div>
                  )
                })
              )}
            </div>
            <span className="mt-2.5 font-cartoon tracking-wider text-amber-100/70 text-[10px] uppercase">
              Discard
            </span>
          </div>
        </div>

        {/* Right Side: Hanging Scroll Board */}
        <div className="flex flex-col items-center w-52 shrink-0 pointer-events-auto relative z-10">
          {/* Hanging rod */}
          <div className="w-44 h-2 bg-stone-500 rounded-full shadow-md relative flex items-center justify-between px-4">
            <div className="w-3.5 h-3.5 rounded-full bg-stone-700 -ml-4 border border-stone-600 shadow" />
            <div className="w-3.5 h-3.5 rounded-full bg-stone-700 -mr-4 border border-stone-600 shadow" />
          </div>
          
          {/* Parchment scroll container */}
          <div className="w-40 -mt-1 bg-[#faf5ec] border border-[#d4c3a3] rounded-b-2xl p-3 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col justify-between h-44 overflow-hidden relative">
            {/* Hanging tabs connecting scroll to rod */}
            <div className="absolute -top-1.5 left-6 w-3 h-2 bg-stone-600 rounded" />
            <div className="absolute -top-1.5 right-6 w-3 h-2 bg-stone-600 rounded" />
            
            <div className="text-[10px] font-cartoon text-[#8c6747] uppercase tracking-wider text-center border-b border-[#ebdcb9] pb-1">
              Scroll of Acts
            </div>
            
            {/* Silly Turn Details graphic (mini YOU avatar pointing to cards) */}
            <div className="flex items-center justify-center gap-1.5 py-1 mt-1 border-b border-[#ebdcb9] border-dashed">
              <div className="w-7 h-7 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center text-[7px] font-cartoon text-white shadow-sm shrink-0">
                YOU
              </div>
              <span className="text-stone-500 text-xs font-bold leading-none">➔</span>
              <div className="w-5 h-7 bg-[#dc2626] border border-red-400 rounded-sm flex items-center justify-center shadow-sm shrink-0">
                <span className="text-[5px] text-white font-cartoon leading-none">EK</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto mt-1.5 custom-scrollbar">
              {actionHistory.slice(-3).reverse().map((act, index) => (
                <div 
                  key={index} 
                  className={`font-parchment text-[9px] leading-tight ${
                    index === 0 ? 'text-stone-900 font-extrabold' : 'text-stone-700/60'
                  }`}
                >
                  • {act}
                </div>
              ))}
              {actionHistory.length === 0 && (
                <span className="font-parchment text-[9px] text-stone-700/40 italic">Waiting...</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Bottom Controls: Player Info, Fanned Hand, Nope Button */}
      <div className="relative z-20 w-full flex flex-col items-center justify-end pb-2 bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-12 overflow-visible">
        
        {/* Play Button floating above the hand */}
        <div className="absolute top-0 pointer-events-none w-full flex flex-col items-center justify-center">
          <AnimatePresence>
            {selectedCardIds.length > 0 && !isExploding && !isFavorVictim && (
              <motion.div 
                initial={{ y: 25, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: 25, opacity: 0 }} 
                className="flex flex-col items-center pointer-events-auto"
              >
                <button 
                  onClick={() => handlePlayCombo()}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-cartoon px-8 py-2.5 rounded-full text-lg shadow-[0_8px_25px_rgba(249,115,22,0.6)] border border-orange-400/30 uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                  Play ({selectedCardIds.length})
                </button>
                <span className="text-[8px] text-orange-400/80 mt-1 font-cartoon uppercase tracking-widest animate-pulse">
                  Double tap card to play
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Error Banner */}
          {actionError && (
            <div className="px-4 py-2 rounded-xl bg-red-950/80 border border-red-500/30 text-red-400 font-cartoon text-xs mb-2 pointer-events-auto shadow-lg animate-shake">
              {actionError}
            </div>
          )}

          {/* Phase turn indicator text banner */}
          <div className={`px-4 py-2 rounded-full font-cartoon uppercase tracking-wider text-[10px] border backdrop-blur-md transition-all duration-1000 pointer-events-auto shadow ${
            isMyTurn 
              ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-orange-400/40 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse" 
              : "bg-black/60 text-slate-400 border-white/5"
          }`}>
            {isMyTurn 
              ? `Your Turn ${myPlayer?.turnsToPlay && myPlayer.turnsToPlay > 1 ? `(${myPlayer.turnsToPlay} Turns)` : ''}` 
              : "Waiting for other players..."
            }
          </div>
        </div>

        {/* Player Profile, Hand, and Nope Button row */}
        <div className="w-full flex flex-row items-end justify-between px-6 pt-10 relative overflow-visible">
          
          {/* Bottom Left: Player Avatar */}
          <div className="flex items-center gap-3 shrink-0 mb-2 relative">
            <div className="relative w-18 h-18 flex items-center justify-center">
              {/* Sunburst background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(59,130,246,0.5)_0%,_transparent_70%)] scale-150 animate-pulse pointer-events-none" />
              {/* Starburst rays */}
              <svg className="absolute w-28 h-28 text-blue-500/20 fill-current animate-[spin_60s_linear_infinite] pointer-events-none" viewBox="0 0 100 100">
                <path d="M50,50 L45,0 L50,15 L55,0 Z M50,50 L95,45 L85,50 L95,55 Z M50,50 L45,100 L50,85 L55,100 Z M50,50 L0,45 L15,50 L0,55 Z" />
                <path d="M50,50 L18,18 L32,32 Z M50,50 L82,18 L68,32 Z M50,50 L82,82 L68,68 Z M50,50 L18,82 L32,68 Z" transform="rotate(22.5, 50, 50)" />
              </svg>
              
              <div className={`w-14 h-14 rounded-full border-4 bg-blue-900/60 border-blue-400 flex items-center justify-center shadow-2xl relative overflow-hidden z-10 ${
                isMyTurn ? 'ring-2 ring-yellow-300 animate-pulse' : ''
              }`}>
                {/* Silly Blue Cat SVG */}
                <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 40 40">
                  <path d="M8,12 L3,2 L14,9 Z" />
                  <path d="M32,12 L37,2 L26,9 Z" />
                  <circle cx="20" cy="20" r="11" />
                  <circle cx="15" cy="18" r="4" fill="#fff" stroke="#000" strokeWidth="0.5" />
                  <circle cx="25" cy="18" r="4" fill="#fff" stroke="#000" strokeWidth="0.5" />
                  <circle cx="16" cy="18" r="1.2" fill="#000" />
                  <circle cx="24" cy="18" r="1.2" fill="#000" />
                  <polygon points="20,22 18,20 22,20" fill="#f87171" />
                  <path d="M18,24 Q20,25.5 22,24" stroke="#f87171" strokeWidth="1" fill="none" />
                </svg>
              </div>
            </div>
            
            <div className="flex flex-col z-10 select-none">
              <span className="font-cartoon text-xs text-blue-200 bg-blue-950/70 border border-blue-400/40 px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
                YOU
              </span>
              {isMyTurn && (
                <span className="text-[8px] font-cartoon text-yellow-300 uppercase tracking-widest mt-0.5 animate-pulse">
                  Your Turn!
                </span>
              )}
            </div>
          </div>

          {/* Bottom Center: Overlapping Fanned Card Hand (shifted down slightly for edge cropping) */}
          <div className="flex-1 flex justify-center max-w-[60vw] pb-0 px-4 pointer-events-auto overflow-visible">
            {myPlayer?.isEliminated ? (
              <div className="text-6xl font-cartoon text-red-900/30 uppercase italic tracking-wider mb-8 drop-shadow">
                Eliminated
              </div>
            ) : (
              <motion.div 
                layout
                className="flex flex-row transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] min-w-max h-44 items-end justify-center px-12 pt-4 overflow-visible"
              >
                <AnimatePresence mode="popLayout">
                  {myPlayer?.hand?.map((card, index) => {
                    const isSelected = selectedCardIds.includes(card.id);
                    const fan = getCardFanStyle(index);

                    return (
                      <motion.div 
                        key={card.id} 
                        layout
                        initial={{ scale: 0.5, opacity: 0, y: 100 }}
                        animate={{ 
                          scale: isSelected ? 1.15 : 1, 
                          opacity: 1,
                          rotate: isSelected ? 0 : fan.rotate,
                          y: isSelected ? -55 : fan.y,
                          x: isSelected ? 0 : fan.x,
                          zIndex: isSelected ? 50 : index + 10
                        }}
                        whileHover={(!isMyTurn && !isFavorVictim) || isExploding ? {} : { y: -50, scale: 1.15, zIndex: 100 }}
                        className="shrink-0 transition-transform origin-bottom overflow-visible"
                      >
                        <CardView 
                          card={card} 
                          layoutId={card.id}
                          onClick={() => toggleCardSelection(card.id)}
                          disabled={(!isMyTurn && !isFavorVictim) || isExploding}
                          className={`w-20 sm:w-24 h-30 sm:h-36 ${
                            isSelected 
                              ? 'ring-4 ring-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.6)]' 
                              : isFavorVictim 
                                ? 'ring-4 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] animate-pulse' 
                                : ''
                          }`}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Spacer to balance the player avatar on the left, keeping the hand centered */}
          <div className="w-36 shrink-0 hidden md:block" />

        </div>
      </div>

      {/* See The Future Overlay */}
      <AnimatePresence>
        {isSeeingFuture && gameState.futureCards && (
          <motion.div 
            key="see-future-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-3xl z-[60] flex flex-col items-center justify-center p-8 pointer-events-auto"
          >
              <motion.h2 initial={{ y: -20 }} animate={{ y: 0 }} className="text-4xl font-cartoon text-pink-500 mb-4 uppercase tracking-tighter italic">
                Seeing the Future
              </motion.h2>
              <p className="text-slate-400 mb-12 font-cartoon uppercase tracking-wider text-xs text-center">Top 3 cards of the deck (Left to Right)</p>
              
              <div className="flex justify-center gap-8 mb-16">
                 {gameState.futureCards.map((card, i) => (
                   <motion.div 
                      key={card.id} 
                      initial={{ y: 100, opacity: 0, rotate: -20 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      transition={{ delay: i * 0.2, type: "spring" }}
                   >
                      <CardView card={card} disabled className="shadow-[0_0_50px_rgba(236,72,153,0.3)] border-pink-500/30" />
                      <div className="mt-4 text-center">
                         <span className="text-[10px] font-cartoon text-pink-500 uppercase tracking-widest bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
                           Pos {i + 1}
                         </span>
                      </div>
                   </motion.div>
                 ))}
              </div>

              <button 
                onClick={handleConfirmFuture}
                className="px-12 py-4 rounded-full bg-white text-black font-cartoon uppercase tracking-widest hover:bg-pink-500 hover:text-white transition-all duration-500 shadow-2xl scale-110 active:scale-95"
              >
                Put Them Back
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosions & Alerts */}
      {gameState.waitingForDefuse && gameState.waitingForDefuse !== socketId && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-red-600/20 border border-red-500/50 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
           <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-cartoon text-white animate-pulse">
             {gameState.bombCountdown || 15}
           </div>
           <p className="font-cartoon text-red-200 uppercase tracking-wider text-[10px]">
             {gameState.players.find(p => p.id === gameState.waitingForDefuse)?.name} is defusing!
           </p>
        </div>
      )}

      {/* Stealing Instruction Banner */}
      {isStealer && victim && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-orange-600/90 border border-orange-500/50 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse">
           <span className="text-sm font-cartoon text-white uppercase tracking-wider">
             👉 Tap a card in {victim.name}'s hand at the top to steal! 👈
           </span>
        </div>
      )}

      {/* Action Window Overlay */}
      {renderActionWindow()}

      {/* Favor Request Overlay */}
      {renderFavorOverlay()}

      {/* Kaboom (Defuse Required) Overlay */}
      <AnimatePresence>
        {isExploding && isMyTurn && (
          <motion.div 
            key="kaboom-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/95 backdrop-blur-3xl flex flex-col items-center justify-center z-50 p-6 pointer-events-auto"
          >
              <h2 className="text-7xl md:text-9xl font-cartoon text-white mb-2 animate-bounce">KABOOM!</h2>
              <p className="text-lg text-red-200 font-cartoon mb-8 uppercase tracking-widest">Self-Destruction In {gameState.bombCountdown ?? 15}s</p>
              {hasDefuse ? (
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: 0 })} className="px-8 py-4 rounded-full bg-emerald-500 font-cartoon uppercase tracking-wider text-black transition-all hover:scale-105 active:scale-95 shadow-lg">Top</button>
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: 1 })} className="px-8 py-4 rounded-full bg-white/10 border border-white/20 font-cartoon uppercase tracking-wider transition-all hover:scale-105 active:scale-95 text-white">2nd</button>
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: Math.floor(Math.random() * 20) })} className="px-8 py-4 rounded-full bg-white/10 border border-white/20 font-cartoon uppercase tracking-wider transition-all hover:scale-105 active:scale-95 text-white">Random</button>
                </div>
              ) : <p className="text-3xl font-cartoon text-red-500 animate-pulse uppercase tracking-wider">No Defuse Card!</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theft Flying Animation (Being Stolen From) */}
      <AnimatePresence>
        {isBeingStolenFrom && (
          <motion.div 
            key={gameState.lastAction || "theft-animation"}
            initial={{ top: '80%', left: '50%', x: '-50%', y: '-50%', scale: 1, opacity: 1 }} 
            animate={{ 
              top: '8%',
              left: '50%',
              scale: 0.3,
              opacity: [1, 1, 0.9, 0]
            }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 1, times: [0, 0.7, 0.9, 1], ease: "easeInOut" }}
            className="absolute z-[100] pointer-events-none"
          >
              <CardView disabled />
          </motion.div>
        )}
      </AnimatePresence>



      {/* 3-of-a-Kind Guess Modal */}
      {showGuessModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center z-[90] p-4 pointer-events-auto">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-950 border border-slate-800 p-8 rounded-[3rem] max-w-xl w-full text-center shadow-2xl">
            <h3 className="text-3xl font-cartoon text-white mb-2 uppercase tracking-tighter">Guess Card</h3>
            <p className="text-slate-500 mb-6 text-xs font-cartoon uppercase tracking-widest">Select what they might have</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 max-h-[30vh] overflow-y-auto custom-scrollbar">
               {Object.values(CardType).filter(t => t !== 'EXPLODING_KITTEN').map(type => (
                 <button 
                   key={type} 
                   onClick={() => handlePlayCombo(type)} 
                   className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-orange-500 hover:text-white text-[10px] font-cartoon uppercase tracking-wider transition-all"
                 >
                   {type.replace(/_/g, ' ')}
                 </button>
               ))}
            </div>
            <button onClick={() => setShowGuessModal(false)} className="text-slate-500 hover:text-white font-cartoon uppercase tracking-widest text-xs transition-colors">Cancel</button>
          </motion.div>
        </div>
      )}

      {/* Floating Quick-Play Nope Button */}
      {gameState.status === 'PLAYING' && !myPlayer?.isEliminated && (
        <div className="absolute bottom-6 right-10 z-[80] pointer-events-auto">
          {(() => {
            let btnStyle = "";
            let statusText = "Standby";
            let clickHandler = () => {};
            let isBtnDisabled = true;

            if (!nopeCard) {
              btnStyle = "bg-slate-950/60 text-slate-600 border border-slate-900 cursor-not-allowed opacity-50";
              statusText = "No Nope";
            } else if (isNopeOpportunity) {
              btnStyle = "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white shadow-[0_0_40px_rgba(220,38,38,0.9)] border-2 border-red-400 animate-pulse cursor-pointer scale-110";
              statusText = "PLAY NOPE!";
              clickHandler = () => onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
              isBtnDisabled = false;
            } else {
              btnStyle = "bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-900/50 cursor-pointer shadow-[0_0_35px_rgba(220,38,38,0.35)]";
              statusText = "Nope Ready";
              clickHandler = () => alert("Wait for an action to Nope!");
              isBtnDisabled = false;
            }

            return (
              <motion.button
                whileHover={!isBtnDisabled ? { scale: 1.08, rotate: 3 } : {}}
                whileTap={!isBtnDisabled ? { scale: 0.95 } : {}}
                onClick={clickHandler}
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center font-cartoon uppercase transition-all duration-300 shadow-2xl ${btnStyle}`}
              >
                <span className="text-base sm:text-lg tracking-tighter">NOPE!</span>
                <span className="text-[8px] sm:text-[9px] font-bold opacity-75 mt-1">{statusText}</span>
              </motion.button>
            );
          })()}
        </div>
      )}

    </div>
  );
};
