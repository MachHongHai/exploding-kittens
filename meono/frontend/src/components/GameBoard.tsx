import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardType } from '../../../shared/src/types';
import type { GameState, PlayerAction } from '../../../shared/src/types';
import { CardView } from './CardView';
import { CountdownOverlay } from './CountdownOverlay';
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
  const showTargetModal = gameState.waitingForTarget && gameState.waitingForTarget.playerId === socketId
    ? { type: gameState.waitingForTarget.type, cardIds: [] as string[] }
    : null;


  const [actionError, setActionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null);
  const [showDefuseSuccess, setShowDefuseSuccess] = useState(false);
  const [comboEffect, setComboEffect] = useState<{ type: string; count: number } | null>(null);
  const [actionPopup, setActionPopup] = useState<{ text: string; color: string } | null>(null);

  // Kitten Chance states
  const totalCards = gameState.drawPileCount;
  const kittens = gameState.explodingKittensCount ?? 0;
  const kittenPercent = totalCards > 0 ? Math.round((kittens / totalCards) * 100) : 0;

  const [prevKittenPercent, setPrevKittenPercent] = useState(kittenPercent);
  const [shouldJoltDial, setShouldJoltDial] = useState(false);
  const [joltType, setJoltType] = useState<'increase' | 'decrease' | null>(null);
  const [needleJitter, setNeedleJitter] = useState(0);

  // Wiggle needle when danger is high (>50%)
  useEffect(() => {
    if (kittenPercent > 50) {
      const interval = setInterval(() => {
        const magnitude = kittenPercent > 75 ? 2.2 : 1.2;
        setNeedleJitter((Math.random() - 0.5) * magnitude);
      }, 70);
      return () => {
        clearInterval(interval);
        setNeedleJitter(0);
      };
    } else {
      setNeedleJitter(0);
    }
  }, [kittenPercent]);

  // Trigger container shake/jolt when percentage shifts
  useEffect(() => {
    if (kittenPercent !== prevKittenPercent) {
      if (kittenPercent > prevKittenPercent) {
        setJoltType('increase');
        setShouldJoltDial(true);
      } else {
        setJoltType('decrease');
        setShouldJoltDial(true);
      }
      setPrevKittenPercent(kittenPercent);
      const timer = setTimeout(() => {
        setShouldJoltDial(false);
        setJoltType(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [kittenPercent, prevKittenPercent]);
  
  // Watch for shuffle animation (ONLY when resolved)
  useEffect(() => {
    if (gameState.lastAction === "Deck shuffled.") {
      setIsShuffling(true);
      const timer = setTimeout(() => setIsShuffling(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsShuffling(false);
    }
  }, [gameState.lastAction]);

  // Watch for action cards played to show big text popup
  useEffect(() => {
    const action = gameState.lastAction || '';
    if (action.includes('played Shuffle')) {
      setActionPopup({ text: 'SHUFFLE!', color: 'from-orange-400 to-red-600' });
    } else if (action.includes('played Attack')) {
      setActionPopup({ text: 'ATTACK!', color: 'from-red-500 to-red-800' });
    } else if (action.includes('played Skip')) {
      setActionPopup({ text: 'SKIP!', color: 'from-blue-400 to-blue-700' });
    } else if (action.includes('played See The Future')) {
      setActionPopup({ text: 'SEE THE FUTURE!', color: 'from-fuchsia-400 to-purple-700' });
    } else if (action.includes('played Favor') || action.includes('for Favor!')) {
      setActionPopup({ text: 'FAVOR!', color: 'from-amber-600 to-orange-800' });
    } else if (action.includes('played Nope') || action.includes('NOPED')) {
      setActionPopup({ text: 'NOPE!', color: 'from-red-600 to-stone-900' });
    } else {
      return;
    }
    const timer = setTimeout(() => setActionPopup(null), 2000);
    return () => clearTimeout(timer);
  }, [gameState.lastAction]);

  // Watch for player elimination
  useEffect(() => {
    const eliminated = gameState.players.find(p => p.isEliminated && p.id !== eliminatedPlayerId);
    if (eliminated && (gameState.lastAction?.includes('eliminated') || gameState.lastAction?.includes('exploded'))) {
      setEliminatedPlayerId(eliminated?.id || null);
      const timer = setTimeout(() => setEliminatedPlayerId(null), 4000);
      return () => clearTimeout(timer);
    } else if (!gameState.lastAction?.includes('eliminated') && !gameState.lastAction?.includes('exploded')) {
      setEliminatedPlayerId(null);
    }
  }, [gameState.lastAction]);

  // Watch for defuse success
  useEffect(() => {
    if (gameState.lastAction?.includes('defused') || gameState.lastAction?.includes('Defuse')) {
      if (!gameState.waitingForDefuse) {
        setShowDefuseSuccess(true);
        const timer = setTimeout(() => setShowDefuseSuccess(false), 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowDefuseSuccess(false);
    }
  }, [gameState.lastAction, gameState.waitingForDefuse]);

  // Watch for combo plays
  useEffect(() => {
    const action = gameState.lastAction || '';
    // If the action is a Nope, do not trigger combo effect even if it mentions the combo name
    if (action.includes('NOPED') || action.includes('Nope') || action.includes('noped')) {
      setComboEffect(null);
      return;
    }
    
    if (action.includes('Pair') || action.includes('pair') || action.includes('2 of')) {
      setComboEffect({ type: 'pair', count: 2 });
    } else if (action.includes('Three') || action.includes('three') || action.includes('3 of')) {
      setComboEffect({ type: 'triple', count: 3 });
    } else {
      setComboEffect(null);
      return;
    }
    const timer = setTimeout(() => setComboEffect(null), 2500);
    return () => clearTimeout(timer);
  }, [gameState.lastAction]);

  // Clear action error after 3 seconds
  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  const myPlayer = gameState.players.find(p => p.id === socketId);
  const opponents = gameState.players.filter(p => p.id !== socketId);
  
  const isMyTurn = gameState.currentPlayerId === socketId && gameState.status === 'PLAYING';
  const isExploding = gameState.waitingForDefuse === socketId;
  const hasDefuse = myPlayer?.hand?.some(c => c.type === CardType.DEFUSE);

  const [showYourTurn, setShowYourTurn] = useState(false);

  useEffect(() => {
    if (isMyTurn) {
      setShowYourTurn(true);
      const timer = setTimeout(() => setShowYourTurn(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowYourTurn(false);
    }
  }, [isMyTurn]);



  const [defuseInsertIndex, setDefuseInsertIndex] = useState<number>(0);

  // Reset defuse index when exploding state changes
  useEffect(() => {
    if (isExploding) {
      setDefuseInsertIndex(0);
    }
  }, [isExploding]);

  // Future logic
  const isSeeingFuture = !!gameState.futureCards;

  // Auto-close See The Future after 3 seconds
  useEffect(() => {
    if (isSeeingFuture && gameState.futureCards) {
      const timer = setTimeout(() => {
        onAction({ type: 'CONFIRM_FUTURE' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSeeingFuture, gameState.futureCards, onAction]);

  // Stealing logic
  const isStealer = gameState.waitingForSteal?.stealerId === socketId;
  const victimId = gameState.waitingForSteal?.victimId;
  const victim = gameState.players.find(p => p.id === victimId);

  // Favor logic
  const isFavorVictim = gameState.waitingForFavor?.victimId === socketId;
  const favorRequester = gameState.players.find(p => p.id === gameState.waitingForFavor?.requesterId);

  // Theft animation logic (for when I'M being stolen from BLINDLY via Pairs)
  const isBeingStolenFrom = gameState.lastTheft?.victimId === socketId && !gameState.waitingForFavor;

  const isLocalPlayerTargeted = !!gameState.actionWindow && 
    gameState.actionWindow.targetName === myPlayer?.name;

  // Helper properties to identify any valid Nope opportunity
  const nopeCard = myPlayer?.hand?.find(c => c.type === CardType.NOPE);
  const isWindowActive = !!gameState.actionWindow && !(gameState.actionWindow.initiatorId === socketId && gameState.actionWindow.nopeCount === 0) && gameState.actionWindow.lastNoperId !== socketId;
  
  let activeExpiresAt: number | undefined;
  let countdownLabel = '';

  if (gameState.waitingForTarget?.playerId === socketId && gameState.waitingForTarget?.expiresAt) {
    activeExpiresAt = gameState.waitingForTarget.expiresAt;
    countdownLabel = 'Select Target';
  } else if (gameState.waitingForSteal?.stealerId === socketId && gameState.waitingForSteal?.expiresAt) {
    activeExpiresAt = gameState.waitingForSteal.expiresAt;
    countdownLabel = 'Pick a Card';
  } else if (gameState.waitingForFavor?.victimId === socketId && gameState.waitingForFavor?.expiresAt) {
    activeExpiresAt = gameState.waitingForFavor.expiresAt;
    countdownLabel = 'Give a Card';
  } else if (
    isMyTurn && 
    gameState.turnExpiresAt && 
    !gameState.pendingAction &&
    !gameState.waitingForTarget &&
    !gameState.waitingForSteal &&
    !gameState.waitingForFavor &&
    !gameState.waitingForDefuse &&
    !isSeeingFuture
  ) {
    activeExpiresAt = gameState.turnExpiresAt;
    countdownLabel = 'Your Turn';
  }
  
  // Late Nope opportunities (after action window has resolved)
  const isAttackOrSkipNopeable = !!gameState.lastNopeableAction &&
    (gameState.lastNopeableAction.type === 'ATTACK' || gameState.lastNopeableAction.type === 'SKIP') &&
    gameState.currentPlayerId === socketId &&
    gameState.lastNopeableAction.initiatorId !== socketId;

  const isResolvedNopeNopeable = !!gameState.lastNopeableAction &&
    gameState.lastNopeableAction.type === 'NOPE' &&
    gameState.lastNopeableAction.initiatorId !== socketId;

  const isStealOrFavorNopeable = !!gameState.lastNopeableAction &&
    (gameState.lastNopeableAction.type === '2-CARD' || 
     gameState.lastNopeableAction.type === '3-CARD' || 
     gameState.lastNopeableAction.type === 'FAVOR') &&
    gameState.lastNopeableAction.targetId === socketId;
  
  const isNopeOpportunity = !gameState.waitingForDefuse && (
    isWindowActive || 
    (gameState.waitingForFavor?.victimId === socketId) || 
    (gameState.waitingForSteal?.victimId === socketId) || 
    isBeingStolenFrom || 
    isAttackOrSkipNopeable ||
    isResolvedNopeNopeable ||
    isStealOrFavorNopeable
  );

  const toggleCardSelection = (cardId: string) => {
    setActionError(null);

    // Quick-play Nope card directly from hand during any active Nope opportunity
    if (isNopeOpportunity && nopeCard && cardId === nopeCard.id) {
      onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
      return;
    }


    if (isExploding || isStealer || isSeeingFuture) return;
    
    // If being asked for a favor, select the card to give
    if (isFavorVictim) {
      setSelectedCardIds([cardId]); // Only one card for favor
      return;
    }

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



  const renderFavorOverlay = () => {
    const showFavor = isFavorVictim && favorRequester;
    const selectedCard = myPlayer?.hand?.find(c => c.id === selectedCardIds[0]);

    return (
      <AnimatePresence>
        {showFavor && (
          <motion.div 
            key="favor-overlay"
            initial={{ opacity: 0, scale: 0.85, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-purple-950/95 border border-purple-500/30 rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(168,85,247,0.4)] z-40 text-center flex flex-col items-center justify-center pointer-events-auto relative overflow-hidden"
          >
            {/* Floating particles */}
            <motion.div 
              className="absolute w-40 h-40 rounded-full bg-purple-600/10 blur-[60px] -top-10 -left-10"
              animate={{ scale: [1, 1.4, 1], rotate: [0, 90, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div 
              className="absolute w-32 h-32 rounded-full bg-fuchsia-500/10 blur-[50px] -bottom-8 -right-8"
              animate={{ scale: [1.2, 1, 1.2], rotate: [0, -90, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <motion.span 
              className="text-4xl mb-2"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              🤝
            </motion.span>
            <h2 className="text-2xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 mb-1 uppercase tracking-tighter italic relative z-10">
              FAVOR REQUESTED
            </h2>
            <p className="text-xs text-slate-300 font-cartoon uppercase tracking-widest mb-6 relative z-10">
              Give <span className="text-white bg-purple-500/30 px-2 py-0.5 rounded border border-purple-500/50">{favorRequester.name}</span> a card
            </p>

            <AnimatePresence mode="wait">
              {selectedCard ? (
                <motion.div 
                  key="give-btn"
                  initial={{ y: 15, opacity: 0, scale: 0.9 }} 
                  animate={{ y: 0, opacity: 1, scale: 1 }} 
                  exit={{ y: -15, opacity: 0, scale: 0.9 }} 
                  transition={{ type: 'spring', stiffness: 120, damping: 12 }}
                  className="flex flex-col items-center gap-4 w-full relative z-10"
                >
                  <motion.button 
                    onClick={handleGiveCard}
                    whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(168,85,247,0.6)' }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-cartoon py-3.5 rounded-full text-sm shadow-[0_0_30px_rgba(168,85,247,0.4)] uppercase tracking-wider transition-all border border-purple-400/30"
                  >
                    ✨ Give "{selectedCard.name}" ✨
                  </motion.button>
                  <span className="text-[9px] text-purple-400 font-cartoon uppercase tracking-widest animate-pulse">Tap another card to change</span>
                </motion.div>
              ) : (
                <motion.div 
                  key="select-msg"
                  initial={{ y: 15, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -15, opacity: 0 }}
                  className="text-slate-500 text-xs font-cartoon uppercase tracking-widest border border-dashed border-white/10 rounded-2xl py-6 px-4 w-full relative z-10"
                >
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    👇 Select a card from your hand below...
                  </motion.span>
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
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
    } else if (selectedCards.length === 2) {
      if (!isSameType) { setActionError("Pairs must be the same card type!"); return; }
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
    } else if (selectedCards.length === 3) {
      if (!isSameType) { setActionError("3 of a kind must be the same card type!"); return; }
      if (!requestedCardType) {
        action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
      } else {
        action = { type: 'PLAY_CARDS', cardIds: selectedCardIds, targetId: targetPlayerId || undefined, requestedCardType };
      }
    } else {
      setActionError("Invalid combination length!");
      return;
    }

    if (action) {
      onAction(action, (res) => {
        if (res && !res.success) {
          if (res.message !== "An action is currently waiting for Nope!") {
            setActionError(res.message);
          }
          setSelectedCardIds([]);
        } else {
          setSelectedCardIds([]);
          setTargetPlayerId(null);
          setShowGuessModal(false);
          setActionError(null);
        }
      });
    }
  };

  const submitTargetAction = (targetId: string) => {
    if (!showTargetModal) return;
    
    setTargetPlayerId(targetId);
    
    const { type } = showTargetModal;
    
    if (type === '3-CARD') {
      setShowGuessModal(true);
      return;
    }

    // For FAVOR and 2-CARD, immediately dispatch SELECT_TARGET action
    onAction({ type: 'SELECT_TARGET', targetId }, (res) => {
      if (res && !res.success) {
        setActionError(res.message);
      }
      setSelectedCardIds([]);
      setTargetPlayerId(null);
      setActionError(null);
    });
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

  const needleRotation = -90 + (kittenPercent * 1.8) + needleJitter;
  const ledPulseDuration = kittenPercent > 75 ? '0.3s' : kittenPercent > 50 ? '0.6s' : kittenPercent > 25 ? '1.2s' : '2s';

  const actionHistory = gameState.actionHistory || [];

  const N = myPlayer?.hand?.length || 0;
  const getCardFanStyle = (index: number) => {
    if (N <= 1) return { rotate: 0, y: -10, x: 0 };
    const mid = (N - 1) / 2;
    const spread = Math.min(22 / N, 5.5);
    const rotate = (index - mid) * spread;
    const y = Math.abs(index - mid) * Math.abs(index - mid) * 2 - 10; // Shifts baseline upward so cards are fully visible
    const x = (index - mid) * -26; // Pulls cards closer for overlap (increased from -18 for larger cards)
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
          className="group relative inline-flex items-center justify-center px-5 py-2.5 font-cartoon text-xs tracking-widest text-white uppercase bg-red-950/40 border border-red-500/30 rounded-full overflow-hidden transition-all hover:bg-red-900/60 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.2)] shrink-0 backdrop-blur-sm"
        >
          <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-red-500 rounded-full group-hover:w-32 group-hover:h-32 opacity-20"></span>
          <span className="relative">Leave Game</span>
        </button>

        {/* Opponent Row (centered & spaced out at top) */}
        <div className="flex-1 flex items-center justify-evenly px-4 md:px-12 max-w-7xl mx-auto w-full gap-8 md:gap-16">
          {opponents.map((opp, idx) => {
            const isTargeted = targetPlayerId === opp.id;
            const isTheirTurn = gameState.currentPlayerId === opp.id;
            const isStealing = gameState.lastTheft?.stealerId === opp.id;
            const isTargetedByActionWindow = !!gameState.actionWindow && 
              gameState.actionWindow.targetName === opp.name;

            // Define themed styles (similar to OTHO, ADAM, BARBARA, LYDIA)
            let nameColor = "text-amber-100";
            let circleColor = "border-amber-900/60 bg-amber-950/40 text-white";
            const themeIndex = idx % 3;
            
            if (opp.isEliminated) {
              nameColor = "text-stone-400";
              circleColor = "border-stone-600 bg-stone-900/20 opacity-50 text-stone-500";
            } else {
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

            const isValidTarget = !!showTargetModal && !opp.isEliminated && opp.handCount > 0;

            return (
              <motion.div 
                key={opp.id}
                layout
                onClick={() => isValidTarget && submitTargetAction(opp.id)}
                whileHover={isValidTarget ? { scale: 1.08, y: -4 } : {}}
                whileTap={isValidTarget ? { scale: 0.96 } : {}}
                className={`flex flex-col items-center relative shrink-0 transition-all duration-200 ${
                  opp.isEliminated ? 'opacity-50' : ''
                } ${isValidTarget ? 'cursor-pointer z-30' : ''}`}
              >
                {/* Opponent Name above the circle */}
                <span className={`font-cartoon text-xs font-bold ${nameColor} uppercase tracking-wider mb-2 drop-shadow`}>
                  {opp.name}
                </span>

                {/* Avatar Badge & overlapping card fan relative wrapper */}
                <div className="relative w-22 h-22 flex items-center justify-center shrink-0">
                  {/* Target Lock Overlay (Rotating Dashed Ring & Glowing Aura) */}
                  {isValidTarget && (
                    <>
                      {/* Rotating Dashed Circle */}
                      <motion.div 
                        className={`absolute -inset-2.5 rounded-full border-4 border-dashed pointer-events-none z-10 ${
                          showTargetModal?.type === 'FAVOR' 
                            ? 'border-purple-500' 
                            : showTargetModal?.type === '2-CARD' 
                              ? 'border-orange-500' 
                              : 'border-fuchsia-500'
                        }`}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      />
                      
                      {/* Outer Glowing Ring */}
                      <motion.div 
                        className={`absolute -inset-3 rounded-full pointer-events-none z-0 opacity-70 ${
                          showTargetModal?.type === 'FAVOR' 
                            ? 'shadow-[0_0_20px_rgba(168,85,247,0.7)]' 
                            : showTargetModal?.type === '2-CARD' 
                              ? 'shadow-[0_0_20px_rgba(249,115,22,0.7)]' 
                              : 'shadow-[0_0_20px_rgba(217,70,239,0.7)]'
                        }`}
                        animate={{ scale: [0.95, 1.05, 0.95] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* Pulsing Radar Glow Backdrop */}
                      <div 
                        className={`absolute -inset-4 rounded-full blur-md -z-10 opacity-40 animate-pulse ${
                          showTargetModal?.type === 'FAVOR' 
                            ? 'bg-purple-500' 
                            : showTargetModal?.type === '2-CARD' 
                              ? 'bg-orange-500' 
                              : 'bg-fuchsia-500'
                        }`}
                      />
                    </>
                  )}

                  {/* Glowing aura around active player circle */}
                  {isTheirTurn && !opp.isEliminated && (
                    <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full blur opacity-75 animate-pulse -z-10"></div>
                  )}

                  {/* Glowing aura around targeted player circle under action window */}
                  {isTargetedByActionWindow && !opp.isEliminated && (
                    <div className="absolute -inset-3 bg-red-600 rounded-full blur opacity-75 animate-ping -z-10"></div>
                  )}

                  {/* Turn/Target Indicator Badge */}
                  {isTheirTurn && !opp.isEliminated && (
                    <div className="absolute -top-4 bg-orange-600 border border-orange-400 text-white font-cartoon text-[8px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider animate-bounce z-30 font-bold">
                      TURNS: {opp.turnsToPlay}
                    </div>
                  )}
                  {isTargetedByActionWindow && !opp.isEliminated && !isTheirTurn && (
                    <div className="absolute -top-4 bg-red-600 border border-red-400 text-white font-cartoon text-[8px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider animate-pulse z-30 font-bold">
                      🎯 TARGETED!
                    </div>
                  )}
                  {isValidTarget && (
                    <div 
                      className={`absolute -top-4 border text-white font-cartoon text-[8px] px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider animate-bounce z-30 font-bold ${
                        showTargetModal?.type === 'FAVOR' 
                          ? 'bg-purple-600 border-purple-400 shadow-purple-500/50' 
                          : showTargetModal?.type === '2-CARD' 
                            ? 'bg-orange-600 border-orange-400 shadow-orange-500/50' 
                            : 'bg-fuchsia-600 border-fuchsia-400 shadow-fuchsia-500/50'
                      }`}
                    >
                      🎯 Target
                    </div>
                  )}

                  {/* Circular Badge */}
                  <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center shadow-md relative overflow-hidden transition-all duration-300 ${circleColor} ${
                    isValidTarget 
                      ? showTargetModal?.type === 'FAVOR'
                        ? 'border-purple-400 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                        : showTargetModal?.type === '2-CARD'
                          ? 'border-orange-400 ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.5)]'
                          : 'border-fuchsia-400 ring-2 ring-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.5)]'
                      : isTargetedByActionWindow && !opp.isEliminated
                        ? 'ring-4 ring-red-500 animate-pulse border-red-400 scale-105 shadow-[0_0_25px_rgba(239,68,68,0.7)]'
                        : isTheirTurn && !opp.isEliminated
                          ? 'ring-4 ring-yellow-400 animate-pulse border-yellow-300'
                          : ''
                  }`}>
                    {opp.isEliminated ? (
                      <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-3 7c-.55 0-1-.45-1-1 0-1.66 1.34-3 3-3 .55 0 1 .45 1 1s-.45 1-1 1c-.55 0-1 .45-1 1 0 .55-.45 1-1 1zm6 0c-.55 0-1-.45-1-1 0-.55-.45-1-1-1s-1 .45-1 1c0 1.66 1.34 3 3 3 .55 0 1-.45 1-1s-.45-1-1-1z" />
                      </svg>
                    ) : (
                      <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Ears */}
                        <path d="M20 50 L20 15 L45 35 Z" fill="currentColor" opacity="0.9" />
                        <path d="M80 50 L80 15 L55 35 Z" fill="currentColor" opacity="0.9" />
                        {/* Inner Ears */}
                        <path d="M25 42 L25 25 L40 35 Z" fill="rgba(255,255,255,0.3)" />
                        <path d="M75 42 L75 25 L60 35 Z" fill="rgba(255,255,255,0.3)" />
                        {/* Head */}
                        <circle cx="50" cy="55" r="35" fill="currentColor" />
                        {/* Eyes */}
                        {themeIndex === 0 ? (
                          <>
                            {/* OTHO (Angry/Determined) */}
                            <path d="M30 45 L45 55" stroke="white" strokeWidth="4" strokeLinecap="round" />
                            <path d="M70 45 L55 55" stroke="white" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="38" cy="55" r="4" fill="white" />
                            <circle cx="62" cy="55" r="4" fill="white" />
                          </>
                        ) : themeIndex === 1 ? (
                          <>
                            {/* ADAM (Crazy/Wide-eyed) */}
                            <circle cx="35" cy="50" r="8" fill="white" />
                            <circle cx="65" cy="50" r="12" fill="white" />
                            <circle cx="35" cy="50" r="3" fill="black" />
                            <circle cx="65" cy="50" r="4" fill="black" />
                          </>
                        ) : (
                          <>
                            {/* BARBARA (Cute/Innocent) */}
                            <circle cx="35" cy="52" r="7" fill="white" />
                            <circle cx="65" cy="52" r="7" fill="white" />
                            <circle cx="37" cy="50" r="3" fill="black" />
                            <circle cx="63" cy="50" r="3" fill="black" />
                            {/* Blush */}
                            <circle cx="25" cy="60" r="5" fill="rgba(255,100,150,0.5)" />
                            <circle cx="75" cy="60" r="5" fill="rgba(255,100,150,0.5)" />
                          </>
                        )}
                        {/* Nose and Mouth */}
                        <polygon points="47,65 53,65 50,68" fill="rgba(0,0,0,0.5)" />
                        <path d="M50 68 Q45 75 40 70 M50 68 Q55 75 60 70" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" fill="none" />
                      </svg>
                    )}
                  </div>

                  {/* Card Hand Tray (Red overlapping cards, placed *in front* of the bottom of the circle) */}
                  {!opp.isEliminated && (
                    (() => {
                      const isStealTarget = isStealer && opp.id === victimId;
                      const bottomOffset = isStealTarget ? '-60px' : '-16px';
                      const gap = isStealTarget 
                        ? (opp.handCount > 5 ? '-28px' : '-16px') 
                        : (opp.handCount > 5 ? `-${Math.min(24, 12 + (opp.handCount - 5) * 1.5)}px` : '-12px');

                      return (
                        <div 
                          className={`absolute left-1/2 -translate-x-1/2 flex justify-center z-20 ${
                            isStealTarget ? 'pointer-events-auto' : 'pointer-events-none'
                          }`}
                          style={{ 
                            bottom: bottomOffset,
                            gap: gap,
                            transition: 'bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), gap 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                          }}
                        >
                          {opp.handCount > 0 && Array.from({ length: opp.handCount }).map((_, cardIdx) => {
                            const mid = (opp.handCount - 1) / 2;
                            const rotation = (cardIdx - mid) * (isStealTarget ? 8 : (opp.handCount > 8 ? 8 : 12));
                            const translateY = Math.abs(cardIdx - mid) * (isStealTarget ? 3 : 1.5);
                            
                            return (
                              <motion.button 
                                key={cardIdx} 
                                type="button"
                                onClick={() => isStealTarget && handleStealPick(cardIdx)}
                                layout
                                animate={isStealTarget ? { 
                                  width: '3.5rem', 
                                  height: '5.25rem',
                                } : { 
                                  width: '1.75rem', 
                                  height: '2.5rem',
                                }}
                                whileHover={isStealTarget ? { y: -20, scale: 1.2, zIndex: 100 } : {}}
                                whileTap={isStealTarget ? { scale: 0.9 } : {}}
                                className={`rounded-lg shadow-lg flex items-center justify-center shrink-0 origin-bottom transition-all duration-300 relative overflow-hidden ${
                                  isStealTarget 
                                    ? 'border-2 border-amber-300 cursor-pointer shadow-[0_0_20px_rgba(249,115,22,0.9)]' 
                                    : 'border border-red-800/60'
                                }`}
                                style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
                              >
                                {/* Card back gradient base */}
                                <div className={`absolute inset-0 ${
                                  isStealTarget 
                                    ? 'bg-gradient-to-b from-orange-500 via-red-600 to-red-800'
                                    : 'bg-gradient-to-br from-red-700 via-red-800 to-[#4a0e0e]'
                                }`} />
                                {/* Subtle diamond pattern texture */}
                                <div className="absolute inset-0 opacity-[0.08] bg-[repeating-conic-gradient(rgba(255,255,255,0.3)_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" />
                                {/* Holographic top glare */}
                                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent rounded-t-lg pointer-events-none mix-blend-overlay" />
                                
                                <span className={`relative z-10 text-white font-cartoon leading-none ${isStealTarget ? 'text-lg font-black' : 'text-[6px] scale-[0.7]'}`}>
                                  {isStealTarget ? '?' : '🐾'}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      );
                    })()
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
        <motion.div 
          animate={shouldJoltDial ? { 
            scale: joltType === 'increase' ? [1, 1.15, 0.95, 1.05, 1] : [1, 1.06, 0.98, 1],
            rotate: joltType === 'increase' ? [0, -3, 3, -1.5, 1.5, 0] : [0, 1.5, -1.5, 0],
            borderColor: joltType === 'increase' ? ['rgba(120,113,108,0.8)', 'rgba(239,68,68,1)', 'rgba(120,113,108,0.8)'] : ['rgba(120,113,108,0.8)', 'rgba(16,185,129,1)', 'rgba(120,113,108,0.8)'],
            boxShadow: joltType === 'increase'
              ? [
                  '0px 10px 25px rgba(0,0,0,0.5)',
                  '0px 0px 30px rgba(239,68,68,0.8)',
                  '0px 10px 25px rgba(0,0,0,0.5)'
                ]
              : [
                  '0px 10px 25px rgba(0,0,0,0.5)',
                  '0px 0px 25px rgba(16,185,129,0.6)',
                  '0px 10px 25px rgba(0,0,0,0.5)'
                ]
          } : {}}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center justify-center p-2.5 bg-stone-950/90 border-2 border-stone-800/80 backdrop-blur-md rounded-3xl w-36 h-36 shadow-2xl shrink-0 relative overflow-visible z-10"
        >
          {/* Connecting Red Cable Cord (Responsive, layered behind, fades out to prevent overflow) */}
          <svg className="absolute left-[85%] top-[40%] w-[150px] h-24 pointer-events-none -z-10 overflow-visible hidden md:block" fill="none" viewBox="0 0 150 96">
            <defs>
              <linearGradient id="wire-fade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b91c1c" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#b91c1c" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path 
              d="M 0, 10 C 60, 80 100, 80 150, 30" 
              stroke="url(#wire-fade)" 
              strokeWidth="4" 
              strokeLinecap="round"
            />
          </svg>

          {/* Danger glow background when kitten % is high */}
          <motion.div 
            className="absolute inset-0 rounded-3xl pointer-events-none"
            animate={{ 
              backgroundColor: kittenPercent > 50 
                ? `rgba(239,68,68,${Math.min(0.15, kittenPercent / 400)})` 
                : 'rgba(0,0,0,0)',
              boxShadow: kittenPercent > 60
                ? `inset 0 0 30px rgba(239,68,68,${kittenPercent / 300})`
                : 'inset 0 0 0px rgba(0,0,0,0)'
            }}
            transition={{ duration: 0.8 }}
          />

          {/* Curved Glossy Glass Glare Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none z-20 rounded-3xl" />
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-20 rounded-t-3xl" />

          {/* LED Warning Light */}
          <div className="absolute top-2.5 right-3.5 flex items-center justify-center z-20">
            <span className="relative flex h-2 w-2">
              <span 
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  kittenPercent > 50 
                    ? 'bg-red-500' 
                    : kittenPercent > 25 
                      ? 'bg-amber-400' 
                      : 'bg-green-400'
                }`}
                style={{ animationDuration: ledPulseDuration }}
              />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                kittenPercent > 50 
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                  : kittenPercent > 25 
                    ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' 
                    : 'bg-green-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
              }`} />
            </span>
          </div>

          <div className="text-[9px] font-cartoon text-amber-200/50 uppercase tracking-widest text-center absolute top-2 z-10">
            Chance of Kitten
          </div>

          <div className="relative w-24 h-20 mt-3 flex items-center justify-center overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 60">
              <defs>
                <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="35%" stopColor="#84cc16" />
                  <stop offset="65%" stopColor="#eab308" />
                  <stop offset="85%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <radialGradient id="metallic-hub" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#78716c" />
                  <stop offset="70%" stopColor="#44403c" />
                  <stop offset="100%" stopColor="#1c1917" />
                </radialGradient>
              </defs>

              {/* Recessed Track Background */}
              <path 
                d="M 15 50 A 35 35 0 0 1 85 50" 
                fill="none" 
                stroke="#1c1917" 
                strokeWidth="8" 
                strokeLinecap="round" 
              />
              {/* Gradient Colored Track */}
              <path 
                d="M 15 50 A 35 35 0 0 1 85 50" 
                fill="none" 
                stroke="url(#gauge-gradient)" 
                strokeWidth="5" 
                strokeLinecap="round" 
              />

              {/* Ticks around the arc */}
              {Array.from({ length: 11 }).map((_, i) => {
                const pct = i * 10;
                const angleDeg = -90 + pct * 1.8;
                const angleRad = (angleDeg * Math.PI) / 180;
                
                // Outer ticks sit on the track
                const rInner = 28;
                const rOuter = 32;
                const x1 = 50 + rInner * Math.sin(angleRad);
                const y1 = 50 - rInner * Math.cos(angleRad);
                const x2 = 50 + rOuter * Math.sin(angleRad);
                const y2 = 50 - rOuter * Math.cos(angleRad);
                
                const isMajor = i % 5 === 0; // 0%, 50%, 100%
                
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isMajor ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth={isMajor ? 1.2 : 0.6}
                  />
                );
              })}

              {/* Numeric Indicator Labels inside */}
              <text x="24" y="47" fill="rgba(255,255,255,0.3)" fontSize="4" className="font-cartoon" textAnchor="middle">0%</text>
              <text x="50" y="24" fill="rgba(255,255,255,0.3)" fontSize="4" className="font-cartoon" textAnchor="middle">50%</text>
              <text x="76" y="47" fill="rgba(255,255,255,0.3)" fontSize="4" className="font-cartoon" textAnchor="middle">100%</text>

              {/* Needle pointer with dropshadow & spring wiggle */}
              <g transform="translate(50, 50)">
                {/* 3D Drop Shadow Polygon */}
                <motion.polygon 
                  points="-1.8,1.8 0,-36 1.8,1.8" 
                  fill="rgba(0,0,0,0.4)"
                  animate={{ rotate: needleRotation }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: joltType ? 280 : 120,
                    damping: joltType ? 8 : 12,
                    mass: 0.5 
                  }}
                  style={{ originX: 0, originY: 0, filter: 'blur(0.8px)', translateX: 1.2, translateY: 1.2 }}
                />
                {/* Main Pointer Needle */}
                <motion.polygon 
                  points="-1.5,0 0,-38 1.5,0" 
                  fill={kittenPercent > 50 ? '#ef4444' : '#f97316'}
                  stroke={kittenPercent > 50 ? '#b91c1c' : '#ea580c'}
                  strokeWidth="0.4"
                  strokeLinejoin="round"
                  animate={{ rotate: needleRotation }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: joltType ? 280 : 120,
                    damping: joltType ? 8 : 12,
                    mass: 0.5 
                  }}
                  style={{ originX: 0, originY: 0 }}
                />
                
                {/* Glowing Center Hub (Metallic + Accent) */}
                <circle cx="0" cy="0" r="5.5" fill="url(#metallic-hub)" stroke="#1c1917" strokeWidth="0.5" />
                <motion.circle 
                  cx="0" cy="0" r="3.2"
                  animate={{ 
                    fill: kittenPercent > 50 ? '#ef4444' : kittenPercent > 25 ? '#fbbf24' : '#10b981',
                    boxShadow: kittenPercent > 50 ? '0 0 10px #ef4444' : 'none'
                  }}
                  transition={{ duration: 0.4 }}
                />
                <circle cx="0" cy="0" r="1" fill="#fff" />
              </g>
            </svg>

            {/* Digital percentage readout with danger-adaptive colors */}
            <motion.div 
              className={`absolute bottom-0.5 font-cartoon text-lg drop-shadow px-2.5 py-0.5 rounded-lg shadow border ${
                kittenPercent > 60 
                  ? 'text-red-400 bg-red-950/80 border-red-500/30' 
                  : kittenPercent > 30 
                    ? 'text-amber-300 bg-amber-950/60 border-amber-500/20' 
                    : 'text-white bg-black/60 border-white/10'
              }`}
              animate={{ scale: kittenPercent > 50 ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 1.5, repeat: kittenPercent > 50 ? Infinity : 0, ease: 'easeInOut' }}
            >
              {kittenPercent}%
            </motion.div>
          </div>
        </motion.div>

        {/* Middle Area: Draw & Discard Piles */}
        <div className="relative flex-1 flex flex-row items-center justify-center gap-10 md:gap-16 pointer-events-auto translate-y-6">

          {/* Draw Pile */}
          <div className="flex flex-col items-center relative">
            <AnimatePresence>
              {isShuffling && (
                <>
                  {/* 5 ghost cards fanning out in a dramatic circle */}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const angle = (i - 2) * 35;
                    const rad = (angle * Math.PI) / 180;
                    const xTarget = Math.sin(rad) * 120;
                    const yTarget = -Math.cos(rad) * 60 - 20;
                    return (
                      <motion.div
                        key={`shuffle-ghost-${i}`}
                        initial={{ scale: 0.3, opacity: 0, x: 0, y: 0, rotate: 0 }}
                        animate={{
                          scale: [0.3, 0.75, 0.75, 0.3],
                          opacity: [0, 0.9, 0.9, 0],
                          x: [0, xTarget, xTarget * 0.5, 0],
                          y: [0, yTarget, yTarget * 0.3, 0],
                          rotate: [0, angle, angle * 1.5, 0],
                        }}
                        exit={{ scale: 0.2, opacity: 0 }}
                        transition={{ duration: 1.6, delay: i * 0.08, repeat: 0, ease: 'easeInOut' }}
                        className="absolute top-0 left-0 pointer-events-none z-20"
                      >
                        <CardView disabled className="shadow-[0_0_25px_rgba(239,68,68,0.4)] border-red-500/30 w-32 sm:w-40 h-48 sm:h-60" />
                      </motion.div>
                    );
                  })}
                </>
              )}
            </AnimatePresence>

            <motion.button 
              animate={isShuffling ? { 
                x: [0, -8, 8, -6, 6, -4, 4, 0],
                rotate: [0, -4, 4, -3, 3, -2, 2, 0],
                scale: [1, 1.06, 0.96, 1.04, 0.98, 1]
              } : {}}
              transition={{ duration: 0.6, repeat: isShuffling ? Infinity : 0, ease: 'easeInOut' }}
              onClick={() => isMyTurn && !isExploding && onAction({ type: 'DRAW_CARD' })}
              disabled={!isMyTurn || isExploding}
              className={`relative group transition-all duration-500 z-10 shrink-0 aspect-[2/3] w-32 sm:w-40 rounded-[1.2rem] p-1.5 bg-[#4d0c0c] border-4 border-[#e25c34]/80 shadow-[0_8px_20px_rgba(0,0,0,0.6)] ${
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
            <div className="relative w-32 sm:w-40 h-48 sm:h-60">
              {gameState.discardPile.length === 0 ? null : (
                gameState.discardPile.map((card, i) => {
                  const isTop = i === gameState.discardPile.length - 1;
                  const rotation = (i * 11) % 23 - 11;
                  return (
                    <motion.div 
                      key={card.id + '-' + i} 
                      className="absolute inset-0"
                      initial={isTop ? { y: -80, scale: 0.6, opacity: 0, rotate: 0 } : false}
                      animate={{ 
                        y: 0, 
                        scale: 1, 
                        opacity: 1, 
                        rotate: rotation,
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 90, 
                        damping: 15, 
                        duration: 1.0,
                      }}
                      style={{ zIndex: i }}
                    >
                      {/* Brief glow effect on newest card */}
                      {isTop && (
                        <motion.div 
                          className="absolute -inset-2 rounded-[1.4rem] bg-yellow-300/30 blur-md pointer-events-none"
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                      )}
                      <CardView card={card} disabled={!isTop} layoutId={card.id} className="w-32 sm:w-40 h-48 sm:h-60" />
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Hanging Scroll Board */}
        <div className="flex flex-col items-center w-56 shrink-0 pointer-events-auto relative z-10">
          {/* Hanging rod */}
          <div className="w-48 h-2 bg-stone-500 rounded-full shadow-md relative flex items-center justify-between px-4">
            <div className="w-3.5 h-3.5 rounded-full bg-stone-700 -ml-4 border border-stone-600 shadow" />
            <div className="w-3.5 h-3.5 rounded-full bg-stone-700 -mr-4 border border-stone-600 shadow" />
          </div>
          
          {/* Parchment scroll container */}
          <div className="w-52 -mt-1 bg-[#faf5ec] border border-[#d4c3a3] rounded-b-2xl p-2.5 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col h-64 overflow-hidden relative">
            {/* Hanging tabs connecting scroll to rod */}
            <div className="absolute -top-1.5 left-7 w-3 h-2 bg-stone-600 rounded" />
            <div className="absolute -top-1.5 right-7 w-3 h-2 bg-stone-600 rounded" />
            


            <div 
              className="flex-1 flex flex-col gap-[3px] overflow-y-auto custom-scrollbar pr-1"
              ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            >
              {actionHistory.slice(-10).map((act, index, arr) => {
                const isNewest = index === arr.length - 1;

                return (
                  <div 
                    key={`${actionHistory.length}-${index}`}
                    className={`font-parchment text-[10px] leading-snug px-2 py-1 rounded transition-all ${
                      isNewest 
                        ? 'text-stone-900 font-bold bg-amber-200/50 border-l-2 border-amber-600' 
                        : index >= arr.length - 3
                          ? 'text-stone-800'
                          : 'text-stone-500'
                    }`}
                  >
                    {act}
                  </div>
                );
              })}
              {actionHistory.length === 0 && (
                <span className="font-parchment text-[10px] text-stone-700/40 italic text-center mt-4">Waiting for the first move...</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Bottom Controls: Player Info, Fanned Hand, Nope Button */}
      <div className="relative z-20 w-full flex flex-col items-center justify-end pb-2 bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-12 overflow-visible">
        
        {/* Play Button floating above the hand */}
        <div className="absolute -top-14 pointer-events-none w-full flex flex-col items-center justify-center">
          <AnimatePresence>
            {selectedCardIds.length > 0 && isMyTurn && !isExploding && !isFavorVictim && !gameState.actionWindow && (
              <motion.div 
                initial={{ y: 25, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: 25, opacity: 0 }} 
                className="flex flex-col items-center pointer-events-auto"
              >
                <button 
                  onClick={() => handlePlayCombo()}
                  className="group relative inline-flex items-center justify-center px-10 py-3.5 font-cartoon text-xl tracking-widest text-white uppercase bg-gradient-to-r from-orange-500 to-red-600 border-2 border-orange-400/50 rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_10px_30px_rgba(249,115,22,0.6)]"
                >
                  <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
                  <span className="relative drop-shadow-md">Play</span>
                </button>
                <span className="text-[9px] text-orange-400 mt-2 font-cartoon uppercase tracking-widest animate-pulse bg-black/40 px-3 py-1 rounded-full border border-orange-500/20 backdrop-blur-sm">
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

          {/* New YOUR TURN animation */}
          <AnimatePresence>
            {showYourTurn && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1.2, opacity: 1, y: 0 }}
                exit={{ scale: 1.5, opacity: 0, y: -50 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute -top-32 pointer-events-none z-50 flex items-center justify-center"
              >
                <div className="text-6xl md:text-8xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 font-black tracking-widest drop-shadow-[0_5px_15px_rgba(249,115,22,0.8)] uppercase">
                  YOUR TURN
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

              {/* Glowing red targeted aura for local player */}
              {isLocalPlayerTargeted && (
                <div className="absolute -inset-2 bg-red-600 rounded-full blur opacity-75 animate-ping z-0"></div>
              )}
              
              <div className={`w-14 h-14 rounded-full border-4 bg-blue-900/60 border-blue-400 flex items-center justify-center shadow-2xl relative overflow-hidden z-10 ${
                isLocalPlayerTargeted
                  ? 'ring-4 ring-red-500 animate-pulse border-red-400 scale-105 shadow-[0_0_25px_rgba(239,68,68,0.7)]'
                  : isMyTurn 
                    ? 'ring-2 ring-yellow-300 animate-pulse' 
                    : ''
              }`}>
                {/* Local Player Blue Cat SVG */}
                <svg className="w-12 h-12 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Ears */}
                  <path d="M20 50 L20 15 L45 35 Z" fill="currentColor" opacity="0.9" />
                  <path d="M80 50 L80 15 L55 35 Z" fill="currentColor" opacity="0.9" />
                  {/* Inner Ears */}
                  <path d="M25 42 L25 25 L40 35 Z" fill="rgba(255,255,255,0.3)" />
                  <path d="M75 42 L75 25 L60 35 Z" fill="rgba(255,255,255,0.3)" />
                  {/* Head */}
                  <circle cx="50" cy="55" r="35" fill="currentColor" />
                  {/* Eyes (Cool/Confident) */}
                  <path d="M30 50 Q38 45 45 50" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
                  <path d="M70 50 Q62 45 55 50" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
                  <circle cx="38" cy="52" r="3" fill="white" />
                  <circle cx="62" cy="52" r="3" fill="white" />
                  {/* Nose and Mouth */}
                  <polygon points="48,62 52,62 50,65" fill="rgba(0,0,0,0.5)" />
                  <path d="M50 65 Q45 70 40 68 M50 65 Q55 70 60 68" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>
            
            <div className="flex flex-col z-10 select-none">
              <span className="font-cartoon text-xs text-blue-200 bg-blue-950/70 border border-blue-400/40 px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
                YOU
              </span>
              {isLocalPlayerTargeted && (
                <span className="text-[8px] font-cartoon text-red-400 font-bold uppercase tracking-widest mt-0.5 animate-pulse">
                  🎯 TARGETED!
                </span>
              )}
              {isMyTurn && !isLocalPlayerTargeted && (
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
                className="flex flex-row transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] min-w-max h-56 sm:h-64 items-end justify-center px-12 pt-4 overflow-visible"
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
                        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                        whileHover={isExploding ? {} : { zIndex: 100 }}
                        className="shrink-0 origin-bottom overflow-visible"
                      >
                        <CardView 
                          card={card} 
                          layoutId={card.id}
                          onClick={() => toggleCardSelection(card.id)}
                          disabled={isExploding && card.type !== 'DEFUSE'}
                          className={`w-28 sm:w-36 h-42 sm:h-54 ${
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
            className="absolute inset-0 bg-black/90 backdrop-blur-3xl z-[60] flex flex-col items-center justify-center p-8 pointer-events-auto"
          >
              {/* Background animated orbs */}
              <motion.div 
                className="absolute w-96 h-96 rounded-full bg-purple-600/10 blur-[100px]"
                animate={{ scale: [1, 1.3, 1], x: [-50, 50, -50], y: [-20, 20, -20] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div 
                className="absolute w-64 h-64 rounded-full bg-pink-500/10 blur-[80px]"
                animate={{ scale: [1.2, 1, 1.2], x: [30, -30, 30], y: [10, -30, 10] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Title with eye icon */}
              <motion.div 
                initial={{ y: -40, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex flex-col items-center mb-10"
              >
                <motion.span 
                  className="text-6xl mb-3"
                  animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  🔮
                </motion.span>
                <h2 className="text-3xl sm:text-4xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-fuchsia-400 uppercase tracking-tighter italic">
                  See The Future
                </h2>
                <p className="text-slate-500 mt-2 font-cartoon uppercase tracking-wider text-[10px] text-center">
                  Next 3 cards you will draw
                </p>
              </motion.div>
              
              <div className="flex justify-center gap-6 sm:gap-10 mb-14">
                 {gameState.futureCards.map((card, i) => {
                    const labels = ['TOP', '2nd', '3rd'];
                    const labelColors = [
                      'from-red-500 to-orange-500 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.4)]',
                      'from-amber-500 to-yellow-500 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
                      'from-sky-500 to-blue-500 border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.3)]',
                    ];
                    const glowColors = [
                      'rgba(239,68,68,0.25)',
                      'rgba(245,158,11,0.2)',
                      'rgba(14,165,233,0.2)',
                    ];
                    return (
                      <motion.div 
                        key={card.id} 
                        initial={{ y: 120, opacity: 0, rotateY: 180, scale: 0.5 }}
                        animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
                        transition={{ 
                          delay: 0.3 + i * 0.25, 
                          type: 'spring', 
                          stiffness: 80, 
                          damping: 14,
                          duration: 0.8 
                        }}
                        className="flex flex-col items-center"
                        style={{ perspective: 800 }}
                      >
                        {/* Glow ring behind card */}
                        <motion.div 
                          className="absolute -inset-3 rounded-[2rem] blur-xl pointer-events-none"
                          style={{ backgroundColor: glowColors[i] }}
                          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                        />
                        <div className="relative">
                          <CardView card={card} disabled className="w-28 sm:w-36 h-42 sm:h-54" />
                        </div>
                        <motion.div 
                          className="mt-3 text-center"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + i * 0.25 }}
                        >
                          <span className={`text-[10px] sm:text-xs font-cartoon uppercase tracking-widest px-4 py-1.5 rounded-full border bg-gradient-to-r text-white ${labelColors[i]}`}>
                            {labels[i]}
                          </span>
                        </motion.div>
                      </motion.div>
                    );
                 })}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosions & Alerts - Dramatic Defusing Banner */}
      <AnimatePresence>
        {gameState.waitingForDefuse && gameState.waitingForDefuse !== socketId && (
          <motion.div
            key="defusing-banner"
            initial={{ y: -100, opacity: 0, scale: 0.5, rotate: -2 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -100, opacity: 0, scale: 0.5, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 150, damping: 12 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <div className="relative bg-[#faf5ec] border-4 border-red-600 rounded-3xl p-2 shadow-[0_15px_30px_rgba(220,38,38,0.5),0_0_0_4px_rgba(0,0,0,0.1)] overflow-hidden">
              {/* Hazard stripes border/background */}
              <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#dc2626_10px,#dc2626_20px)] pointer-events-none"></div>
              
              <div className="bg-red-600 rounded-2xl px-8 py-4 flex items-center gap-6 relative z-10 shadow-inner">
                <motion.div 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 flex items-center justify-center font-cartoon text-red-900 text-3xl border-4 border-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.8)] relative"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {gameState.bombCountdown || 15}
                </motion.div>
                
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-1">
                    <motion.span 
                      className="text-3xl filter drop-shadow-md"
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      💣
                    </motion.span>
                    <p className="font-cartoon text-white uppercase tracking-widest text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                      {gameState.players.find(p => p.id === gameState.waitingForDefuse)?.name} is defusing!
                    </p>
                  </div>
                  <motion.div 
                    className="h-2.5 bg-red-950 rounded-full mt-2 overflow-hidden border border-red-800/50"
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full"
                      animate={{ width: ['100%', '0%'] }}
                      transition={{ duration: gameState.bombCountdown || 15, ease: 'linear' }}
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stealing Instruction Banner */}
      {isStealer && victim && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-orange-600/90 border border-orange-500/50 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse">
           <span className="text-sm font-cartoon text-white uppercase tracking-wider">
             👉 Tap a card in {victim.name}'s hand at the top to steal! 👈
           </span>
        </div>
      )}

      {/* Action Window Overlay */}

      {/* Target Selection Instruction Banner */}
      <AnimatePresence>
        {showTargetModal && (
          <motion.div
            key="target-selection-banner"
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            className={`absolute top-24 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md border backdrop-blur-xl px-6 py-4 rounded-3xl flex flex-col items-center gap-3 shadow-lg pointer-events-auto text-center ${
              showTargetModal.type === 'FAVOR'
                ? 'bg-purple-950/80 border-purple-500/40 shadow-purple-500/30'
                : showTargetModal.type === '2-CARD'
                  ? 'bg-orange-950/80 border-orange-500/40 shadow-orange-500/30'
                  : 'bg-fuchsia-950/80 border-fuchsia-500/40 shadow-fuchsia-500/30'
            }`}
          >
            {/* Themed icon/indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">
                {showTargetModal.type === 'FAVOR' ? '🤝' : showTargetModal.type === '2-CARD' ? '🔥' : '🔮'}
              </span>
              <h4 className={`font-cartoon text-sm uppercase tracking-widest font-black ${
                showTargetModal.type === 'FAVOR'
                  ? 'text-purple-300'
                  : showTargetModal.type === '2-CARD'
                    ? 'text-orange-300'
                    : 'text-fuchsia-300'
              }`}>
                {showTargetModal.type === 'FAVOR'
                  ? 'Choose Favor Target'
                  : showTargetModal.type === '2-CARD'
                    ? 'Choose Steal Target'
                    : 'Choose Guess Target'}
              </h4>
            </div>

            {opponents.filter(o => !o.isEliminated && o.handCount > 0).length === 0 ? (
              <p className="text-xs font-cartoon text-red-400 tracking-wide uppercase animate-pulse">
                ⚠️ No valid targets available (opponents have no cards)!
              </p>
            ) : (
              <p className="text-xs font-cartoon text-slate-200 tracking-wide uppercase">
                {showTargetModal.type === 'FAVOR'
                  ? "Tap a player's avatar above to request a Favor!"
                  : showTargetModal.type === '2-CARD'
                    ? "Tap a player's avatar above to steal a card!"
                    : "Tap a player's avatar above to play 3-of-a-Kind guess!"}
              </p>
            )}


          </motion.div>
        )}
      </AnimatePresence>

      {/* Favor Request Overlay */}
      <AnimatePresence>
        {isFavorVictim && favorRequester && (
          <motion.div 
            key="favor-overlay"
            initial={{ opacity: 0, scale: 0.85, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-purple-950/95 border border-purple-500/30 rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(168,85,247,0.4)] z-40 text-center flex flex-col items-center justify-center pointer-events-auto overflow-hidden"
          >
            {/* Ambient glow behind overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.15)_0%,_transparent_80%)] pointer-events-none"></div>

            <h2 className="text-2xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 mb-1 uppercase tracking-tighter italic relative z-10">
              FAVOR REQUESTED
            </h2>
            <p className="text-xs text-slate-300 font-cartoon uppercase tracking-widest mb-6 relative z-10">
              Give <span className="text-white bg-purple-500/30 px-2 py-0.5 rounded border border-purple-500/50">{favorRequester.name}</span> a card
            </p>

            <AnimatePresence mode="wait">
              {myPlayer?.hand?.find(c => c.id === selectedCardIds[0]) ? (
                <motion.div 
                  key="selected-card"
                  initial={{ scale: 0.8, opacity: 0, rotate: -10 }} 
                  animate={{ scale: 1, opacity: 1, rotate: 0 }} 
                  exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
                  className="flex flex-col items-center relative z-10"
                >
                  <div className="mb-6 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]">
                    <CardView card={myPlayer.hand.find(c => c.id === selectedCardIds[0])!} disabled className="w-32 h-48" />
                  </div>
                  <motion.button 
                    onClick={handleGiveCard}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-cartoon uppercase tracking-widest shadow-xl border border-purple-400/30"
                  >
                    ✨ Give "{myPlayer.hand.find(c => c.id === selectedCardIds[0])!.name}" ✨
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div 
                  key="select-msg"
                  initial={{ y: 15, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -15, opacity: 0 }}
                  className="text-slate-500 text-xs font-cartoon uppercase tracking-widest border border-dashed border-white/10 rounded-2xl py-6 px-4 w-full relative z-10"
                >
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    👇 Select a card from your hand below...
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kaboom (Defuse Required) Overlay */}
      <AnimatePresence>
        {isExploding && isMyTurn && (
          <motion.div 
            key="kaboom-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 pointer-events-auto"
          >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.3)_0%,_rgba(0,0,0,0.8)_100%)] pointer-events-none" />
              
              <motion.div 
                className="flex flex-col items-center mb-8 relative z-10"
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.h2 
                  className="text-7xl md:text-9xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-red-300 via-orange-500 to-red-600 drop-shadow-[0_15px_30px_rgba(220,38,38,0.8)] uppercase tracking-tighter"
                  animate={{ scale: [1, 1.05, 1], rotate: [0, -1, 1, 0] }}
                  transition={{ duration: 0.3, repeat: Infinity, ease: 'linear' }}
                >
                  KABOOM!
                </motion.h2>
                <p className="text-xl md:text-2xl text-white font-cartoon uppercase tracking-widest mt-2 bg-black/40 px-6 py-2 rounded-full backdrop-blur-sm border border-red-500/30 shadow-lg">
                  BOMB EXPLODES IN {gameState.bombCountdown ?? 15}s
                </p>
              </motion.div>
              
              {hasDefuse ? (
                <motion.div 
                  className="flex flex-col items-center gap-6 bg-[#faf5ec] border-[6px] border-amber-900/80 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(120,60,20,0.2)] max-w-lg w-full relative z-10"
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
                >
                  <h3 className="text-2xl md:text-3xl font-cartoon text-amber-900 uppercase tracking-widest text-center">
                    Where do you want to hide the bomb?
                  </h3>
                  
                  {/* Preset quick buttons */}
                  <div className="flex gap-4 justify-center w-full">
                    <button 
                      onClick={() => { setDefuseInsertIndex(0); onAction({ type: 'DEFUSE', insertIndex: 0 }); }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border-b-4 border-orange-700 text-white font-cartoon text-xl tracking-wider transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 shadow-md"
                    >
                      TOP
                    </button>
                    <button 
                      onClick={() => { setDefuseInsertIndex(1); onAction({ type: 'DEFUSE', insertIndex: 1 }); }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 border-b-4 border-amber-600 text-amber-900 font-cartoon text-xl tracking-wider transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 shadow-md"
                    >
                      2ND
                    </button>
                    <button 
                      onClick={() => {
                        const idx = Math.floor(Math.random() * (gameState.drawPileCount + 1));
                        setDefuseInsertIndex(idx);
                        onAction({ type: 'DEFUSE', insertIndex: idx });
                      }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-b from-purple-400 to-purple-600 border-b-4 border-purple-800 text-white font-cartoon text-xl tracking-wider transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 shadow-md"
                    >
                      RANDOM
                    </button>
                  </div>

                  <div className="w-full flex items-center gap-4 my-2 opacity-50">
                    <div className="h-0.5 bg-amber-900/30 flex-1"></div>
                    <span className="font-cartoon text-amber-900 text-sm">OR</span>
                    <div className="h-0.5 bg-amber-900/30 flex-1"></div>
                  </div>

                  {/* Custom Position Selection */}
                  <div className="flex flex-col gap-4 w-full items-center">
                    <div className="flex items-center justify-between w-full px-2">
                      <span className="text-amber-800 font-cartoon text-lg uppercase tracking-wider">Exact Position:</span>
                      <span className="text-white font-cartoon text-2xl bg-orange-600 px-4 py-1.5 rounded-xl shadow-inner border-2 border-orange-800">
                        {defuseInsertIndex.toString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full bg-white/50 p-3 rounded-2xl border-2 border-amber-900/20">
                      <button 
                        type="button"
                        onClick={() => setDefuseInsertIndex(prev => Math.max(0, prev - 1))}
                        disabled={defuseInsertIndex <= 0}
                        className="w-12 h-12 rounded-xl bg-amber-200 border-b-4 border-amber-400 flex items-center justify-center font-cartoon text-amber-900 hover:brightness-105 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:active:border-b-4 disabled:active:translate-y-0 text-3xl shadow-sm"
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        min="0"
                        max={gameState.drawPileCount}
                        value={defuseInsertIndex}
                        onChange={(e) => setDefuseInsertIndex(Math.min(gameState.drawPileCount, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="flex-1 accent-orange-500 h-3 bg-amber-900/20 rounded-full appearance-none cursor-pointer"
                      />
                      <button 
                        type="button"
                        onClick={() => setDefuseInsertIndex(prev => Math.min(gameState.drawPileCount, prev + 1))}
                        disabled={defuseInsertIndex >= gameState.drawPileCount}
                        className="w-12 h-12 rounded-xl bg-amber-200 border-b-4 border-amber-400 flex items-center justify-center font-cartoon text-amber-900 hover:brightness-105 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:active:border-b-4 disabled:active:translate-y-0 text-3xl shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-amber-900/60 font-cartoon uppercase text-center mt-[-8px]">
                      [0 = TOP] • [{gameState.drawPileCount} = BOTTOM]
                    </span>

                    <button 
                      onClick={() => onAction({ type: 'DEFUSE', insertIndex: defuseInsertIndex })}
                      className="w-full mt-2 py-5 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 border-b-[6px] border-green-800 font-cartoon uppercase tracking-widest text-white text-2xl transition-all hover:brightness-110 active:border-b-0 active:translate-y-1.5 shadow-lg"
                    >
                      HIDE IT!
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  className="flex flex-col items-center mt-8 z-10"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 10 }}
                >
                  <div className="bg-[#faf5ec] border-4 border-red-600 rounded-[2rem] p-8 max-w-sm text-center relative shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                    <h2 className="text-4xl md:text-5xl font-cartoon text-red-600 uppercase tracking-tighter drop-shadow-sm mb-4">
                      YOU ARE DEAD!
                    </h2>
                    <p className="text-xl font-cartoon text-amber-900 uppercase tracking-wider mb-6 opacity-80">
                      No Defuse card in hand
                    </p>
                    <motion.div 
                      className="inline-block bg-red-600 text-white font-cartoon text-2xl uppercase tracking-widest px-8 py-3 rounded-xl border-b-4 border-red-800"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      GAME OVER
                    </motion.div>
                  </div>
                </motion.div>
              )}
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

      {/* Defuse Success Celebration Overlay */}
      <AnimatePresence>
        {showDefuseSuccess && (
          <motion.div
            key="defuse-success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            {/* Green flash */}
            <motion.div 
              className="absolute inset-0 bg-emerald-500/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 1.5 }}
            />
            {/* Action Lines / Burst Background */}
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.5)_0%,transparent_60%)]"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 2, 1.5], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8 }}
            />
            {/* Impact Particles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`defuse-particle-${i}`}
                className="absolute w-4 h-20 rounded-full bg-gradient-to-t from-emerald-400 to-green-600 opacity-80"
                style={{ rotate: `${i * 45}deg`, originY: 3 }}
                initial={{ scaleY: 0, y: 0 }}
                animate={{ scaleY: [0, 1, 0], y: [0, -120, -180] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="flex flex-col items-center justify-center relative z-10"
              initial={{ scale: 0, opacity: 0, rotate: -15 }}
              animate={{ scale: [1.5, 0.9, 1.1, 1], opacity: 1, rotate: [15, -5, 2, 0] }}
              exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              <h1 
                className="relative text-6xl md:text-8xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-500 to-green-700 uppercase tracking-tighter text-center leading-none z-10"
                style={{
                  WebkitTextStroke: "5px black",
                  filter: "drop-shadow(6px 10px 0px rgba(0,0,0,0.8)) drop-shadow(0px 0px 30px rgba(16,185,129,0.6))",
                }}
              >
                DEFUSED!
              </h1>
              <h1 
                className="absolute top-0 left-0 text-6xl md:text-8xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-500 to-green-700 uppercase tracking-tighter text-center leading-none z-20 mix-blend-overlay"
              >
                DEFUSED!
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Elimination Dramatic Overlay */}
      <AnimatePresence>
        {eliminatedPlayerId && (
          <motion.div
            key={`elimination-${eliminatedPlayerId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[55] pointer-events-none flex items-center justify-center"
          >
            {/* Red flash background */}
            <motion.div 
              className="absolute inset-0 bg-red-600/15"
              animate={{ opacity: [0, 0.4, 0.1, 0.3, 0] }}
              transition={{ duration: 3 }}
            />
            <motion.div
              className="flex flex-col items-center z-10"
              initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
              animate={{ scale: [1.5, 1], opacity: 1, rotate: [5, -2, 0] }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <h1 className="text-8xl md:text-[10rem] font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-red-500 via-red-600 to-red-900 drop-shadow-[0_15px_30px_rgba(220,38,38,0.9)] uppercase tracking-tighter relative">
                <span className="absolute inset-0 text-red-500 blur-md opacity-50 z-[-1]">ELIMINATED</span>
                ELIMINATED
              </h1>
              <motion.p 
                className="font-cartoon text-white text-3xl md:text-4xl uppercase tracking-widest mt-2 bg-black/50 px-6 py-2 rounded-full border border-red-500/50 backdrop-blur-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {gameState.players.find(p => p.id === eliminatedPlayerId)?.name || 'Player'}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo Play Effect Overlay */}
      <AnimatePresence>
        {comboEffect && (
          <motion.div
            key={`combo-${comboEffect.type}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[55] pointer-events-none flex items-center justify-center"
          >
            {/* Sparkle ring */}
            <motion.div
              className={`absolute w-64 h-64 rounded-full border-4 pointer-events-none ${
                comboEffect.count === 3 ? 'border-fuchsia-500/30' : 'border-cyan-500/30'
              }`}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 2], opacity: [0.8, 0] }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
            <motion.div
              className={`absolute w-48 h-48 rounded-full border-4 pointer-events-none ${
                comboEffect.count === 3 ? 'border-purple-500/30' : 'border-blue-500/30'
              }`}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.8], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
            />
            {/* Combo text */}
            <motion.div
              className="flex flex-col items-center z-10"
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: [0, 1.2, 1], y: 0 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <h1 className={`text-6xl md:text-8xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] uppercase tracking-tighter ${
                comboEffect.count === 3 
                  ? 'from-fuchsia-300 via-fuchsia-500 to-purple-700' 
                  : 'from-cyan-300 via-cyan-500 to-blue-700'
              }`}>
                {comboEffect.count === 3 ? 'THREE OF A KIND!' : 'PAIR PLAYED!'}
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Popup Overlay */}
      <AnimatePresence>
        {actionPopup && (
          <motion.div
            key={`action-popup-${actionPopup.text}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            {/* Action Lines / Burst Background */}
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.4)_0%,transparent_60%)]"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1.2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6 }}
            />
            
            {/* Impact Particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`action-particle-${i}`}
                className={`absolute w-3 h-16 rounded-full bg-gradient-to-t ${actionPopup.color} opacity-80`}
                style={{ rotate: `${i * 60}deg`, originY: 2.5 }}
                initial={{ scaleY: 0, y: 0 }}
                animate={{ scaleY: [0, 1, 0], y: [0, -100, -150] }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            ))}

            <motion.div
              className="flex flex-col items-center z-10 relative"
              initial={{ scale: 0, opacity: 0, rotate: -15 }}
              animate={{ scale: [1.5, 0.9, 1.1, 1], opacity: 1, rotate: [15, -5, 2, 0] }}
              exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              <h1 
                className={`text-5xl md:text-[7rem] font-cartoon text-transparent bg-clip-text bg-gradient-to-b ${actionPopup.color} uppercase tracking-tighter text-center leading-none relative z-10`}
                style={{
                  WebkitTextStroke: "5px black",
                  filter: "drop-shadow(6px 10px 0px rgba(0,0,0,0.8)) drop-shadow(0px 0px 30px rgba(255,255,255,0.4))",
                }}
              >
                {actionPopup.text}
              </h1>
              {/* Overlay for inner gradient brightness */}
              <h1 
                className={`text-5xl md:text-[7rem] font-cartoon text-transparent bg-clip-text bg-gradient-to-b ${actionPopup.color} uppercase tracking-tighter text-center leading-none absolute top-0 left-0 z-20 mix-blend-overlay`}
              >
                {actionPopup.text}
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-of-a-Kind Guess Modal */}
      {showGuessModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center z-[90] p-4 pointer-events-auto">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 100, damping: 12 }} className="bg-slate-950 border border-slate-800 p-8 rounded-[3rem] max-w-xl w-full text-center shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Background orbs */}
            <motion.div 
              className="absolute w-48 h-48 rounded-full bg-fuchsia-600/5 blur-[60px] -top-10 -right-10"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span 
              className="text-4xl mb-2 block"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              🔍
            </motion.span>
            <h3 className="text-3xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400 mb-2 uppercase tracking-tighter relative z-10">Guess Card</h3>
            <p className="text-slate-500 mb-6 text-xs font-cartoon uppercase tracking-widest relative z-10">Select what they might have</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 max-h-[30vh] overflow-y-auto custom-scrollbar relative z-10">
               {Object.values(CardType).filter(t => t !== 'EXPLODING_KITTEN').map(type => (
                 <motion.button 
                   key={type} 
                   onClick={() => {
                     if (gameState.waitingForTarget && targetPlayerId) {
                       onAction({ type: 'SELECT_TARGET', targetId: targetPlayerId, requestedCardType: type }, (res) => {
                         if (res && !res.success) {
                           if (res.message !== "An action is currently waiting for Nope!") {
                             setActionError(res.message);
                           }
                         }
                         setShowGuessModal(false);
                         setTargetPlayerId(null);
                         setSelectedCardIds([]);
                       });
                     } else {
                       handlePlayCombo(type);
                     }
                   }} 
                   whileHover={{ scale: 1.08, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
                   whileTap={{ scale: 0.95 }}
                   className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-gradient-to-r hover:from-fuchsia-600/30 hover:to-purple-600/30 hover:border-fuchsia-500/40 hover:text-white text-slate-300 text-[10px] font-cartoon uppercase tracking-wider transition-all"
                 >
                   {type.replace(/_/g, ' ')}
                 </motion.button>
               ))}
            </div>
            <motion.button 
              onClick={() => setShowGuessModal(false)} 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-slate-500 hover:text-white font-cartoon uppercase tracking-widest text-xs transition-colors bg-white/5 px-6 py-2 rounded-full border border-white/10 hover:border-white/20 relative z-10"
            >
              Cancel
            </motion.button>
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
              btnStyle = "bg-slate-900 border-b-4 border-slate-950 text-slate-700 cursor-not-allowed opacity-40 shadow-inner";
              statusText = "NO NOPE";
            } else if (isNopeOpportunity) {
              btnStyle = "bg-red-600 border-b-8 border-red-900 hover:bg-red-500 hover:border-red-800 active:border-b-0 active:translate-y-2 text-white shadow-[0_10px_40px_rgba(220,38,38,0.8)] cursor-pointer animate-pulse scale-110";
              statusText = "PLAY NOPE!";
              clickHandler = () => onAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
              isBtnDisabled = false;
            } else {
              btnStyle = "bg-red-900/50 border-b-4 border-red-950/80 text-red-400 hover:bg-red-800/60 cursor-pointer shadow-[0_5px_15px_rgba(220,38,38,0.2)]";
              statusText = "NOPE READY";
              clickHandler = undefined;
              isBtnDisabled = false;
            }

            return (
              <motion.button
                whileHover={!isBtnDisabled && !isNopeOpportunity ? { y: -2 } : {}}
                whileTap={!isBtnDisabled ? { y: 4, scale: 0.95 } : {}}
                onClick={clickHandler}
                className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center font-cartoon uppercase transition-all duration-200 ${btnStyle}`}
              >
                {/* Glossy highlight for 3D effect */}
                <div className="absolute top-1 left-2 right-2 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-full pointer-events-none mix-blend-overlay"></div>
                
                <span className="text-xl sm:text-2xl tracking-tighter drop-shadow-md">NOPE!</span>
                <span className="text-[9px] sm:text-[10px] font-bold opacity-90 mt-1 tracking-widest drop-shadow-sm">{statusText}</span>
              </motion.button>
            );
          })()}
        </div>
      )}

      {/* Global Countdown Overlay for AFK handling */}
      <CountdownOverlay expiresAt={activeExpiresAt} label={countdownLabel} />
    </div>
  );
};
