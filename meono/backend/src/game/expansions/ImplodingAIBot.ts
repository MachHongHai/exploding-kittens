import { GameEngine } from '../GameEngine.js';
import { CardType, PlayerAction } from '../../../../shared/src/types.js';

export class ImplodingAIBot {
  
  static isBomb(cardType: string): boolean {
    return cardType === CardType.EXPLODING_KITTEN || cardType === CardType.IMPLODING_KITTEN;
  }

  static getExpansionEscapeAction(botId: string, game: GameEngine): PlayerAction | null {
    const player = game.players.find(p => p.id === botId)!;
    const hand = player.hand;
    
    // Check for Targeted Attack
    const targetedAttackCards = hand.filter(c => c.type === CardType.TARGETED_ATTACK);
    if (targetedAttackCards.length > 0) {
      // Find a target (not us, not eliminated)
      const target = game.players.find(p => p.id !== botId && !p.isEliminated);
      if (target) {
        return { type: 'PLAY_CARDS', cardIds: [targetedAttackCards[0].id], targetId: target.id };
      }
    }

    // Check for Alter the Future
    const alterFutureCards = hand.filter(c => c.type === CardType.ALTER_THE_FUTURE_3X);
    if (alterFutureCards.length > 0) {
      return { type: 'PLAY_CARDS', cardIds: [alterFutureCards[0].id] };
    }

    // Check for Draw from the Bottom
    const drawBottomCards = hand.filter(c => c.type === CardType.DRAW_FROM_THE_BOTTOM);
    if (drawBottomCards.length > 0) {
      return { type: 'PLAY_CARDS', cardIds: [drawBottomCards[0].id] };
    }

    // Check for Reverse
    const reverseCards = hand.filter(c => c.type === CardType.REVERSE);
    if (reverseCards.length > 0) {
      return { type: 'PLAY_CARDS', cardIds: [reverseCards[0].id] };
    }

    return null;
  }

  static handleBotAlteringFuture(botId: string, game: GameEngine): PlayerAction | null {
    if (game.playerAlteringFuture !== botId || !game.alteringFutureCards) {
      return null;
    }

    // AI Logic for Alter the Future:
    // Sort the cards to maximize survival.
    // Bombs to the bottom.
    // Defuses/Safe cards to the top.
    
    // We clone the array to sort it safely
    const sortedCards = [...game.alteringFutureCards].sort((a, b) => {
      // Priority 1: Exploding Kittens to the bottom (higher index)
      const isABomb = a.type === CardType.EXPLODING_KITTEN || a.type === CardType.IMPLODING_KITTEN;
      const isBBomb = b.type === CardType.EXPLODING_KITTEN || b.type === CardType.IMPLODING_KITTEN;
      
      if (isABomb && !isBBomb) return 1; // Put A after B
      if (!isABomb && isBBomb) return -1; // Put A before B

      // Priority 2: Good cards (Defuse, Attack, Skip) to the top
      const getCardValue = (type: CardType) => {
        switch (type) {
          case CardType.DEFUSE: return 5;
          case CardType.ATTACK: 
          case CardType.TARGETED_ATTACK: return 4;
          case CardType.SKIP: return 3;
          case CardType.ALTER_THE_FUTURE_3X: return 2;
          default: return 1;
        }
      };

      return getCardValue(b.type) - getCardValue(a.type);
    });

    const reorderedCardIds = sortedCards.map(c => c.id);

    return { type: 'CONFIRM_ALTER_FUTURE', reorderedCardIds };
  }
}
