import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { CardType } from '../../../shared/src/types';
import type { GameState, PlayerAction, Card } from '../../../shared/src/types';
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
  const [showTargetModal, setShowTargetModal] = useState<{ type: 'FAVOR' | '2-CARD' | '3-CARD'; cardIds: string[] } | null>(null);


  const [actionError, setActionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isPawDrawing, setIsPawDrawing] = useState(false);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null);
  const [showDefuseSuccess, setShowDefuseSuccess] = useState(false);
  // Handle delayed target modal
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState.waitingForTarget && gameState.waitingForTarget.playerId === socketId) {
      const action = gameState.lastAction || '';
      const justPlayedCombo = action.includes('played a Pair!') || action.includes('played 3 of a Kind!');
      const justPlayedFavor = action.includes('played Favor!');
      const justPlayedTargetedAttack = action.includes('played Targeted Attack') || action.includes('played Targeted Attack 2x');

      if (justPlayedCombo && !showTargetModal) {
        timer = setTimeout(() => {
          setShowTargetModal({ type: gameState.waitingForTarget!.type, cardIds: [] });
        }, 2500);
      } else if (justPlayedFavor && !showTargetModal) {
        timer = setTimeout(() => {
          setShowTargetModal({ type: gameState.waitingForTarget!.type, cardIds: [] });
        }, 2000);
      } else if (justPlayedTargetedAttack && !showTargetModal) {
        timer = setTimeout(() => {
          setShowTargetModal({ type: gameState.waitingForTarget!.type, cardIds: [] });
        }, 2000);
      } else {
        setShowTargetModal({ type: gameState.waitingForTarget.type, cardIds: [] });
      }
    } else {
      setShowTargetModal(null);
    }
    return () => clearTimeout(timer);
  }, [gameState.waitingForTarget, gameState.lastAction]);

  const [comboEffect, setComboEffect] = useState<{ type: 'pair' | 'triple', count: number } | null>(null);
  const [actionPopup, setActionPopup] = useState<{ text: string; color: string } | null>(null);

  // Kitten Chance states
  const totalCards = gameState.drawPileCount;
  const kittens = gameState.explodingKittensCount ?? 0;
  const isAnyExploding = !!gameState.waitingForDefuse;
  // Don't round, so it moves physically on every single draw
  const basePercent = totalCards > 0 ? (kittens / totalCards) * 100 : 0;
  const kittenPercent = isAnyExploding ? 100 : basePercent;
  
  // Map actual chance to visual gauge: 0-33% actual chance maps to 0-75% visual width (Green/Yellow/Orange).
  // >33% maps to 75-100% (Red Alert zone).
  const visualPercent = Math.min(100, (kittenPercent / 33) * 75);

  const [prevKittenPercent, setPrevKittenPercent] = useState(kittenPercent);
  const [shouldJoltDial, setShouldJoltDial] = useState(false);
  const [joltType, setJoltType] = useState<'increase' | 'decrease' | null>(null);
  const [needleJitter, setNeedleJitter] = useState(0);

  // Wiggle needle when danger is high (actual chance > 20%)
  useEffect(() => {
    if (kittenPercent > 20) {
      const interval = setInterval(() => {
        const magnitude = kittenPercent > 33 ? 2.2 : 1.2;
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

  // Watch for action cards played to show big text   // Action popups
  useEffect(() => {
    const action = gameState.lastAction || '';
    if (!action) {
      setActionPopup(null);
      return;
    }
    
    const actionLower = action.toLowerCase();
    
    // Only trigger popups for the initial play or a direct reaction (Nope), not the resolution message.
    // Resolution messages usually don't contain "played" or "NOPED".
    const isInitialPlay = (actionLower.includes('played') || action.includes('NOPED')) &&
      !actionLower.includes('reversed') &&
      !actionLower.includes('will draw from') &&
      !actionLower.includes('drew from') &&
      !actionLower.includes('was noped') &&
      !actionLower.includes('skipped their') &&
      !actionLower.includes('shuffled') &&
      !actionLower.includes('stole a') &&
      !actionLower.includes('successfully guessed') &&
      !actionLower.includes('gave a card');

    // Special handling for Kittens (always show popups regardless of "played" keyword)
    if (actionLower.includes('kitten') || actionLower.includes('exploded') || actionLower.includes('eliminated')) {
      if (actionLower.includes('eliminated') || actionLower.includes('exploded')) {
        setActionPopup({ text: 'KABOOM!', color: 'from-red-700 via-red-950 to-black' });
      } else if (actionLower.includes('imploding')) {
        setActionPopup({ text: 'IMPLODING KITTEN!', color: 'from-rose-500 via-red-600 to-stone-800' });
      } else if (actionLower.includes('exploding')) {
        setActionPopup({ text: 'EXPLODING KITTEN!', color: 'from-orange-600 to-red-700' });
      }
      const timer = setTimeout(() => setActionPopup(null), 2000);
      return () => clearTimeout(timer);
    }

    if (!isInitialPlay) return;

    if (action.includes('Targeted Attack') || actionLower.includes('targeted attack')) {
      setActionPopup({ text: 'TARGETED ATTACK!', color: 'from-red-600 via-orange-600 to-amber-600' });
    } else if (actionLower.includes('alter the future')) {
      setActionPopup({ text: 'ALTER THE FUTURE!', color: 'from-fuchsia-500 via-purple-600 to-indigo-700' });
    } else if (actionLower.includes('draw from the bottom')) {
      setActionPopup({ text: 'DRAW BOTTOM!', color: 'from-teal-400 via-emerald-500 to-cyan-600' });
    } else if (actionLower.includes('reverse')) {
      setActionPopup({ text: 'REVERSE!', color: 'from-cyan-400 via-blue-500 to-indigo-600' });
    } else if (action.includes('played Shuffle')) {
      setActionPopup({ text: 'SHUFFLE!', color: 'from-orange-400 to-red-600' });
    } else if (action.includes('played Attack')) {
      setActionPopup({ text: 'ATTACK!', color: 'from-red-500 to-red-800' });
    } else if (action.includes('played Skip')) {
      setActionPopup({ text: 'SKIP!', color: 'from-blue-400 to-blue-700' });
    } else if (actionLower.includes('see the future')) {
      setActionPopup({ text: 'SEE THE FUTURE!', color: 'from-fuchsia-400 to-purple-700' });
    } else if (action.includes('played Favor')) {
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
    
    // Ignore target selection updates
    if (action.includes('targeted')) {
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
  const isImplodingInsert = gameState.waitingForImplodingInsert === socketId;
  const hasDefuse = myPlayer?.hand?.some(c => c.type === CardType.DEFUSE);

  const [showYourTurn, setShowYourTurn] = useState(false);

  useEffect(() => {
    let showTimer: NodeJS.Timeout;
    let hideTimer: NodeJS.Timeout;

    if (isMyTurn) {
      const justDefused = gameState.lastAction?.includes('defused') || gameState.lastAction?.includes('Defuse');
      
      if (justDefused && !gameState.waitingForDefuse) {
        showTimer = setTimeout(() => {
          setShowYourTurn(true);
          hideTimer = setTimeout(() => setShowYourTurn(false), 2000);
        }, 3000);
      } else {
        setShowYourTurn(true);
        hideTimer = setTimeout(() => setShowYourTurn(false), 2000);
      }
    } else {
      setShowYourTurn(false);
    }
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isMyTurn]);



  const [defuseInsertIndex, setDefuseInsertIndex] = useState<number>(0);

  // Reset defuse index when exploding state changes
  useEffect(() => {
    if (isExploding || isImplodingInsert) {
      setDefuseInsertIndex(0);
    }
  }, [isExploding, isImplodingInsert]);

  // Future logic
  const isSeeingFuture = !!gameState.futureCards;
  const isAlteringFuture = !!gameState.alteringFutureCards;
  const [alteringCards, setAlteringCards] = useState<Card[]>([]);

  // Sync state when entering alter future mode
  useEffect(() => {
    if (isAlteringFuture && gameState.alteringFutureCards) {
      setAlteringCards(gameState.alteringFutureCards);
    }
  }, [isAlteringFuture, gameState.alteringFutureCards]);

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
    !gameState.waitingForImplodingInsert &&
    !isSeeingFuture
  ) {
    activeExpiresAt = gameState.turnExpiresAt;
    countdownLabel = 'Your Turn';
  }
  
  // Late Nope opportunities (after action window has resolved)
  const isAttackOrSkipNopeable = !!gameState.lastNopeableAction &&
    (gameState.lastNopeableAction.type === 'ATTACK' || gameState.lastNopeableAction.type === 'SKIP' || gameState.lastNopeableAction.type === 'REVERSE') &&
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
  
  const isNopeOpportunity = !gameState.waitingForDefuse && !gameState.waitingForImplodingInsert && (
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
    
    const isCatOrFeral = (type: string) => type.startsWith('CAT_CARD') || type === CardType.FERAL_CAT;
    const allCatOrFeral = selectedCards.every(c => isCatOrFeral(c.type));
    
    let isValidCombo = false;
    if (selectedCards.every(c => c.type === selectedCards[0].type)) {
      isValidCombo = true;
    } else if (allCatOrFeral) {
      const nonFeralTypes = selectedCards.filter(c => c.type !== CardType.FERAL_CAT).map(c => c.type);
      const uniqueNonFeral = [...new Set(nonFeralTypes)];
      if (uniqueNonFeral.length <= 1) {
        isValidCombo = true;
      }
    }

    let action: PlayerAction | null = null;

    if (selectedCards.length === 1) {
      if (selectedCards[0].type.startsWith('CAT_CARD') || selectedCards[0].type === CardType.FERAL_CAT) {
        setActionError("Cat cards must be played in pairs!");
        return;
      }
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
    } else if (selectedCards.length === 2) {
      if (!isValidCombo) { setActionError("Pairs must be the same card type or use a Feral Cat!"); return; }
      action = { type: 'PLAY_CARDS', cardIds: selectedCardIds };
    } else if (selectedCards.length === 3) {
      if (!isValidCombo) { setActionError("3 of a kind must be the same card type or use Feral Cats!"); return; }
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
                                    : 'border border-black/90'
                                }`}
                                style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
                              >
                                {/* Card back background */}
                                <div className="absolute inset-0 bg-[#8b1a28] shadow-[inset_0_0_8px_rgba(0,0,0,0.5)]" />
                                
                                {/* Premium crosshatch pattern */}
                                <div className="absolute inset-0 opacity-[0.06] bg-[repeating-conic-gradient(rgba(255,255,255,0.4)_0%_25%,transparent_0%_50%)] bg-[length:6px_6px] z-0"></div>
                                
                                {isStealTarget ? (
                                  <div className="flex flex-col items-center justify-center z-10 relative leading-none w-full h-full p-1">
                                    {/* Cat Logo for EK2 */}
                                    <svg className="w-6 h-6 text-[#facc15] fill-current drop-shadow-md mb-0.5" viewBox="0 0 64 64">
                                       <path d="M16 40 L16 30 C16 20, 48 20, 48 30 L48 40 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M16 25 L10 15 L25 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M48 25 L54 15 L39 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M16 35 C5 35, 5 45, 12 45" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
                                    </svg>
                                    <div className="flex flex-col items-center leading-none tracking-tighter transform -skew-x-3 -rotate-2">
                                      <span className="text-[#facc15] font-black text-[7px] drop-shadow-[0.5px_0.5px_0_#000] uppercase">EXPLODING</span>
                                      <span className="text-white font-black text-[10px] drop-shadow-[0.5px_0.5px_0_#000] -mt-0.5">KITTENS</span>
                                      <span className="text-white font-black text-[18px] drop-shadow-[1px_1px_0_#000] -mt-0.5">2</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center z-10 relative leading-none w-full h-full">
                                    {/* Small Cat Logo for tiny card view */}
                                    <svg className="w-3.5 h-3.5 text-[#facc15] fill-current drop-shadow-sm mb-0.5" viewBox="0 0 64 64">
                                       <path d="M16 40 L16 30 C16 20, 48 20, 48 30 L48 40 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M16 25 L10 15 L25 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M48 25 L54 15 L39 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                                       <path d="M16 35 C5 35, 5 45, 12 45" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
                                    </svg>
                                    <span className="text-white font-black text-[9px] drop-shadow-[0.5px_0.5px_0_#000] transform -skew-x-3 -rotate-2 -mt-0.5">2</span>
                                  </div>
                                )}
                                {/* Holographic Top Glare */}
                                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 via-white/5 to-transparent rounded-t-lg pointer-events-none mix-blend-overlay z-20" />
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
        
        {/* Left Side: Bomb Chance Gauge (Redesigned to match image) */}
        {/* Left Side: Bomb Chance Gauge (Redesigned to match image) */}
        <motion.div 
          animate={
            shouldJoltDial 
              ? { rotate: joltType === 'increase' ? [-4, 4, -2, 2, 0] : [4, -4, 2, -2, 0] } 
              : kittenPercent >= 50 
                ? { x: [-2, 2, -2, 2], y: [-1, 1, 1, -1] } 
                : { x: 0, y: 0, rotate: 0 }
          }
          transition={
            shouldJoltDial 
              ? { duration: 0.5 } 
              : kittenPercent >= 50 
                ? { duration: 0.2, repeat: Infinity, repeatType: "mirror" } 
                : { duration: 0.2 }
          }
          className="relative flex flex-col items-center justify-center pointer-events-none select-none z-10 ml-8 shrink-0 w-36 h-36 mt-4 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
        >
          {/* Cartoon Smoke Animation for Danger > 33% */}
          <AnimatePresence>
            {kittenPercent > 33 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 flex items-center justify-center pointer-events-none z-0 overflow-visible"
              >
                {/* Light Smoke (White/Gray) for >33% */}
                {[...Array(kittenPercent >= 50 ? 3 : 5)].map((_, i) => {
                  const anim = [
                    { y: [0, -50, -100], x: [0, 20, 40], scale: [0.3, 1.4, 2.5] },
                    { y: [0, -70, -110], x: [0, -30, -50], scale: [0.4, 1.7, 2.5] },
                    { y: [0, -60, -90], x: [0, 10, 20], scale: [0.3, 1.2, 2.5] },
                    { y: [0, -80, -120], x: [0, -15, -25], scale: [0.5, 1.8, 2.5] },
                    { y: [0, -55, -100], x: [0, 25, 45], scale: [0.3, 1.5, 2.5] },
                  ][i];
                  return (
                    <motion.div
                      key={`light-smoke-${i}`}
                      className="absolute bottom-10 w-12 h-12 bg-gray-200 border-2 border-gray-400 rounded-full"
                      style={{ opacity: 0.8 }}
                      animate={{ ...anim, opacity: [0.8, 0.8, 0] }}
                      transition={{ duration: 1.5 + i * 0.1, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                    />
                  );
                })}

                {/* Heavy Dark Smoke for >=50% */}
                {kittenPercent >= 50 && [...Array(8)].map((_, i) => {
                  const anim = [
                    { y: [0, -80, -140], x: [0, 40, 80], scale: [0.5, 2.2, 4] },
                    { y: [0, -60, -120], x: [0, -50, -90], scale: [0.6, 2.8, 4] },
                    { y: [0, -100, -160], x: [0, 20, 40], scale: [0.5, 2.4, 4] },
                    { y: [0, -70, -130], x: [0, -30, -60], scale: [0.7, 2.9, 4] },
                    { y: [0, -90, -150], x: [0, 60, 110], scale: [0.5, 2.5, 4] },
                    { y: [0, -110, -170], x: [0, -40, -80], scale: [0.6, 2.1, 4] },
                    { y: [0, -75, -135], x: [0, 30, 50], scale: [0.5, 2.7, 4] },
                    { y: [0, -95, -155], x: [0, -60, -100], scale: [0.8, 2.3, 4] },
                  ][i];
                  return (
                    <motion.div
                      key={`heavy-smoke-${i}`}
                      className="absolute bottom-10 w-16 h-16 bg-neutral-800 border-[3px] border-black rounded-full"
                      animate={{ ...anim, opacity: [0.9, 0.9, 0] }}
                      transition={{ duration: 1.2 + (i%3)*0.1, repeat: Infinity, delay: i * 0.15, ease: "easeOut" }}
                    />
                  );
                })}

                {/* Cartoon Sparks for >=50% */}
                {kittenPercent >= 50 && [...Array(6)].map((_, i) => {
                  const anim = [
                    { y: [0, -120], x: [0, 50] },
                    { y: [0, -150], x: [0, -70] },
                    { y: [0, -110], x: [0, 90] },
                    { y: [0, -160], x: [0, -40] },
                    { y: [0, -130], x: [0, 60] },
                    { y: [0, -140], x: [0, -80] },
                  ][i];
                  return (
                    <motion.div
                      key={`spark-${i}`}
                      className="absolute bottom-4 w-4 h-4 bg-yellow-400 border-2 border-orange-600 shadow-sm"
                      animate={{ ...anim, scale: [0.5, 1.5, 0], rotate: [0, 180, 360] }}
                      transition={{ duration: 0.6 + (i%2)*0.2, repeat: Infinity, delay: i * 0.2, ease: "easeOut" }}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top Arch Text: "CHANCE OF KITTEN" */}
          <svg className="absolute -top-[2.2rem] left-1/2 -translate-x-1/2 w-48 h-24 overflow-visible z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]" viewBox="0 0 200 100">
            <path id="text-curve" d="M 20 90 Q 100 -10 180 90" fill="transparent" stroke="white" strokeWidth="26" strokeLinecap="round" />
            <text fontSize="14" fill="#ef4444" fontWeight="900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} letterSpacing="0.5">
              <textPath href="#text-curve" startOffset="50%" textAnchor="middle" dominantBaseline="middle" dy="-3">
                CHANCE OF KITTEN
              </textPath>
            </text>
          </svg>

          {/* Left % Box */}
          <div className="absolute top-1/2 -left-14 -translate-y-1/2 w-[4.5rem] h-11 bg-white rounded-l-lg shadow-[-2px_4px_8px_rgba(0,0,0,0.1),inset_0_-2px_4px_rgba(0,0,0,0.05)] border-y-2 border-l-2 border-[#f8fafc] flex items-center justify-center pr-3 z-0">
             <div className="flex items-baseline gap-[1px] ml-1">
                <span className="text-[#ef4444] font-black text-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>
                  {Math.round(kittenPercent)}
                </span>
                <span className="text-[#ef4444] font-bold text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                  %
                </span>
             </div>
          </div>

          {/* Main Circular Housing */}
          <div className="relative w-full h-full bg-white rounded-full shadow-[0_6px_12px_rgba(0,0,0,0.2),inset_0_-4px_8px_rgba(0,0,0,0.05)] border-4 border-white flex items-center justify-center z-10">
            
            {/* The Inner Dial Face */}
            <div className="w-[88%] h-[88%] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] overflow-hidden relative border border-gray-100 bg-[#f8fafc]">
               {/* 4 Colored Segments using conic-gradient */}
               <div 
                 className="absolute inset-0"
                 style={{
                   background: 'conic-gradient(from 240deg, #f8fafc 0deg 60deg, #fcd34d 60deg 120deg, #fb923c 120deg 180deg, #ef4444 180deg 240deg, transparent 240deg 360deg)'
                 }}
               />
               
               {/* Inner White Cutout */}
               <div className="absolute bottom-[-15%] left-1/2 -translate-x-1/2 w-[60%] h-[60%] bg-white rounded-full shadow-[0_-2px_6px_rgba(0,0,0,0.1)] flex items-start justify-center pt-2">
               </div>

               {/* 0 and 100 text */}
               <span className="absolute bottom-5 left-5 text-gray-400 font-bold text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>0</span>
               <span className="absolute bottom-5 right-3 text-[#ef4444] font-bold text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>100</span>

               {/* The Rotating Needle */}
               <motion.div
                 className="absolute inset-0 z-20 pointer-events-none drop-shadow-md"
                 animate={{ rotate: -120 + (kittenPercent / 100) * 240 }}
                 transition={{ type: 'spring', stiffness: 100, damping: 12 }}
               >
                 <svg viewBox="0 0 100 100" className="w-full h-full">
                    <polygon points="43,50 57,50 50,7" fill="#ef4444" />
                 </svg>
               </motion.div>

               {/* Center Red Pivot Dot */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-[#ef4444] rounded-full z-30 shadow-sm flex items-center justify-center">
                 <div className="w-2 h-2 bg-white rounded-full" />
               </div>
            </div>
          </div>
        </motion.div>

        {/* Middle Area: Draw & Discard Piles */}
        <div className="relative flex-1 flex flex-row items-center justify-center gap-20 md:gap-32 pointer-events-auto translate-y-6">

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
              onClick={() => {
                const isInteractionPending = !!(
                  gameState.actionWindow || 
                  gameState.waitingForDefuse || 
                  gameState.waitingForTarget || 
                  gameState.waitingForSteal || 
                  gameState.waitingForFavor || 
                  gameState.waitingForImplodingInsert || 
                  gameState.futureCards || 
                  gameState.alteringFutureCards
                );
                if (isMyTurn && !isExploding && !isPawDrawing && !isInteractionPending) {
                  setIsPawDrawing(true);
                  setTimeout(() => {
                    onAction({ type: 'DRAW_CARD' });
                    setTimeout(() => setIsPawDrawing(false), 800);
                  }, 600); // Trigger action later because animation is slower
                }
              }}
              disabled={!isMyTurn || isExploding || isPawDrawing || !!(gameState.actionWindow || gameState.waitingForDefuse || gameState.waitingForTarget || gameState.waitingForImplodingInsert)}
              className={`relative group transition-all duration-300 z-10 shrink-0 aspect-[2.5/3.5] w-32 sm:w-40 rounded-[0.6rem] bg-[#8b1a28] border-2 border-black/90 ${
                isMyTurn && !isExploding ? 'cursor-pointer hover:scale-105 active:translate-y-2 active:shadow-none' : 'cursor-not-allowed opacity-90'
              }`}
              style={{
                boxShadow: (() => {
                  const cardCount = gameState.drawPileCount || 0;
                  // Scale thickness so it's proportional but not unrealistically thick.
                  // 23 cards will be about ~9px thick, which visually looks like a small stack.
                  const layers = Math.max(1, Math.ceil(cardCount / 2.5));
                  const shadowArray = Array.from({ length: layers }).map((_, i) => `-${i + 1}px ${i + 1}px 0 ${i % 2 === 0 ? '#fff' : '#000'}`);
                  // Ensure the bottom-most border is black for visual consistency
                  if (layers % 2 !== 0) {
                    shadowArray.push(`-${layers + 1}px ${layers + 1}px 0 #000`);
                  }
                  // Add a soft drop shadow if the pile is active/hoverable
                  if (isMyTurn && !isExploding) {
                    shadowArray.push('-12px 15px 20px rgba(0,0,0,0.4)');
                  }
                  return shadowArray.join(', ');
                })(),
                transform: 'rotate(-5deg) translateY(-10px)'
              }}
            >
              <div className="w-full h-full rounded-[0.4rem] flex flex-col items-center justify-center p-0 relative overflow-hidden border border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]">
                {gameState.faceUpTopCard ? (
                  <img 
                    src={`/cards/${gameState.faceUpTopCard.type}.png`}
                    alt={gameState.faceUpTopCard.name}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <>
                    <svg className="w-10 h-10 sm:w-14 sm:h-14 text-[#facc15] fill-current drop-shadow-md mb-2 mt-2" viewBox="0 0 64 64">
                       <path d="M16 40 L16 30 C16 20, 48 20, 48 30 L48 40 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                       <path d="M16 25 L10 15 L25 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                       <path d="M48 25 L54 15 L39 22 Z" fill="#facc15" stroke="#000" strokeWidth="2.5" />
                       <path d="M16 35 C5 35, 5 45, 12 45" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
                    </svg>
                    
                    <div className="flex flex-col items-center leading-none tracking-tighter transform -skew-x-3 -rotate-2 pb-2">
                      <span className="text-[#facc15] font-black text-sm sm:text-lg drop-shadow-[1px_1px_0_#000]">EXPLODING</span>
                      <div className="flex items-start">
                        <span className="text-white font-black text-xl sm:text-3xl drop-shadow-[1px_1px_0_#000] -mt-0.5">KITTENS</span>
                        <span className="text-white font-black text-[8px] sm:text-[10px] drop-shadow-[1px_1px_0_#000] ml-0.5 -mt-1">®</span>
                      </div>
                      <span className="text-white font-black text-3xl sm:text-5xl drop-shadow-[2px_2px_0_#000] -mt-1">2</span>
                    </div>
                  </>
                )}
              </div>
            </motion.button>

            <span 
              className="mt-6 sm:mt-8 text-white font-cartoon text-xl sm:text-2xl font-bold tracking-tighter" 
              style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 2px 4px 6px rgba(0,0,0,0.5)' }}
            >
               {gameState.drawPileCount} CARDS LEFT
            </span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center">
            <div className="relative w-32 sm:w-40 h-48 sm:h-60">
              {gameState.discardPile.length === 0 ? null : (
                gameState.discardPile
                  .map((card, i) => ({ card, i }))
                  .map(({ card, i }) => {
                    const isTop = i === gameState.discardPile.length - 1;
                    const rotation = isTop ? 15 : ((i * 27) % 50) - 25;
                    const xOffset = isTop ? 10 : ((i * 13) % 20) - 10;
                    const yOffset = isTop ? -5 : ((i * 17) % 20) - 10;

                    if (!isTop) {
                      // Static rendering for background cards in the discard pile stack
                      // This completely bypasses Framer Motion overhead, keeping rendering fast even with 40+ cards.
                      return (
                        <div 
                          key={card.id + '-' + i} 
                          className="absolute inset-0"
                          style={{ 
                            transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
                            zIndex: i 
                          }}
                        >
                          <CardView card={card} disabled={false} isStatic={true} className="w-32 sm:w-40 h-48 sm:h-60 pointer-events-none" />
                        </div>
                      );
                    }

                    // Animate only the top/newest card flying into the discard pile
                    return (
                      <motion.div 
                        key={card.id + '-' + i} 
                        className="absolute inset-0"
                        initial={{ y: -120, scale: 0.6, opacity: 0, rotate: 0 }}
                        animate={{ 
                          y: yOffset,
                          x: xOffset,
                          scale: 1, 
                          opacity: 1, 
                          rotate: rotation,
                        }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 70, 
                          damping: 15, 
                          duration: 0.8,
                        }}
                        style={{ zIndex: i }}
                      >
                        {/* Brief glow effect on newest card */}
                        <motion.div 
                          className="absolute -inset-2 rounded-[1.4rem] bg-yellow-300/30 blur-md pointer-events-none"
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                        <CardView card={card} disabled={false} layoutId={card.id} className="w-32 sm:w-40 h-48 sm:h-60" />
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

      {/* Alter The Future Overlay */}
      <AnimatePresence>
        {isAlteringFuture && alteringCards.length > 0 && (
          <motion.div 
            key="alter-future-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-3xl z-[60] flex flex-col items-center justify-center p-8 pointer-events-auto"
          >
              {/* Background animated orbs */}
              <motion.div 
                className="absolute w-96 h-96 rounded-full bg-emerald-600/10 blur-[100px]"
                animate={{ scale: [1, 1.3, 1], x: [-50, 50, -50], y: [-20, 20, -20] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div 
                className="absolute w-64 h-64 rounded-full bg-cyan-500/10 blur-[80px]"
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
                  👁️‍🗨️
                </motion.span>
                <h2 className="text-3xl sm:text-4xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400 uppercase tracking-tighter italic">
                  Alter The Future
                </h2>
                <p className="text-slate-400 mt-2 font-cartoon uppercase tracking-wider text-[10px] text-center">
                  Drag and drop to rearrange the top 3 cards
                </p>
              </motion.div>
              
              <Reorder.Group 
                axis="x" 
                values={alteringCards} 
                onReorder={setAlteringCards} 
                className="flex justify-center gap-6 sm:gap-10 mb-14"
              >
                 {alteringCards.map((card, i) => {
                    const labels = ['TOP', '2nd', '3rd'];
                    const labelColors = [
                      'from-red-500 to-orange-500 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.4)]',
                      'from-amber-500 to-yellow-500 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
                      'from-sky-500 to-blue-500 border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.3)]',
                    ];
                    return (
                      <Reorder.Item 
                        key={card.id} 
                        value={card}
                        initial={{ y: 120, opacity: 0, scale: 0.5 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 300, 
                          damping: 30,
                        }}
                        className="flex flex-col items-center cursor-grab active:cursor-grabbing relative"
                      >
                        <div className="relative">
                          {/* Highlight drop shadow when dragged */}
                          <CardView card={card} disabled className="w-28 sm:w-36 h-42 sm:h-54 pointer-events-none" />
                        </div>
                        <div className="mt-3 text-center absolute -bottom-10 pointer-events-none">
                          <span className={`text-[10px] sm:text-xs font-cartoon uppercase tracking-widest px-4 py-1.5 rounded-full border bg-gradient-to-r text-white ${labelColors[i]}`}>
                            {labels[i]}
                          </span>
                        </div>
                      </Reorder.Item>
                    );
                 })}
              </Reorder.Group>

              {/* Confirm Button */}
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => onAction({ type: 'CONFIRM_ALTER_FUTURE', reorderedCardIds: alteringCards.map(c => c.id) })}
                className="mt-6 px-10 py-3.5 font-cartoon text-xl tracking-widest text-white uppercase bg-gradient-to-r from-emerald-500 to-teal-600 border-2 border-emerald-400/50 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                Confirm Order
              </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosions & Alerts - Dramatic Defusing Banner */}
      <AnimatePresence>
        {(gameState.waitingForDefuse || gameState.waitingForImplodingInsert) && (gameState.waitingForDefuse !== socketId && gameState.waitingForImplodingInsert !== socketId) && (
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
                      {gameState.players.find(p => p.id === (gameState.waitingForDefuse || gameState.waitingForImplodingInsert))?.name} is {gameState.waitingForImplodingInsert ? 'inserting Imploding Kitten' : 'defusing'}!
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

      {/* Target Selection Dramatic Text */}
      <AnimatePresence>
        {showTargetModal && (
          <motion.div
            key="target-selection-text"
            initial={{ scale: 0, opacity: 0, rotate: -5 }}
            animate={{ scale: [1.2, 0.9, 1], opacity: 1, rotate: [5, -2, 0] }}
            exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="absolute top-[30%] left-0 w-full z-[45] pointer-events-none flex flex-col items-center justify-center"
          >
            <h1 
              className={`relative text-5xl md:text-7xl font-cartoon text-transparent bg-clip-text uppercase tracking-tighter text-center leading-none z-10 ${
                showTargetModal.type === 'FAVOR'
                  ? 'bg-gradient-to-b from-purple-300 via-purple-500 to-fuchsia-700'
                  : showTargetModal.type === '2-CARD'
                    ? 'bg-gradient-to-b from-orange-300 via-orange-500 to-red-700'
                    : showTargetModal.type === 'TARGETED_ATTACK'
                      ? 'bg-gradient-to-b from-amber-300 via-red-500 to-red-900'
                      : 'bg-gradient-to-b from-fuchsia-300 via-pink-500 to-rose-700'
              }`}
              style={{
                WebkitTextStroke: "4px black",
                filter: `drop-shadow(4px 6px 0px rgba(0,0,0,0.8)) drop-shadow(0px 0px 30px ${
                  showTargetModal.type === 'FAVOR' ? 'rgba(168,85,247,0.6)' 
                  : showTargetModal.type === '2-CARD' ? 'rgba(249,115,22,0.6)' 
                  : 'rgba(217,70,239,0.6)'
                })`,
              }}
            >
              {showTargetModal.type === 'FAVOR'
                  ? 'CHOOSE TARGET!'
                  : showTargetModal.type === '2-CARD'
                    ? 'STEAL FROM WHO?'
                    : showTargetModal.type === 'TARGETED_ATTACK'
                      ? 'ATTACK WHO?'
                      : 'CHOOSE A VICTIM!'}
            </h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm md:text-lg font-cartoon text-white uppercase tracking-widest mt-4 bg-black/60 px-6 py-2 rounded-full border border-white/20 shadow-xl"
            >
              {opponents.filter(o => !o.isEliminated && o.handCount > 0).length === 0 
                ? '⚠️ No valid targets available!' 
                : "Tap an opponent's avatar above"}
            </motion.p>
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

      {/* Kaboom (Defuse Required) / Imploding Kitten Overlay */}
      <AnimatePresence>
        {(isExploding || isImplodingInsert) && isMyTurn && (
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
                  className="text-7xl md:text-9xl font-cartoon text-transparent bg-clip-text bg-gradient-to-b from-red-300 via-orange-500 to-red-600 drop-shadow-[0_15px_30px_rgba(220,38,38,0.8)] uppercase tracking-tighter text-center leading-none"
                  animate={{ scale: [1, 1.05, 1], rotate: [0, -1, 1, 0] }}
                  transition={{ duration: 0.3, repeat: Infinity, ease: 'linear' }}
                >
                  {isImplodingInsert ? 'IMPLODING\nKITTEN!' : 'KABOOM!'}
                </motion.h2>
                <p className="text-xl md:text-2xl text-white font-cartoon uppercase tracking-widest mt-4 bg-black/40 px-6 py-2 rounded-full backdrop-blur-sm border border-red-500/30 shadow-lg text-center">
                  {isImplodingInsert ? 'YOU MUST PUT IT BACK (FACE UP) IN' : 'BOMB EXPLODES IN'} {gameState.bombCountdown ?? 15}s
                </p>
              </motion.div>
              
              {(hasDefuse || isImplodingInsert) ? (
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
                      onClick={() => { setDefuseInsertIndex(0); onAction({ type: isImplodingInsert ? 'IMPLODE_INSERT' : 'DEFUSE', insertIndex: 0 }); }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border-b-4 border-orange-700 text-white font-cartoon text-xl tracking-wider transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 shadow-md"
                    >
                      TOP
                    </button>
                    <button 
                      onClick={() => { setDefuseInsertIndex(1); onAction({ type: isImplodingInsert ? 'IMPLODE_INSERT' : 'DEFUSE', insertIndex: 1 }); }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 border-b-4 border-amber-600 text-amber-900 font-cartoon text-xl tracking-wider transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 shadow-md"
                    >
                      2ND
                    </button>
                    <button 
                      onClick={() => {
                        const idx = Math.floor(Math.random() * (gameState.drawPileCount + 1));
                        setDefuseInsertIndex(idx);
                        onAction({ type: isImplodingInsert ? 'IMPLODE_INSERT' : 'DEFUSE', insertIndex: idx });
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
                      onClick={() => onAction({ type: isImplodingInsert ? 'IMPLODE_INSERT' : 'DEFUSE', insertIndex: defuseInsertIndex })}
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
                {comboEffect.count === 3 ? '3 OF A KIND!' : 'PAIR!'}
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

      {/* Cat Paw Draw Animation Overlay */}
      <AnimatePresence>
        {isPawDrawing && (
          <motion.div
            initial={{ y: '100%', x: '-20%', scale: 1.2, rotate: -15 }}
            animate={{ 
              y: ['100%', '-5%', '100%'], 
              x: ['-20%', '0%', '20%'], 
              scale: [1.2, 0.9, 1.1],
              rotate: [-15, -5, 10]
            }}
            transition={{ 
              duration: 1.2,
              times: [0, 0.45, 1],
              ease: "easeInOut"
            }}
            className="absolute bottom-0 left-1/2 -ml-32 pointer-events-none z-[70] origin-bottom"
          >
            {/* Paw SVG based on EK2 image */}
            <svg width="350" height="450" viewBox="0 0 200 300" fill="none" className="filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-visible">
              <motion.g 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 1.2, times: [0, 0.44, 0.45, 1] }}
              >
                <g transform="translate(10, 0) rotate(-10)">
                  <rect x="0" y="0" width="160" height="220" rx="12" fill="#8b1a28" stroke="#000" strokeWidth="6" />
                  <rect x="6" y="6" width="148" height="208" rx="8" fill="none" stroke="#fff" strokeWidth="3" opacity="0.2" />
                  
                  {/* Cat Face Logo */}
                  <g transform="translate(48, 25)">
                    <path d="M16 40 L16 30 C16 20, 48 20, 48 30 L48 40 Z" fill="#facc15" stroke="#000" strokeWidth="3" />
                    <path d="M16 25 L10 15 L25 22 Z" fill="#facc15" stroke="#000" strokeWidth="3" />
                    <path d="M48 25 L54 15 L39 22 Z" fill="#facc15" stroke="#000" strokeWidth="3" />
                    <path d="M16 35 C5 35, 5 45, 12 45" stroke="#facc15" strokeWidth="4.5" fill="none" strokeLinecap="round" />
                  </g>

                  {/* SVG Text elements for EK2 */}
                  <g transform="translate(80, 115)" textAnchor="middle">
                    <text 
                      x="0" 
                      y="0" 
                      className="font-cartoon font-black text-[18px] fill-[#facc15] stroke-black stroke-[3px]"
                      style={{ paintOrder: 'stroke fill', transform: 'skewX(-6) rotate(-2)' }}
                    >
                      EXPLODING
                    </text>
                    <text 
                      x="0" 
                      y="26" 
                      className="font-cartoon font-black text-[24px] fill-white stroke-black stroke-[4px]"
                      style={{ paintOrder: 'stroke fill', transform: 'skewX(-6) rotate(-2)' }}
                    >
                      KITTENS
                    </text>
                    <text 
                      x="0" 
                      y="70" 
                      className="font-cartoon font-black text-[46px] fill-white stroke-black stroke-[5px]"
                      style={{ paintOrder: 'stroke fill', transform: 'skewX(-6) rotate(-2)' }}
                    >
                      2
                    </text>
                  </g>
                </g>
              </motion.g>
              {/* Thicker arm */}
              <path d="M20 300 L70 140 L180 140 L260 300 Z" fill="#e89849" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
              {/* Thicker Arm Stripes */}
              <path d="M35 230 L230 210 L235 250 L30 270 Z" fill="#b6652c" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
              <path d="M50 160 L195 145 L200 185 L45 200 Z" fill="#b6652c" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
              
              {/* Hand base (white) wider */}
              <path d="M50 160 C35 90, 205 90, 190 160 Z" fill="#FFF" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
              
              {/* Three Toes from the back (fatter) */}
              {/* Left Toe */}
              <path d="M55 130 C40 60, 100 50, 110 120" fill="#FFF" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              {/* Middle Toe */}
              <path d="M95 120 C90 40, 145 40, 140 120" fill="#FFF" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              {/* Right Toe */}
              <path d="M125 120 C130 50, 190 60, 175 130" fill="#FFF" stroke="#000" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
