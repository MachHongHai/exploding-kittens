import { Card, CardType, GameState, PlayerState } from '../../../shared/src/types.js';
import { Player, createDeck, generateCardId, shuffleDeck } from './models.js';

export class Game {
  public id: string;
  public players: Player[] = [];
  public drawPile: Card[] = [];
  public discardPile: Card[] = [];
  public currentPlayerIndex: number = 0;
  public status: 'LOBBY' | 'PLAYING' | 'GAME_OVER' = 'LOBBY';
  private _lastAction: string | null = null;
  public actionHistory: string[] = [];
  public initialDrawPileCount: number = 0;

  get lastAction(): string | null {
    return this._lastAction;
  }

  set lastAction(value: string | null) {
    this._lastAction = value;
    if (value) {
      // Prevent duplicate consecutive entries
      if (this.actionHistory.length === 0 || this.actionHistory[this.actionHistory.length - 1] !== value) {
        this.actionHistory.push(value);
        if (this.actionHistory.length > 30) {
          this.actionHistory.shift();
        }
      }
    }
  }
  public winner: string | null = null;
  public turnExpiresAt?: number;
  public waitingForDefuse: string | null = null;
  public waitingForSteal: { stealerId: string; victimId: string; count: number; expiresAt: number } | null = null;
  public waitingForFavor: { requesterId: string; victimId: string; expiresAt: number } | null = null;
  public waitingForTarget: { type: 'FAVOR' | '2-CARD' | '3-CARD'; playerId: string; cardIds: string[]; expiresAt: number } | null = null;
  public lastTheft: { stealerId: string; victimId: string; cardId?: string } | null = null;
  public playerSeeingFuture: string | null = null;
  public pendingAction: {
    actionId: string;
    playerId: string;
    actionName: string;
    actionType: '1-CARD' | '2-CARD' | '3-CARD';
    cards: Card[];
    targetId?: string;
    requestedCardType?: CardType;
    nopeCount: number;
    expiresAt: number;
    lastNoperId?: string;
  } | null = null;
  public lastDefuseAction: { playerId: string; drawsSinceDefuse: number } | null = null;
  public bombCountdown: number | undefined;
  public lastNopeableAction: {
    type: 'ATTACK' | 'SKIP' | 'FAVOR' | '2-CARD' | '3-CARD' | 'NOPE';
    initiatorId: string;
    targetId: string;
    timestamp: number;
    stolenCard?: { card: Card; fromId: string; toId: string };
    prevPlayerIndex?: number;
    prevTurnsToPlay?: number;
    originalAction?: {
      type: CardType;
      playerId: string;
      actionType: '1-CARD' | '2-CARD' | '3-CARD';
      cards: Card[];
      targetId?: string;
      requestedCardType?: CardType;
    };
  } | null = null;

  constructor(id: string) {
    this.id = id;
  }

  addPlayer(player: Player) {
    if (this.status !== 'LOBBY') return;
    this.players.push(player);
  }

