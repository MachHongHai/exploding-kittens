import { Card, CardType } from '../../../shared/src/types.js';

export class Player {
  public id: string;
  public name: string;
  public hand: Card[] = [];
  public isBot: boolean;
  public turnsToPlay: number = 1;
  public isEliminated: boolean = false;
  public knownDeckTop: { cardType: string; cardName: string; isFaceUp?: boolean }[] = [];

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


export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
