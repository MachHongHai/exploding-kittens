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
  public lastTheft: { stealerId: string; victimId: string; cardId?: string } | null = null;

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

    // 1. Create base deck (46 cards)
    this.drawPile = createDeck(this.players.length);

    // 2. Deal 1 Defuse and 4 normal cards to each player
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
    const defusesRemaining = 6 - defusesGiven;
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
    this.lastTheft = null; // Clear theft animation on turn change
    
    // Find next active player
    while (this.players[nextIndex].isEliminated) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    
    this.currentPlayerIndex = nextIndex;
    this.getCurrentPlayer().turnsToPlay = 1; // Reset turns to play unless modified by attack
  }

  playCards(playerId: string, cardIds: string[], targetId?: string, requestedCardType?: CardType): { success: boolean; message?: string } {
    if (this.status !== 'PLAYING') return { success: false, message: "Game not playing" };
    if (this.waitingForDefuse) return { success: false, message: "A player is currently defusing a kitten!" };
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return { success: false, message: "Not your turn" };

    this.lastTheft = null; // Reset theft state for any new action

    if (!cardIds || cardIds.length === 0) return { success: false, message: "No cards selected" };

    // Validate ownership
    const cards: Card[] = [];
    for (const cid of cardIds) {
      const c = player.hand.find(card => card.id === cid);
      if (!c) return { success: false, message: "Card not found in hand" };
      cards.push(c);
    }

    const firstType = cards[0].type;
    const isSameType = cards.every(c => c.type === firstType);

    // 1 CARD COMBO
    if (cards.length === 1) {
      const card = cards[0];
      if (card.type.startsWith('CAT_CARD')) {
        return { success: false, message: "Cat cards must be played in pairs!" };
      }
      
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
          break;
        case CardType.SEE_THE_FUTURE:
          this.lastAction = `${player.name} played See The Future!`;
          break;
        case CardType.FAVOR:
          if (!targetId) {
            // Restore card if failed
            player.drawCard(this.discardPile.pop()!);
            return { success: false, message: "Favor requires a target" };
          }
          const target = this.players.find(p => p.id === targetId);
          if (target && target.handCount > 0) {
            const randomCardIndex = Math.floor(Math.random() * target.handCount);
            const stolenCard = target.hand.splice(randomCardIndex, 1)[0];
            player.drawCard(stolenCard);
            this.lastAction = `${player.name} played Favor on ${target.name} and stole a card.`;
            this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };
          } else {
            this.lastAction = `${player.name} played Favor on ${target?.name}, but they had no cards.`;
          }
          break;
        default:
          this.lastAction = `${player.name} played ${card.name}.`;
          break;
      }
      return { success: true };
    }

    // 2 CARD COMBO (PAIR)
    if (cards.length === 2) {
      if (!isSameType) return { success: false, message: "Cards must be the same type to play a pair" };
      if (!targetId) return { success: false, message: "A pair requires a target player to steal from" };
      
      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Target is invalid or has no cards" };

      // Remove cards and apply effect
      cards.forEach(c => {
        player.removeCard(c.id);
        this.discardPile.push(c);
      });

      const randomCardIndex = Math.floor(Math.random() * target.handCount);
      const stolenCard = target.hand.splice(randomCardIndex, 1)[0];
      player.drawCard(stolenCard);
      this.lastAction = `${player.name} played a Pair and blindly stole a card from ${target.name}.`;
      this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };
      return { success: true };
    }

    // 3 CARD COMBO (THREE OF A KIND)
    if (cards.length === 3) {
      if (!isSameType) return { success: false, message: "Cards must be the same type for 3 of a kind" };
      if (!targetId) return { success: false, message: "Requires a target player" };
      if (!requestedCardType) return { success: false, message: "Requires a requested card type" };

      const target = this.players.find(p => p.id === targetId);
      if (!target || target.handCount === 0) return { success: false, message: "Target is invalid or has no cards" };

      const targetCardIndex = target.hand.findIndex(c => c.type === requestedCardType);
      
      // If target does NOT have the card, return false so the player can guess again
      if (targetCardIndex === -1) {
        return { success: false, message: `${target.name} does not have a ${requestedCardType}. Try asking for a different card!` };
      }

      // They guessed right! Remove cards and apply effect.
      cards.forEach(c => {
        player.removeCard(c.id);
        this.discardPile.push(c);
      });

      const stolenCard = target.hand.splice(targetCardIndex, 1)[0];
      player.drawCard(stolenCard);
      this.lastAction = `${player.name} played 3 of a Kind and successfully stole a ${requestedCardType} from ${target.name}.`;
      this.lastTheft = { stealerId: player.id, victimId: target.id, cardId: stolenCard.id };
      return { success: true };
    }

    return { success: false, message: "Invalid combination. Only 1, 2, or 3 cards are allowed." };
  }

  drawPhase(playerId: string): 'SAFE' | 'EXPLODED' | 'DEFUSE_REQUIRED' {
    if (this.status !== 'PLAYING') return 'SAFE';
    if (this.waitingForDefuse) return 'SAFE';
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) return 'SAFE';

    this.lastTheft = null; // Clear theft state on draw phase
    const card = this.drawPile.pop();
    if (!card) return 'SAFE'; // Deck empty edge case

    if (card.type === CardType.EXPLODING_KITTEN) {
      this.lastAction = `${player.name} drew an Exploding Kitten!`;
      if (player.hasDefuse()) {
        this.waitingForDefuse = player.id;
        return 'DEFUSE_REQUIRED';
      } else {
        this.eliminatePlayer(player.id);
        return 'EXPLODED';
      }
    } else {
      player.drawCard(card);
      this.lastAction = `${player.name} drew a card.`;
      player.turnsToPlay -= 1;
      
      if (player.turnsToPlay <= 0) {
        this.nextTurn();
      }
      return 'SAFE';
    }
  }

  defuseKitten(playerId: string, insertIndex: number): boolean {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId || this.waitingForDefuse !== playerId) return false;

    const defuseCardId = player.getDefuseCardId();
    if (!defuseCardId) return false;

    const defuseCard = player.removeCard(defuseCardId);
    if (defuseCard) {
      this.discardPile.push(defuseCard);
    }

    // Insert kitten back
    const safeIndex = Math.max(0, Math.min(insertIndex, this.drawPile.length));
    // Array splice to insert at specific index. Note: end of array is top of deck.
    // If user wants to put it on top (next draw), index should be this.drawPile.length
    this.drawPile.splice(this.drawPile.length - safeIndex, 0, {
      id: generateCardId(),
      type: CardType.EXPLODING_KITTEN,
      name: 'Exploding Kitten',
      description: 'You explode and are out of the game!'
    });

    this.lastAction = `${player.name} defused the kitten!`;
    this.waitingForDefuse = null;
    
    player.turnsToPlay -= 1;
    if (player.turnsToPlay <= 0) {
      this.nextTurn();
    }
    return true;
  }

  eliminatePlayer(playerId: string) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    
    player.isEliminated = true;
    this.discardPile.push(...player.hand);
    player.hand = [];
    this.waitingForDefuse = null;
    
    this.lastAction = `${player.name} exploded and is out of the game!`;

    const alivePlayers = this.players.filter(p => !p.isEliminated);
    if (alivePlayers.length === 1) {
      this.status = 'GAME_OVER';
      this.winner = alivePlayers[0].name;
      this.lastAction = `${alivePlayers[0].name} wins the game!`;
    } else {
      this.nextTurn();
    }
  }

  // Get state tailored for a specific player (hiding other players' hands and the draw pile)
  getStateForPlayer(playerId: string): GameState {
    return {
      status: this.status,
      currentPlayerId: this.status === 'PLAYING' ? this.getCurrentPlayer()?.id : null,
      drawPileCount: this.drawPile.length,
      discardPile: this.discardPile.slice(-5), // Only send top 5 to save bandwidth
      lastAction: this.lastAction,
      winner: this.winner,
      waitingForDefuse: this.waitingForDefuse,
      lastTheft: this.lastTheft || undefined,
      players: this.players.map(p => {
        const isMe = p.id === playerId;
        return {
          id: p.id,
          name: p.name,
          handCount: p.handCount,
          isBot: p.isBot,
          turnsToPlay: p.turnsToPlay,
          isEliminated: p.isEliminated,
          hand: isMe ? p.hand : undefined, // Only send hand if it's the requesting player
        };
      })
    };
  }
}