  start() {
    if (this.players.length < 2) throw new Error("Not enough players");
    this.status = 'PLAYING';
    this.currentPlayerIndex = 0;
    this.turnExpiresAt = Date.now() + 15000;

    // 1. Create base deck
    this.drawPile = createDeck(this.players.length);

    // 2. Deal 1 Defuse and 7 normal cards to each player
    this.players.forEach(player => {
      player.hand = [];
      player.turnsToPlay = 1;
      player.isEliminated = false;

      // Give Defuse
      player.drawCard({
        id: generateCardId(),
        type: CardType.DEFUSE,
        name: 'Defuse',
        description: 'Save yourself from an Exploding Kitten.'
      });

      // Give 7 normal cards
      for (let i = 0; i < 7; i++) {
        const card = this.drawPile.pop();
        if (card) player.drawCard(card);
      }
    });

    // 3. Insert Exploding Kittens (totalPlayers - 1) and remaining Defuses
    const bombCount = this.players.length - 1;
    for (let i = 0; i < bombCount; i++) {
      this.drawPile.push({
        id: generateCardId(),
        type: CardType.EXPLODING_KITTEN,
        name: 'Exploding Kitten',
        description: 'You explode and are out of the game!'
      });
    }

    const defusesGiven = this.players.length;
    const defusesRemaining = this.players.length <= 3 ? 2 : (6 - defusesGiven);
    for (let i = 0; i < defusesRemaining; i++) {
      this.drawPile.push({
        id: generateCardId(),
        type: CardType.DEFUSE,
        name: 'Defuse',
        description: 'Save yourself from an Exploding Kitten.'
      });
    }

    // If 1v1 (2 players), limit the draw pile to exactly 14 cards (1 kitten + 2 defuses + 11 other cards)
    if (this.players.length === 2) {
      const kittens = this.drawPile.filter(c => c.type === CardType.EXPLODING_KITTEN);
      const defuses = this.drawPile.filter(c => c.type === CardType.DEFUSE);
      const others = this.drawPile.filter(c => c.type !== CardType.EXPLODING_KITTEN && c.type !== CardType.DEFUSE);

      const selectedOthers = shuffleDeck(others).slice(0, 11);
      this.drawPile = [...kittens, ...defuses, ...selectedOthers];
    }

    // 4. Final shuffle
    this.drawPile = shuffleDeck(this.drawPile);
    this.initialDrawPileCount = this.drawPile.length;
  }

  getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.lastTheft = null;
    this.waitingForSteal = null;
    this.waitingForFavor = null;
    this.playerSeeingFuture = null;

