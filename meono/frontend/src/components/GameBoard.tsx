import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType } from '../../../shared/src/types';
import type { GameState, PlayerAction } from '../../../shared/src/types';
import { CardView } from './CardView';

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
      const timer = setTimeout(() => setIsShuffling(false), 2000);
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

  const toggleCardSelection = (cardId: string) => {
    setActionError(null);
    if (isExploding || isStealer || isSeeingFuture || gameState.actionWindow) return;
    
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
    const showWindow = gameState.actionWindow && !(gameState.actionWindow.initiatorId === socketId && gameState.actionWindow.nopeCount === 0);
    const nopeCard = myPlayer?.hand?.find(c => c.type === CardType.NOPE);

    return (
      <AnimatePresence>
        {showWindow && (() => {
          const { actionName, nopeCount, targetName } = gameState.actionWindow!;
          const isNoped = nopeCount % 2 !== 0;

          return (
            <motion.div 
              key="action-window-modal"
              initial={{ opacity: 0, scale: 0.9, y: 30 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className={`absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm p-6 rounded-[2.5rem] border shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[70] flex flex-col items-center pointer-events-auto backdrop-blur-md ${isNoped ? 'bg-red-950/80 border-red-500/30' : 'bg-slate-950/85 border-blue-500/30'}`}
            >
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter italic">
                {isNoped ? "NOPED!" : "YUPPED!"}
              </h2>
              <div className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-widest text-center">
                Action: <span className="text-orange-400">{actionName}</span> {targetName && `on ${targetName}`}
              </div>
              
              <div className="text-xs font-black mb-3">
                Status: <span className={isNoped ? 'text-red-500' : 'text-emerald-500'}>{isNoped ? 'CANCELLED' : 'PROCEEDING'}</span>
                <span className="text-slate-400 font-normal ml-2">(Nopes: {nopeCount})</span>
              </div>

              {/* Simple progress bar mock */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-4">
                 <motion.div 
                    className="h-full bg-blue-500" 
                    initial={{ width: "100%" }} 
                    animate={{ width: "0%" }} 
                    transition={{ duration: 5, ease: "linear" }}
                    key={nopeCount} // Reset animation when nopeCount changes
                 />
              </div>

              <div className="flex gap-4 justify-center w-full">
                 <button 
                   disabled={!nopeCard}
                   onClick={() => nopeCard && onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id })}
                   className={`w-full py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all ${nopeCard ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                 >
                   NOPE! {nopeCard && '🃏'}
                 </button>
              </div>
              {!nopeCard && <p className="text-slate-500 text-[8px] mt-2 uppercase tracking-widest">You don't have a Nope card</p>}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    );
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
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-slate-900 border border-purple-500/30 rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(168,85,247,0.15)] z-40 text-center flex flex-col items-center justify-center"
          >
            <h2 className="text-2xl font-black text-purple-400 mb-1 uppercase tracking-tighter italic">
              FAVOR REQUESTED
            </h2>
            <p className="text-xs text-slate-300 font-bold uppercase tracking-widest mb-6">
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
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-full text-sm shadow-[0_0_30px_rgba(168,85,247,0.4)] uppercase tracking-wider transition-all hover:scale-102 active:scale-98"
                  >
                    Give "{selectedCard.name}"
                  </button>
                  <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest animate-pulse">Tap another card to change</span>
                </motion.div>
              ) : (
                <motion.div 
                  key="select-msg"
                  initial={{ y: 10, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -10, opacity: 0 }}
                  className="text-slate-500 text-xs font-bold uppercase tracking-widest border border-dashed border-white/10 rounded-2xl py-6 px-4 w-full"
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white">
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-6xl font-black text-orange-500 mb-8 uppercase tracking-widest drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]"
        >
          Game Over
        </motion.h1>
        <motion.p 
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.3 }}
           className="text-4xl font-bold"
        >
          {gameState.winner} won!
        </motion.p>
        <button onClick={() => window.location.reload()} className="mt-12 px-8 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors uppercase tracking-widest font-bold text-xs">Back to Lobby</button>
      </div>
    );
  }

  const leftOpponent = opponents[0];
  const topOpponent = opponents[1];
  const rightOpponent = opponents[2];
  const farRightOpponent = opponents[3];

  const renderOpponent = (opp: any, position: string) => {
    if (!opp) return null;
    const isTargeted = targetPlayerId === opp.id;
    const isTheirTurn = gameState.currentPlayerId === opp.id;
    const isStealing = gameState.lastTheft?.stealerId === opp.id;

    const renderCardStack = (isVertical: boolean) => (
      <div className={`flex ${isVertical ? 'flex-col -space-y-16' : 'flex-row -space-x-12'} mt-2`}>
        {Array.from({ length: Math.min(opp.handCount, 6) }).map((_, i) => (
          <div key={i} className="transform scale-[0.5] origin-center">
            <CardView disabled />
          </div>
        ))}
        {opp.handCount > 6 && (
          <div className="flex items-center justify-center font-bold text-slate-500 text-xs ml-2">
            +{opp.handCount - 6}
          </div>
        )}
      </div>
    );

    return (
      <motion.div 
        layout
        onClick={() => setTargetPlayerId(opp.id)}
        className={`flex flex-col items-center transition-all cursor-pointer p-4 rounded-[2rem] border ${opp.isEliminated ? 'opacity-30 grayscale' : ''} ${isTargeted ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.2)]' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}`}
      >
        <div className={`mb-2 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border transition-all ${isTheirTurn ? 'bg-orange-500 text-white border-orange-400 animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.5)]' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
          {opp.name} {opp.isEliminated && '☠️'}
        </div>
        {renderCardStack(position === 'left' || position === 'right')}
        {isStealing && <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="absolute -top-4 text-2xl">😈</motion.div>}
      </motion.div>
    );
  };

  return (
    <div 
      className="relative w-full min-h-[100dvh] bg-[#020202] text-white overflow-hidden font-sans select-none flex items-center justify-center"
      onPointerUp={() => {
        if (isDragging && selectedCardIds.length > 0) handlePlayCombo();
        setIsDragging(false);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1 && selectedCardIds.length > 0) setIsDragging(true);
      }}
    >
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-900/10 blur-[150px] pointer-events-none"></div>

      {/* Top Log */}
      <div className="absolute top-6 w-full text-center z-30 pointer-events-none">
        <motion.div 
          key={gameState.lastAction}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-block bg-black/60 px-8 py-3 rounded-full border border-white/10 backdrop-blur-3xl shadow-2xl"
        >
          <span className="text-slate-300 font-bold text-xs uppercase tracking-[0.2em]">
            {gameState.lastAction || "Awaiting action..."}
          </span>
        </motion.div>
      </div>

      {/* Opponents Layout */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
            {renderOpponent(topOpponent, 'top')}
          </div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
            {renderOpponent(leftOpponent, 'left')}
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
            {renderOpponent(rightOpponent, 'right')}
          </div>
          {farRightOpponent && (
             <div className="absolute bottom-48 right-8 z-10 pointer-events-auto">
                {renderOpponent(farRightOpponent, 'far-right')}
             </div>
          )}
      </div>

      {/* Center Table */}
      <div className={`relative w-full h-full flex items-center justify-center z-0 transition-all duration-700 ${isDragging ? 'bg-orange-500/[0.03]' : ''}`}>
        <div className={`w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] rounded-full flex items-center justify-center border transition-all duration-1000 ${isDragging ? 'bg-white/[0.03] border-orange-500/40 scale-110 shadow-[inset_0_0_100px_rgba(249,115,22,0.1)]' : 'bg-white/[0.01] border-white/5 shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]'}`}>
          
          <div className="flex flex-row items-center gap-8 sm:gap-16 pointer-events-auto">
            {/* Draw Pile */}
            <div className="flex flex-col items-center">
              <motion.button 
                animate={isShuffling ? { 
                  x: [0, -10, 10, -10, 10, 0],
                  rotate: [0, -5, 5, -5, 5, 0],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0 }}
                onClick={() => isMyTurn && !isExploding && onAction({ type: 'DRAW_CARD' })}
                disabled={!isMyTurn || isExploding}
                className="relative group transition-all duration-500"
              >
                <CardView disabled={!isMyTurn} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="bg-black/90 backdrop-blur-md rounded-full w-12 h-12 flex items-center justify-center border border-white/20 shadow-2xl group-hover:border-orange-500/50 transition-all">
                     <span className="font-black text-xl text-white">{gameState.drawPileCount}</span>
                   </div>
                </div>
              </motion.button>
              <span className="mt-4 font-black tracking-widest text-slate-600 uppercase text-[9px]">Draw</span>
            </div>

            {/* Discard Pile Real Stack */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 sm:w-32 h-36 sm:h-[192px]">
                {gameState.discardPile.length === 0 ? (
                  <div className="w-full h-full border border-dashed border-white/10 rounded-[1.5rem] flex items-center justify-center bg-white/[0.02]">
                    <span className="text-white/10 font-bold uppercase text-[9px]">Empty</span>
                  </div>
                ) : (
                  gameState.discardPile.map((card, i) => {
                    const isTop = i === gameState.discardPile.length - 1;
                    const rotation = (i * 13) % 25 - 12;
                    return (
                      <div 
                        key={card.id + i} 
                        className="absolute inset-0 transition-all duration-700"
                        style={{ transform: `rotate(${rotation}deg)`, zIndex: i }}
                      >
                        <CardView card={card} disabled={!isTop} layoutId={card.id} />
                      </div>
                    )
                  })
                )}
              </div>
              <span className="mt-4 font-black tracking-widest text-slate-600 uppercase text-[9px]">Discard</span>
            </div>
          </div>
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
            className="absolute inset-0 bg-black/80 backdrop-blur-3xl z-[60] flex flex-col items-center justify-center p-8"
          >
              <motion.h2 initial={{ y: -20 }} animate={{ y: 0 }} className="text-4xl font-black text-pink-500 mb-4 uppercase tracking-tighter italic">
                Seeing the Future
              </motion.h2>
              <p className="text-slate-400 mb-16 font-bold uppercase tracking-[0.3em] text-xs text-center">Top 3 cards of the deck (Left to Right)</p>
              
              <div className="flex justify-center gap-8 mb-20">
                 {gameState.futureCards.map((card, i) => (
                   <motion.div 
                      key={card.id} 
                      initial={{ y: 100, opacity: 0, rotate: -20 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      transition={{ delay: i * 0.2, type: "spring" }}
                   >
                      <CardView card={card} disabled className="shadow-[0_0_50px_rgba(236,72,153,0.3)] border-pink-500/30" />
                      <div className="mt-4 text-center">
                         <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
                           Pos {i + 1}
                         </span>
                      </div>
                   </motion.div>
                 ))}
              </div>

              <button 
                onClick={handleConfirmFuture}
                className="px-12 py-4 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] hover:bg-pink-500 hover:text-white transition-all duration-500 shadow-2xl scale-110 active:scale-95"
              >
                Put Them Back
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosions & Alerts */}
      {gameState.waitingForDefuse && gameState.waitingForDefuse !== socketId && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 bg-red-600/20 border border-red-500/50 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
           <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black text-white animate-pulse">
             {gameState.bombCountdown || 15}
           </div>
           <p className="font-bold text-red-200 uppercase tracking-widest text-[10px]">
             {gameState.players.find(p => p.id === gameState.waitingForDefuse)?.name} is defusing!
           </p>
        </div>
      )}

      {/* Action Window Overlay */}
      {renderActionWindow()}

      {/* Favor Request Overlay */}
      {renderFavorOverlay()}

      <AnimatePresence>
        {isExploding && isMyTurn && (
          <motion.div 
            key="kaboom-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/95 backdrop-blur-3xl flex flex-col items-center justify-center z-50 p-6"
          >
              <h2 className="text-7xl md:text-9xl font-black text-white mb-2 animate-bounce">KABOOM!</h2>
              <p className="text-lg text-red-200 font-bold mb-8 uppercase tracking-widest">Self-Destruction In {gameState.bombCountdown ?? 15}s</p>
              {hasDefuse ? (
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: 0 })} className="px-8 py-4 rounded-full bg-emerald-500 font-black uppercase tracking-wider text-black">Top</button>
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: 1 })} className="px-8 py-4 rounded-full bg-white/10 border border-white/20 font-black uppercase tracking-wider">2nd</button>
                  <button onClick={() => onAction({ type: 'DEFUSE', insertIndex: Math.floor(Math.random() * 20) })} className="px-8 py-4 rounded-full bg-white/10 border border-white/20 font-black uppercase tracking-wider">Random</button>
                </div>
              ) : <p className="text-3xl font-black text-red-500 animate-pulse">NO DEFUSE CARD!</p>}
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
              top: gameState.lastTheft?.stealerId === opponents[0]?.id ? '50%' : 
                   gameState.lastTheft?.stealerId === opponents[1]?.id ? '15%' : 
                   gameState.lastTheft?.stealerId === opponents[2]?.id ? '50%' : 
                   gameState.lastTheft?.stealerId === opponents[3]?.id ? '70%' : '50%',
              left: gameState.lastTheft?.stealerId === opponents[0]?.id ? '10%' : 
                    gameState.lastTheft?.stealerId === opponents[1]?.id ? '50%' : 
                    gameState.lastTheft?.stealerId === opponents[2]?.id ? '90%' : 
                    gameState.lastTheft?.stealerId === opponents[3]?.id ? '90%' : '50%',
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

      {/* Interactive Steal Overlay (When I AM stealing) */}
      <AnimatePresence>
        {isStealer && victim && (
          <motion.div 
            key="steal-overlay"
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }} 
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-lg bg-slate-900/95 border border-orange-500/30 rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(249,115,22,0.2)] z-40 text-center flex flex-col items-center justify-center"
          >
              <h2 className="text-xl font-black text-white mb-1 uppercase tracking-tighter italic">
                Stealing from {victim.name}
              </h2>
              <p className="text-xs text-slate-400 mb-6 font-bold uppercase tracking-widest">Pick a card from their hand</p>
              
              <div className="flex flex-wrap justify-center -space-x-12 sm:-space-x-16 hover:space-x-2 transition-all duration-300">
                 {Array.from({ length: victim.handCount }).map((_, i) => (
                   <motion.div 
                      key={i} 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -15, scale: 1.05, zIndex: 10 }}
                      className="relative cursor-pointer"
                      onClick={() => handleStealPick(i)}
                    >
                      <div className="transform scale-[0.7] origin-center">
                        <CardView className="border-orange-500/30 hover:border-orange-500 shadow-xl" />
                      </div>
                   </motion.div>
                 ))}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-of-a-Kind Modal */}
      {showGuessModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-700 p-10 rounded-[3rem] max-w-xl w-full text-center shadow-2xl">
            <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter">Guess Card</h3>
            <p className="text-slate-500 mb-8 text-xs font-bold uppercase tracking-widest">Select what they might have</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 max-h-[30vh] overflow-y-auto custom-scrollbar">
               {Object.values(CardType).filter(t => t !== 'EXPLODING_KITTEN').map(type => (
                 <button key={type} onClick={() => handlePlayCombo(type)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-orange-500 hover:text-white text-[10px] font-black uppercase transition-all">
                   {type.replace(/_/g, ' ')}
                 </button>
               ))}
            </div>
            <button onClick={() => setShowGuessModal(false)} className="text-slate-600 hover:text-white font-black uppercase tracking-widest text-[10px]">Cancel</button>
          </motion.div>
        </div>
      )}

      {/* Bottom Bar: Player Hand */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-black via-black/95 to-transparent pt-48 z-20 pointer-events-none">
        
        <AnimatePresence>
          {selectedCardIds.length > 0 && !isExploding && !isFavorVictim && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-full mb-8 flex flex-col items-center pointer-events-auto">
              <button 
                onClick={() => handlePlayCombo()}
                className="bg-orange-500 hover:bg-orange-400 text-white font-black px-12 py-4 rounded-full text-xl shadow-[0_0_50px_rgba(249,115,22,0.4)] uppercase tracking-[0.2em] transition-all hover:scale-105"
              >
                Play ({selectedCardIds.length})
              </button>
              <span className="text-[10px] text-orange-400 mt-2 font-bold uppercase tracking-[0.3em] animate-pulse">Swipe up to release</span>
            </motion.div>
          )}
        </AnimatePresence>

        {actionError && (
          <div className="px-4 py-2 rounded-xl bg-red-950/80 border border-red-500/30 text-red-400 font-bold uppercase tracking-wider text-[10px] mb-4 pointer-events-auto">
            {actionError}
          </div>
        )}

        <div className={`px-6 py-2 rounded-full font-black uppercase tracking-[0.2em] text-[10px] mb-8 border backdrop-blur-3xl transition-all duration-1000 pointer-events-auto ${isMyTurn ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.3)]" : "bg-white/5 text-slate-600 border-white/5"}`}>
          {isMyTurn ? `Your Action Phase ${myPlayer?.turnsToPlay && myPlayer.turnsToPlay > 1 ? `(${myPlayer.turnsToPlay} Turns Left)` : ''}` : "Waiting for Bot..."}
        </div>
        
        {myPlayer?.isEliminated ? (
          <div className="text-6xl font-black text-red-900/20 uppercase italic tracking-tighter mb-12">Dead</div>
        ) : (
          <div className="w-full max-w-[100vw] overflow-x-auto pb-12 px-12 custom-scrollbar pointer-events-auto">
            <motion.div 
              layout
              className={`flex flex-row transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${myPlayer?.hand && myPlayer.hand.length > 7 ? 'gap-3 justify-start' : 'sm:-space-x-16 justify-center hover:space-x-2'} min-w-max px-32`}
            >
              <AnimatePresence mode="popLayout">
                {myPlayer?.hand?.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  return (
                    <motion.div 
                      key={card.id} 
                      layout
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ 
                        scale: isSelected ? 1.1 : 1, 
                        opacity: 1,
                        y: isSelected ? -40 : 0,
                        zIndex: isSelected ? 50 : 1
                      }}
                      className="shrink-0"
                    >
                      <CardView 
                        card={card} 
                        layoutId={card.id}
                        onClick={() => toggleCardSelection(card.id)}
                        disabled={(!isMyTurn && !isFavorVictim) || isExploding}
                        className={`${isSelected ? 'ring-2 ring-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.5)]' : ''} ${isFavorVictim ? 'ring-2 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse' : ''}`}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>

      {/* Fixed Floating Quick-Play Nope Button */}
      {gameState.status === 'PLAYING' && !myPlayer?.isEliminated && (
        <div className="fixed bottom-36 right-8 z-[80] flex flex-col items-center gap-2 pointer-events-auto">
          {(() => {
            const nopeCard = myPlayer?.hand?.find(c => c.type === CardType.NOPE);
            const isWindowActive = !!gameState.actionWindow && !(gameState.actionWindow.initiatorId === socketId && gameState.actionWindow.nopeCount === 0) && gameState.actionWindow.lastNoperId !== socketId;
            
            let btnStyle = "";
            let statusText = "STANDBY";
            let clickHandler = () => {};
            let isBtnDisabled = true;

            if (!nopeCard) {
              btnStyle = "bg-slate-900/40 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50";
              statusText = "NO NOPE";
            } else if (isWindowActive) {
              btnStyle = "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_40px_rgba(220,38,38,0.8)] border border-red-500 scale-110 active:scale-95 animate-pulse cursor-pointer";
              statusText = "PLAY NOPE!";
              clickHandler = () => onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
              isBtnDisabled = false;
            } else {
              btnStyle = "bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/50 cursor-pointer shadow-[0_0_20px_rgba(220,38,38,0.1)]";
              statusText = "NOPE READY";
              clickHandler = () => alert("Wait for an action to Nope!");
              isBtnDisabled = false;
            }

            return (
              <motion.button
                whileHover={!isBtnDisabled ? { scale: 1.05 } : {}}
                whileTap={!isBtnDisabled ? { scale: 0.95 } : {}}
                onClick={clickHandler}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center font-black uppercase transition-all duration-300 ${btnStyle}`}
              >
                <span className="text-sm sm:text-base tracking-tighter">NOPE!</span>
                <span className="text-[7px] sm:text-[9px] font-bold opacity-75 mt-1">{statusText}</span>
              </motion.button>
            );
          })()}
        </div>
      )}
    </div>
  );
};
