import { Game } from '../Game.js';
import { CardType, PlayerAction } from '../../../../shared/src/types.js';

export class ImplodingKittensBotLogic {
  
  static handleBotAlteringFuture(botId: string, game: Game): PlayerAction | null {
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
