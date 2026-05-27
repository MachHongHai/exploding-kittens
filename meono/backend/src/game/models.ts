import { Card, CardType } from '../../../shared/src/types';

export class Player {
  public id: string;
  public name: string;
  public hand: Card[] = [];
  public isBot: boolean;
  public turnsToPlay: number = 1;
  public isEliminated: boolean = false;

  constructor(id: string, name: string, isBot: boolean = false) {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
  }

  drawCard(card: Card) {
    this.hand.push(card);
  }

  removeCard(cardId: string): Card | undefined {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index !== -1) {
      return this.hand.splice(index, 1)[0];
    }
    return undefined;
  }

  hasDefuse(): boolean {
    return this.hand.some(c => c.type === CardType.DEFUSE);
  }
  
  getDefuseCardId(): string | undefined {
    return this.hand.find(c => c.type === CardType.DEFUSE)?.id;
  }

  get handCount() {
    return this.hand.length;
  }
}

export function generateCardId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function createDeck(playerCount: number): Card[] {
  const deck: Card[] = [];
  
  // Scale card counts based on player count
  // Base counts for 5 players (total 46 functional cards)
  // For 2-3 players, we reduce the count of action cards slightly
  const multiplier = playerCount <= 3 ? 0.7 : 1.0;
  
  const addCards = (type: CardType, count: number, name: string, description: string) => {
    const finalCount = Math.max(2, Math.round(count * multiplier));
    for (let i = 0; i < finalCount; i++) {
      deck.push({ id: generateCardId(), type, name, description });
    }
  };

  // Action Cards
  addCards(CardType.ATTACK, 4, 'Attack', 'End your turn without drawing and force the next player to take 2 turns.');
  addCards(CardType.SKIP, 4, 'Skip', 'End your turn without drawing.');
  addCards(CardType.FAVOR, 4, 'Favor', 'Force any other player to give you 1 card from their hand.');
  addCards(CardType.SHUFFLE, 4, 'Shuffle', 'Shuffle the draw pile.');
  addCards(CardType.SEE_THE_FUTURE, 5, 'See The Future', 'View the top 3 cards of the draw pile.');
  addCards(CardType.NOPE, 5, 'Nope', 'Stop any action except an Exploding Kitten or a Defuse card.');
  
  // Cat Cards (Always keep them in pairs of at least 2)
  addCards(CardType.CAT_CARD_1, 4, 'Tacocat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_2, 4, 'Cattermelon', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_3, 4, 'Hairy Potato Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_4, 4, 'Beard Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_5, 4, 'Rainbow-Ralphing Cat', 'Play as a pair to steal a random card.');

  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