    while (this.players[nextIndex].isEliminated) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }

    this.currentPlayerIndex = nextIndex;
    this.getCurrentPlayer().turnsToPlay = 1;
    this.turnExpiresAt = Date.now() + 15000;
  }

  clearFuture(playerId: string) {
    if (this.playerSeeingFuture === playerId) {
      this.playerSeeingFuture = null;
    }
  }

  playCards(playerId: string, cardIds: string[], targetId?: string, requestedCardType?: CardType): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') return { success: false, message: "Game not playing" };
    if (this.waitingForDefuse) return { success: false, message: "A player is currently defusing a kitten!" };
    if (this.pendingAction) return { success: false, message: "An action is currently waiting for Nope!" };
    if (this.waitingForTarget) return { success: false, message: "A player is currently selecting a target!" };

    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return { success: false, message: "Not your turn" };

    this.lastTheft = null;
    this.lastNopeableAction = null;

    if (!cardIds || cardIds.length === 0) return { success: false, message: "No cards selected" };

    const cards: Card[] = [];
    for (const cid of cardIds) {
      const c = player.hand.find(card => card.id === cid);
      if (!c) return { success: false, message: "Card not found in hand" };
      cards.push(c);
    }

    const firstType = cards[0].type;
    const isSameType = cards.every(c => c.type === firstType);

    if (cards.length === 1) {
      const card = cards[0];
      if (card.type.startsWith('CAT_CARD')) return { success: false, message: "Cat cards must be played in pairs!" };
      if (card.type === CardType.NOPE) return { success: false, message: "Nope cards must be played during an Action Window!" };
      if (card.type === CardType.DEFUSE || card.type === CardType.EXPLODING_KITTEN) return { success: false, message: "Cannot play this card normally!" };

      if (card.type === CardType.FAVOR && !targetId) {
        cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
        this.lastAction = `${player.name} played Favor!`;
        this.waitingForTarget = {
          type: 'FAVOR',
          playerId,
          cardIds,
          expiresAt: Date.now() + 10000
        };
        return { success: true };
      }

      cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
      this.lastAction = `${player.name} played ${card.name}!`;
      const target = this.players.find(p => p.id === targetId);
      if (target) {
        this.lastAction = `${player.name} played Favor!`;
        this.lastAction = `${player.name} targeted ${target.name} for Favor!`;
      }
      this.pendingAction = {
        actionId: generateCardId(),
        playerId,
        actionName: card.name,
        actionType: '1-CARD',
        cards,
        targetId,
        nopeCount: 0,
        expiresAt: Date.now() + 5000
      };
      return { success: true };
    }

    if (cards.length === 2) {
      if (!isSameType) return { success: false, message: "Must be same type" };
      if (!targetId) {
        cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
        this.lastAction = `${player.name} played a Pair!`;
        this.waitingForTarget = {
          type: '2-CARD',
          playerId,
          cardIds,
          expiresAt: Date.now() + 10000
        };
        return { success: true };
      }
      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Invalid target" };

      cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
      this.lastAction = `${player.name} played a Pair!`;
      this.lastAction = `${player.name} targeted ${target.name} for Pair!`;
      this.pendingAction = {
        actionId: generateCardId(),
        playerId,
        actionName: 'Pair',
        actionType: '2-CARD',
        cards,
        targetId,
        nopeCount: 0,
        expiresAt: Date.now() + 5000
      };
      return { success: true };
    }

    if (cards.length === 3) {
      if (!isSameType) return { success: false, message: "Must be same type" };
      if (!targetId) {
        cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
        this.lastAction = `${player.name} played 3 of a Kind!`;
        this.waitingForTarget = {
          type: '3-CARD',
          playerId,
          cardIds,
          expiresAt: Date.now() + 10000
        };
        return { success: true };
      }
      if (!requestedCardType) return { success: false, message: "Invalid 3-of-a-kind play (missing guess type)" };
      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Invalid target" };

      const idx = target.hand.findIndex(c => c.type === requestedCardType);
      if (idx === -1) return { success: false, message: `${target.name} has no ${requestedCardType}!` };

      cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
      this.lastAction = `${player.name} played 3 of a Kind!`;
      const guessType = requestedCardType ? ` (${requestedCardType.replace(/_/g, ' ')})` : '';
      this.lastAction = `${player.name} targeted ${target.name} for 3 of a Kind${guessType}!`;
      this.pendingAction = {
        actionId: generateCardId(),
        playerId,
        actionName: 'Three of a kind',
        actionType: '3-CARD',
        cards,
        targetId,
        requestedCardType,
        nopeCount: 0,
        expiresAt: Date.now() + 5000
      };
      return { success: true };
    }

    return { success: false, message: "Invalid play" };
  }

  playNope(playerId: string, cardId: string): { success: boolean; message?: string } {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, message: "Player not found" };

    const nopeCard = player.hand.find(c => c.id === cardId && c.type === CardType.NOPE);
    if (!nopeCard) return { success: false, message: "Nope card not found in hand" };

    // Case 1: Standard pending action window (within 5s)
    if (this.pendingAction) {
      if (this.pendingAction.lastNoperId === playerId) return { success: false, message: "You cannot Nope your own Nope!" };

      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);
      this.pendingAction.nopeCount++;
      this.pendingAction.lastNoperId = playerId;
      this.pendingAction.expiresAt = Date.now() + 5000;
      this.lastAction = `${player.name} played Nope! (Total Nopes: ${this.pendingAction.nopeCount})`;
      return { success: true };
    }

    // Case 2: Active waitingForFavor (victim plays Nope)
    if (this.waitingForFavor && this.waitingForFavor.victimId === playerId) {
      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);
      const requester = this.players.find(p => p.id === this.waitingForFavor!.requesterId);
      this.lastAction = `${player.name} NOPED the Favor from ${requester?.name || 'opponent'}!`;
      this.waitingForFavor = null;
      return { success: true };
    }

    // Case 3: Active waitingForSteal (victim plays Nope)
    if (this.waitingForSteal && this.waitingForSteal.victimId === playerId) {
      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);
      const stealer = this.players.find(p => p.id === this.waitingForSteal!.stealerId);
      this.lastAction = `${player.name} NOPED the Steal from ${stealer?.name || 'opponent'}!`;
      this.waitingForSteal = null;
      return { success: true };
    }

    // Case 4: Recent card transfer flying animation (within 1000ms)
    if (this.lastNopeableAction &&
      (this.lastNopeableAction.type === '2-CARD' || this.lastNopeableAction.type === '3-CARD' || this.lastNopeableAction.type === 'FAVOR') &&
      this.lastNopeableAction.targetId === playerId &&
      Date.now() - this.lastNopeableAction.timestamp < 1000 &&
      this.lastNopeableAction.stolenCard) {

      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);

      // Revert card transfer
      const { card, fromId, toId } = this.lastNopeableAction.stolenCard;
      const receiver = this.players.find(p => p.id === toId);
      const originalOwner = this.players.find(p => p.id === fromId);
      if (receiver && originalOwner) {
        receiver.removeCard(card.id);
        originalOwner.drawCard(card);
      }

      // Pop the intermediate transfer log to avoid confusion
      const lastLog = this.actionHistory[this.actionHistory.length - 1];
      if (lastLog && (lastLog.includes('gave a card') || lastLog.includes('picked a card') || lastLog.includes('stole') || lastLog.includes('successfully guessed') || lastLog.includes('resolved'))) {
        this.actionHistory.pop();
      }

      const initiator = this.players.find(p => p.id === this.lastNopeableAction!.initiatorId);
      this.lastAction = `${player.name} NOPED and cancelled the card transfer from ${initiator?.name || 'opponent'}!`;
      this.lastNopeableAction = null;
      return { success: true };
    }

    // Case 5: Attack/Skip active turn change (current player plays Nope before drawing/playing)
    if (this.lastNopeableAction &&
      (this.lastNopeableAction.type === 'ATTACK' || this.lastNopeableAction.type === 'SKIP') &&
      this.currentPlayerIndex === this.players.findIndex(p => p.id === playerId) &&
      this.lastNopeableAction.prevPlayerIndex !== undefined &&
      this.lastNopeableAction.prevTurnsToPlay !== undefined) {

      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);

      // Revert turn and turnsToPlay
      this.currentPlayerIndex = this.lastNopeableAction.prevPlayerIndex;
      this.players[this.currentPlayerIndex].turnsToPlay = this.lastNopeableAction.prevTurnsToPlay;

      const initiator = this.players.find(p => p.id === this.lastNopeableAction!.initiatorId);
      this.lastAction = `${player.name} NOPED the ${this.lastNopeableAction.type}! Turn reverts to ${initiator?.name || 'previous player'}.`;
      this.lastNopeableAction = null;
      return { success: true };
    }

    // Case 6: Noping a resolved Nope (counter-noping after the window has expired)
    if (this.lastNopeableAction &&
      this.lastNopeableAction.type === 'NOPE' &&
      this.lastNopeableAction.originalAction) {

      player.removeCard(nopeCard.id);
      this.discardPile.push(nopeCard);

      const orig = this.lastNopeableAction.originalAction;
      this.lastAction = `${player.name} NOPED the Nope! Reinstating ${orig.type}.`;
      this.lastNopeableAction = null;

      // Re-execute original action
      if (orig.type === CardType.ATTACK) {
        const attackPrevIndex = this.currentPlayerIndex;
        const attackPrevTurns = this.players[this.currentPlayerIndex].turnsToPlay;
        // Chained Attack stacking
        const stackedTurns = this.players[this.currentPlayerIndex].turnsToPlay > 1
          ? this.players[this.currentPlayerIndex].turnsToPlay + 2 : 2;
        this.players[this.currentPlayerIndex].turnsToPlay = 0;
        this.nextTurn();
        const nextPlayer = this.getCurrentPlayer();
        nextPlayer.turnsToPlay = stackedTurns;

        this.lastNopeableAction = {
          type: 'ATTACK',
          initiatorId: orig.playerId,
          targetId: nextPlayer.id,
          timestamp: Date.now(),
          prevPlayerIndex: attackPrevIndex,
          prevTurnsToPlay: attackPrevTurns
        };
      } else if (orig.type === CardType.SKIP) {
        const skipPrevIndex = this.currentPlayerIndex;
        const skipPrevTurns = this.players[this.currentPlayerIndex].turnsToPlay;
        this.players[this.currentPlayerIndex].turnsToPlay -= 1;
        if (this.players[this.currentPlayerIndex].turnsToPlay <= 0) this.nextTurn();

        this.lastNopeableAction = {
          type: 'SKIP',
          initiatorId: orig.playerId,
          targetId: this.getCurrentPlayer().id,
          timestamp: Date.now(),
          prevPlayerIndex: skipPrevIndex,
          prevTurnsToPlay: skipPrevTurns
        };
      } else if (orig.type === CardType.FAVOR) {
        const target = this.players.find(p => p.id === orig.targetId);
        if (target && target.handCount > 0) {
          this.waitingForFavor = { requesterId: orig.playerId, victimId: target.id, expiresAt: Date.now() + 10000 };
        }
      } else if (orig.actionType === '2-CARD') {
        const target = this.players.find(p => p.id === orig.targetId);
        const origPlayer = this.players.find(p => p.id === orig.playerId);
        if (target && target.handCount > 0 && origPlayer) {
          if (!origPlayer.isBot) {
            this.waitingForSteal = { stealerId: orig.playerId, victimId: target.id, count: 1, expiresAt: Date.now() + 10000 };
          } else {
            const stolenCard = target.hand.splice(Math.floor(Math.random() * target.handCount), 1)[0];
            origPlayer.drawCard(stolenCard);
            this.lastAction = `${origPlayer.name} played a Pair and stole from ${target.name}.`;
            this.lastTheft = { stealerId: orig.playerId, victimId: target.id, cardId: stolenCard.id };

            this.lastNopeableAction = {
              type: '2-CARD',
              initiatorId: orig.playerId,
              targetId: target.id,
              timestamp: Date.now(),
              stolenCard: {
                card: stolenCard,
                fromId: target.id,
                toId: orig.playerId
              }
            };
          }
        }
      } else if (orig.actionType === '3-CARD') {
        const target = this.players.find(p => p.id === orig.targetId);
        const origPlayer = this.players.find(p => p.id === orig.playerId);
        if (target && target.handCount > 0 && orig.requestedCardType && origPlayer) {
          const idx = target.hand.findIndex(c => c.type === orig.requestedCardType);
          if (idx !== -1) {
            const stolenCard = target.hand.splice(idx, 1)[0];
            origPlayer.drawCard(stolenCard);
            this.lastAction = `${origPlayer.name} successfully guessed ${orig.requestedCardType} from ${target.name}!`;
            this.lastTheft = { stealerId: orig.playerId, victimId: target.id, cardId: stolenCard.id };

            this.lastNopeableAction = {
              type: '3-CARD',
              initiatorId: orig.playerId,
              targetId: target.id,
              timestamp: Date.now(),
              stolenCard: {
                card: stolenCard,
                fromId: target.id,
                toId: orig.playerId
              }
            };
          }
        }
      }

      return { success: true };
    }

    return { success: false, message: "Too late to Nope!" };
  }

  resolvePendingAction() {
    if (!this.pendingAction) return;

    const action = this.pendingAction;
    this.pendingAction = null;

    const isNoped = action.nopeCount % 2 !== 0;
    const player = this.players.find(p => p.id === action.playerId);

    if (!player) return;

    if (isNoped) {
      this.lastAction = `${player.name}'s ${action.actionName} was Noped!`;

      this.lastNopeableAction = {
        type: 'NOPE',
        initiatorId: action.lastNoperId || '',
        targetId: action.playerId,
        timestamp: Date.now(),
        originalAction: {
          type: action.cards[0].type,
          playerId: action.playerId,
          actionType: action.actionType,
          cards: action.cards,
          targetId: action.targetId,
          requestedCardType: action.requestedCardType
        }
      };
      return;
    }

    // Execute the action
    if (action.actionType === '1-CARD') {
      const card = action.cards[0];
      switch (card.type) {
        case CardType.ATTACK: {
          const attackPrevIndex = this.currentPlayerIndex;
          const attackPrevTurns = player.turnsToPlay;

          // Chained Attack: if player was under attack (turnsToPlay > 1), stack remaining turns + 2
          const stackedTurns = player.turnsToPlay > 1 ? player.turnsToPlay + 2 : 2;

          player.turnsToPlay = 0;
          this.nextTurn();
          const nextPlayer = this.getCurrentPlayer();
          nextPlayer.turnsToPlay = stackedTurns;
          this.lastAction = `${nextPlayer.name} has ${stackedTurns} turns to play!`;

          this.lastNopeableAction = {
            type: 'ATTACK',
            initiatorId: player.id,
            targetId: nextPlayer.id,
            timestamp: Date.now(),
            prevPlayerIndex: attackPrevIndex,
            prevTurnsToPlay: attackPrevTurns
          };
          break;
        }
        case CardType.SKIP: {
          const skipPrevIndex = this.currentPlayerIndex;
          const skipPrevTurns = player.turnsToPlay;

          this.lastAction = `${player.name} skipped their turn.`;
          player.turnsToPlay -= 1;
          const endedTurn = player.turnsToPlay <= 0;
          if (endedTurn) this.nextTurn();

          this.lastNopeableAction = {
            type: 'SKIP',
            initiatorId: player.id,
            targetId: this.getCurrentPlayer().id,
            timestamp: Date.now(),
            prevPlayerIndex: skipPrevIndex,
            prevTurnsToPlay: skipPrevTurns
          };
          break;
        }
        case CardType.SHUFFLE:
          this.lastAction = `Deck shuffled.`;
          this.drawPile = shuffleDeck(this.drawPile);
          this.players.forEach(p => p.knownDeckTop = []);
          this.lastDefuseAction = null; // Clear suspected positions
          break;
        case CardType.SEE_THE_FUTURE:
          // No additional log needed, keep the "played See The Future!" log
          const top3 = this.drawPile.slice(-3).reverse();
          player.knownDeckTop = top3.map(c => ({ cardType: c.type, cardName: c.name }));
          if (!player.isBot) {
            this.playerSeeingFuture = player.id;
          }
          break;
        case CardType.FAVOR:
          const target = this.players.find(p => p.id === action.targetId);
          if (target && target.handCount > 0) {
            this.waitingForFavor = { requesterId: player.id, victimId: target.id, expiresAt: Date.now() + 10000 };
            this.lastAction = `Waiting for ${target.name} to give a card to ${player.name}.`;
          }
          break;
        default:
          this.lastAction = `${player.name} played ${card.name}.`;
          break;
      }
    } else if (action.actionType === '2-CARD') {
      const target = this.players.find(p => p.id === action.targetId);
      if (target && target.handCount > 0) {
        if (!player.isBot) {
          this.waitingForSteal = { stealerId: player.id, victimId: target.id, count: 1, expiresAt: Date.now() + 10000 };
          this.lastAction = `Waiting for ${player.name} to steal a card from ${target.name}.`;
        } else {
          const stolenCard = target.hand.splice(Math.floor(Math.random() * target.handCount), 1)[0];
          player.drawCard(stolenCard);
          this.lastAction = `${player.name} stole a card from ${target.name}.`;
          this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };

          this.lastNopeableAction = {
            type: '2-CARD',
            initiatorId: player.id,
            targetId: target.id,
            timestamp: Date.now(),
            stolenCard: {
              card: stolenCard,
              fromId: target.id,
              toId: player.id
            }
          };
        }
      }
    } else if (action.actionType === '3-CARD') {
      const target = this.players.find(p => p.id === action.targetId);
      if (target && target.handCount > 0 && action.requestedCardType) {
        const idx = target.hand.findIndex(c => c.type === action.requestedCardType);
        if (idx !== -1) {
          const stolenCard = target.hand.splice(idx, 1)[0];
          player.drawCard(stolenCard);
          this.lastAction = `${player.name} successfully guessed and stole ${action.requestedCardType!.replace(/_/g, ' ')} from ${target.name}!`;
          this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };

          this.lastNopeableAction = {
            type: '3-CARD',
            initiatorId: player.id,
            targetId: target.id,
            timestamp: Date.now(),
            stolenCard: {
              card: stolenCard,
              fromId: target.id,
              toId: player.id
            }
          };
        } else {
          this.lastAction = `${player.name} guessed ${action.requestedCardType!.replace(/_/g, ' ')} from ${target.name} but guess was incorrect.`;
        }
      }
    }
  }

  stealCard(stealerId: string, victimId: string, cardIndex: number): boolean {
    if (!this.waitingForSteal || this.waitingForSteal.stealerId !== stealerId) return false;
    const stealer = this.players.find(p => p.id === stealerId);
    const victim = this.players.find(p => p.id === victimId);
    if (!stealer || !victim || cardIndex < 0 || cardIndex >= victim.hand.length) return false;
    const card = victim.hand.splice(cardIndex, 1)[0];
    stealer.drawCard(card);
    this.lastAction = `${stealer.name} picked a card from ${victim.name}.`;
    this.lastTheft = { stealerId, victimId, cardId: card.id };
    this.waitingForSteal = null;

    this.lastNopeableAction = {
      type: '2-CARD',
      initiatorId: stealerId,
      targetId: victimId,
      timestamp: Date.now(),
      stolenCard: {
        card,
        fromId: victimId,
        toId: stealerId
      }
    };

    return true;
  }

  giveCard(victimId: string, requesterId: string, cardId: string): boolean {
    if (!this.waitingForFavor || this.waitingForFavor.victimId !== victimId || this.waitingForFavor.requesterId !== requesterId) return false;

    const victim = this.players.find(p => p.id === victimId);
    const requester = this.players.find(p => p.id === requesterId);

    if (!victim || !requester) return false;

    const card = victim.removeCard(cardId);
    if (!card) return false;

    requester.drawCard(card);
    this.lastAction = `${victim.name} gave a card to ${requester.name} (Favor).`;
    this.lastTheft = { stealerId: requesterId, victimId, cardId: card.id };
    this.waitingForFavor = null;

    this.lastNopeableAction = {
      type: 'FAVOR',
      initiatorId: requesterId,
      targetId: victimId,
      timestamp: Date.now(),
      stolenCard: {
        card,
        fromId: victimId,
        toId: requesterId
      }
    };

    return true;
  }

  drawPhase(playerId: string): 'SAFE' | 'EXPLODED' | 'DEFUSE_REQUIRED' {
    if (this.status !== 'PLAYING' || this.waitingForDefuse) return 'SAFE';
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return 'SAFE';

    this.lastTheft = null;
    this.lastNopeableAction = null; // Clear nopeable actions
    const card = this.drawPile.pop();
    if (!card) return 'SAFE';

    // Shift known top cards for all players
    this.players.forEach(p => {
      if (p.knownDeckTop.length > 0) {
        p.knownDeckTop.shift();
      }
    });

    if (card.type === CardType.EXPLODING_KITTEN) {
      this.lastAction = `${player.name} drew an Exploding Kitten!`;
      this.lastDefuseAction = null;
      if (player.hasDefuse()) {
        this.waitingForDefuse = player.id;
        return 'DEFUSE_REQUIRED';
      }
      this.eliminatePlayer(player.id);
      return 'EXPLODED';
    }
    player.drawCard(card);
    this.lastAction = `${player.name} drew a card.`;

    if (this.lastDefuseAction) {
      this.lastDefuseAction.drawsSinceDefuse++;
    }

    if (--player.turnsToPlay <= 0) this.nextTurn();
    return 'SAFE';
  }

  defuseKitten(playerId: string, insertIndex: number): boolean {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.waitingForDefuse !== playerId) return false;

    const defuseId = player.getDefuseCardId();
    if (!defuseId) return false;

    const defuseCard = player.removeCard(defuseId);
    if (defuseCard) this.discardPile.push(defuseCard);

    const pos = Math.max(0, Math.min(insertIndex, this.drawPile.length));
    this.drawPile.splice(this.drawPile.length - pos, 0, {
      id: generateCardId(),
      type: CardType.EXPLODING_KITTEN,
      name: 'Exploding Kitten',
      description: 'Boom!'
    });

    // Pad knownDeckTop if it's shorter than the insert position
    while (player.knownDeckTop.length < pos) {
      player.knownDeckTop.push({ cardType: 'UNKNOWN', cardName: 'Unknown Card' });
    }

    // The defusing player remembers exactly where the bomb was inserted
    player.knownDeckTop.splice(pos, 0, { cardType: CardType.EXPLODING_KITTEN, cardName: 'Exploding Kitten' });

    // Invalidate other players' memories since cards shifted
    this.players.forEach(p => {
      if (p.id !== player.id) {
        p.knownDeckTop = [];
      }
    });

    this.lastDefuseAction = { playerId, drawsSinceDefuse: 0 };

    this.lastAction = `${player.name} defused the kitten!`;
    this.waitingForDefuse = null;
    if (--player.turnsToPlay <= 0) this.nextTurn();
    return true;
  }

  selectTarget(playerId: string, targetId: string, requestedCardType?: CardType, isTimeout: boolean = false) {
    if (!this.waitingForTarget || this.waitingForTarget.playerId !== playerId) return;

    const player = this.players.find(p => p.id === playerId);
    const target = this.players.find(p => p.id === targetId);
    if (!player || !target) return;

    const { type, cardIds } = this.waitingForTarget;
    const cards = this.discardPile.filter(c => cardIds.includes(c.id));

    const typeLabel = type === 'FAVOR' ? 'Favor' : type === '2-CARD' ? 'Pair' : '3 of a Kind';
    this.lastAction = `${player.name} targeted ${target.name} for ${typeLabel}${isTimeout ? ' (Timeout)' : ''}!`;

    const actionName = type === 'FAVOR' ? 'Favor' : type === '2-CARD' ? 'Pair' : 'Three of a kind';
    this.pendingAction = {
      actionId: generateCardId(),
      playerId,
      actionName,
      actionType: type === 'FAVOR' ? '1-CARD' : type,
      cards,
      targetId,
      requestedCardType,
      nopeCount: 0,
      expiresAt: Date.now() + 5000
    };
  }

  eliminatePlayer(playerId: string) {
    const p = this.players.find(p => p.id === playerId);
    if (!p) return;
    p.isEliminated = true;
    this.discardPile.push(...p.hand);
    p.hand = [];
    this.waitingForDefuse = null;
    this.lastAction = `${p.name} exploded!`;
    const alive = this.players.filter(p => !p.isEliminated);
    if (alive.length === 1) {
      this.status = 'GAME_OVER';
      this.winner = alive[0].name;
    } else {
      this.nextTurn();
    }
  }

  getStateForPlayer(playerId: string): GameState {
    return {
      status: this.status,
      currentPlayerId: this.status === 'PLAYING' ? this.getCurrentPlayer()?.id : null,
      drawPileCount: this.drawPile.length,
      initialDrawPileCount: this.initialDrawPileCount,
      explodingKittensCount: this.drawPile.filter(c => c.type === CardType.EXPLODING_KITTEN).length,
      actionHistory: this.actionHistory,
      discardPile: this.discardPile.slice(-10),
      lastAction: this.lastAction,
      winner: this.winner,
      turnExpiresAt: this.turnExpiresAt,
      waitingForDefuse: this.waitingForDefuse,
      waitingForSteal: this.waitingForSteal || undefined,
      waitingForFavor: this.waitingForFavor || undefined,
      waitingForTarget: this.waitingForTarget ? {
        type: this.waitingForTarget.type,
        playerId: this.waitingForTarget.playerId,
        expiresAt: this.waitingForTarget.expiresAt
      } : undefined,
      lastTheft: this.lastTheft || undefined,
      lastNopeableAction: this.lastNopeableAction,
      futureCards: this.playerSeeingFuture === playerId ? this.drawPile.slice(-3).reverse() : undefined,
      actionWindow: this.pendingAction ? {
        actionId: this.pendingAction.actionId,
        actionName: this.pendingAction.actionName,
        expiresAt: this.pendingAction.expiresAt,
        nopeCount: this.pendingAction.nopeCount,
        targetName: this.players.find(p => p.id === this.pendingAction?.targetId)?.name,
        initiatorId: this.pendingAction.playerId,
        lastNoperId: this.pendingAction.lastNoperId
      } : undefined,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        handCount: p.handCount,
        isBot: p.isBot,
        turnsToPlay: p.turnsToPlay,
        isEliminated: p.isEliminated,
        hand: p.id === playerId ? p.hand : undefined
      }))
    };
  }
}
