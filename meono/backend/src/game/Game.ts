import { Card, CardType, GameState, PlayerState } from '../../../shared/src/types';
import { Player, createDeck, generateCardId, shuffleDeck } from './models';

export class Game {
  public id: string;
  public players: Player[] = [];
  public drawPile: Card[] = [];
  public discardPile: Card[] = [];
  public currentPlayerIndex: number = 0;
  public status: 'LOBBY' | 'PLAYING' | 'GAME_OVER' = 'LOBBY';
  public lastAction: string | null = null;
  public winner: string | null = null;
  public waitingForDefuse: string | null = null;
  public waitingForSteal: { stealerId: string; victimId: string; count: number } | null = null;
  public waitingForFavor: { requesterId: string; victimId: string } | null = null;
  public lastTheft: { stealerId: string; victimId: string; cardId?: string } | null = null;
  public playerSeeingFuture: string | null = null;

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

    // 4. Final shuffle
    this.drawPile = shuffleDeck(this.drawPile);
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
  }

  clearFuture(playerId: string) {
    if (this.playerSeeingFuture === playerId) {
      this.playerSeeingFuture = null;
    }
  }

  playCards(playerId: string, cardIds: string[], targetId?: string, requestedCardType?: CardType): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') return { success: false, message: "Game not playing" };
    if (this.waitingForDefuse) return { success: false, message: "A player is currently defusing a kitten!" };
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return { success: false, message: "Not your turn" };

    this.lastTheft = null; 

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
      
      player.removeCard(card.id);
      this.discardPile.push(card);

      switch (card.type) {
        case CardType.ATTACK:
          this.lastAction = `${player.name} played Attack!`;
          player.turnsToPlay = 0;
          this.nextTurn();
          const nextPlayer = this.getCurrentPlayer();
          nextPlayer.turnsToPlay = nextPlayer.turnsToPlay === 1 ? 2 : nextPlayer.turnsToPlay + 2;
          break;
        case CardType.SKIP:
          this.lastAction = `${player.name} played Skip!`;
          player.turnsToPlay -= 1;
          if (player.turnsToPlay <= 0) this.nextTurn();
          break;
        case CardType.SHUFFLE:
          this.lastAction = `${player.name} played Shuffle!`;
          this.drawPile = shuffleDeck(this.drawPile);
          this.players.forEach(p => p.knownDeckTop = []);
          break;
        case CardType.SEE_THE_FUTURE:
          this.lastAction = `${player.name} played See The Future!`;
          const top3 = this.drawPile.slice(-3).reverse();
          player.knownDeckTop = top3.map(c => ({ cardType: c.type, cardName: c.name }));
          if (!player.isBot) {
            this.playerSeeingFuture = player.id;
          }
          break;
        case CardType.FAVOR:
          if (!targetId) return { success: false, message: "Favor requires a target" };
          const target = this.players.find(p => p.id === targetId);
          if (target && target.handCount > 0) {
            this.waitingForFavor = { requesterId: player.id, victimId: target.id };
            this.lastAction = `${player.name} played Favor on ${target.name}.`;
          }
          break;
        default:
          this.lastAction = `${player.name} played ${card.name}.`;
          break;
      }
      return { success: true };
    }

    if (cards.length === 2) {
      if (!isSameType) return { success: false, message: "Must be same type" };
      if (!targetId) return { success: false, message: "Requires target" };
      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Invalid target" };

      cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));

      if (!player.isBot) {
        this.waitingForSteal = { stealerId: player.id, victimId: target.id, count: 1 };
        this.lastAction = `${player.name} played a Pair on ${target.name}.`;
      } else {
        const stolenCard = target.hand.splice(Math.floor(Math.random() * target.handCount), 1)[0];
        player.drawCard(stolenCard);
        this.lastAction = `${player.name} played a Pair and stole from ${target.name}.`;
        this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };
      }
      return { success: true };
    }

    if (cards.length === 3) {
      if (!isSameType || !targetId || !requestedCardType) return { success: false, message: "Invalid 3-of-a-kind play" };
      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Invalid target" };

      const idx = target.hand.findIndex(c => c.type === requestedCardType);
      if (idx === -1) return { success: false, message: `${target.name} has no ${requestedCardType}!` };

      cards.forEach(c => player.removeCard(c.id) && this.discardPile.push(c));
      const stolenCard = target.hand.splice(idx, 1)[0];
      player.drawCard(stolenCard);
      this.lastAction = `${player.name} successfully guessed ${requestedCardType} from ${target.name}!`;
      this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };
      return { success: true };
    }

    return { success: false, message: "Invalid play" };
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
    
    return true;
  }

  drawPhase(playerId: string): 'SAFE' | 'EXPLODED' | 'DEFUSE_REQUIRED' {
    if (this.status !== 'PLAYING' || this.waitingForDefuse) return 'SAFE';
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return 'SAFE';

    this.lastTheft = null;
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
      if (player.hasDefuse()) {
        this.waitingForDefuse = player.id;
        return 'DEFUSE_REQUIRED';
      }
      this.eliminatePlayer(player.id);
      return 'EXPLODED';
    }
    player.drawCard(card);
    this.lastAction = `${player.name} drew a card.`;
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

    // The defusing player remembers exactly where the bomb was inserted
    player.knownDeckTop.splice(pos, 0, { cardType: CardType.EXPLODING_KITTEN, cardName: 'Exploding Kitten' });

    // Invalidate other players' memories since cards shifted
    this.players.forEach(p => {
      if (p.id !== player.id) {
        p.knownDeckTop = [];
      }
    });

    this.lastAction = `${player.name} defused the kitten!`;
    this.waitingForDefuse = null;
    if (--player.turnsToPlay <= 0) this.nextTurn();
    return true;
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
      discardPile: this.discardPile.slice(-10),
      lastAction: this.lastAction,
      winner: this.winner,
      waitingForDefuse: this.waitingForDefuse,
      waitingForSteal: this.waitingForSteal || undefined,
      waitingForFavor: this.waitingForFavor || undefined,
      lastTheft: this.lastTheft || undefined,
      futureCards: this.playerSeeingFuture === playerId ? this.drawPile.slice(-3).reverse() : undefined,
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
