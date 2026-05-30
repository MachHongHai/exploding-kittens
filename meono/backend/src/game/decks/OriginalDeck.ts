import { Card, CardType } from '../../../../shared/src/types.js';
import { generateCardId, shuffleDeck } from '../models.js';

export function createOriginalDeck(playerCount: number): Card[] {
  const deck: Card[] = [];
  
  const addCards = (type: CardType, count: number, name: string, description: string) => {
    for (let i = 0; i < count; i++) {
      deck.push({ id: generateCardId(), type, name, description });
    }
  };

  const isSmallGame = playerCount <= 3;

  // Standard Exploding Kittens deck distribution
  const counts = {
    [CardType.ATTACK]: isSmallGame ? 2 : 4,
    [CardType.SKIP]: isSmallGame ? 4 : 4,
    [CardType.FAVOR]: isSmallGame ? 2 : 4,
    [CardType.SHUFFLE]: isSmallGame ? 2 : 4,
    [CardType.SEE_THE_FUTURE]: isSmallGame ? 3 : 5,
    [CardType.NOPE]: isSmallGame ? 4 : 5,
    [CardType.CAT_CARD_1]: isSmallGame ? 3 : 4,
    [CardType.CAT_CARD_2]: isSmallGame ? 3 : 4,
    [CardType.CAT_CARD_3]: isSmallGame ? 3 : 4,
    [CardType.CAT_CARD_4]: isSmallGame ? 3 : 4,
    [CardType.CAT_CARD_5]: isSmallGame ? 3 : 4,
  };

  // Action Cards
  addCards(CardType.ATTACK, counts[CardType.ATTACK], 'Attack', 'End your turn without drawing and force the next player to take 2 turns.');
  addCards(CardType.SKIP, counts[CardType.SKIP], 'Skip', 'End your turn without drawing.');
  addCards(CardType.FAVOR, counts[CardType.FAVOR], 'Favor', 'Force any other player to give you 1 card from their hand.');
  addCards(CardType.SHUFFLE, counts[CardType.SHUFFLE], 'Shuffle', 'Shuffle the draw pile.');
  addCards(CardType.SEE_THE_FUTURE, counts[CardType.SEE_THE_FUTURE], 'See The Future', 'View the top 3 cards of the draw pile.');
  addCards(CardType.NOPE, counts[CardType.NOPE], 'Nope', 'Stop any action except an Exploding Kitten or a Defuse card.');
  
  // Cat Cards
  addCards(CardType.CAT_CARD_1, counts[CardType.CAT_CARD_1], 'Tacocat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_2, counts[CardType.CAT_CARD_2], 'Cattermelon', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_3, counts[CardType.CAT_CARD_3], 'Hairy Potato Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_4, counts[CardType.CAT_CARD_4], 'Beard Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_5, counts[CardType.CAT_CARD_5], 'Rainbow-Ralphing Cat', 'Play as a pair to steal a random card.');

  return shuffleDeck(deck);
}
