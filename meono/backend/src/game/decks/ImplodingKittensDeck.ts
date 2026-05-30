import { Card, CardType } from '../../../../shared/src/types.js';
import { generateCardId, shuffleDeck } from '../models.js';

export function createImplodingKittensDeck(playerCount: number): Card[] {
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

  // Original Action Cards
  addCards(CardType.ATTACK, counts[CardType.ATTACK], 'Attack', 'End your turn without drawing and force the next player to take 2 turns.');
  addCards(CardType.SKIP, counts[CardType.SKIP], 'Skip', 'End your turn without drawing.');
  addCards(CardType.FAVOR, counts[CardType.FAVOR], 'Favor', 'Force any other player to give you 1 card from their hand.');
  addCards(CardType.SHUFFLE, counts[CardType.SHUFFLE], 'Shuffle', 'Shuffle the draw pile.');
  addCards(CardType.SEE_THE_FUTURE, counts[CardType.SEE_THE_FUTURE], 'See The Future', 'View the top 3 cards of the draw pile.');
  addCards(CardType.NOPE, counts[CardType.NOPE], 'Nope', 'Stop any action except an Exploding Kitten or a Defuse card.');
  
  // Original Cat Cards
  addCards(CardType.CAT_CARD_1, counts[CardType.CAT_CARD_1], 'Tacocat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_2, counts[CardType.CAT_CARD_2], 'Cattermelon', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_3, counts[CardType.CAT_CARD_3], 'Hairy Potato Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_4, counts[CardType.CAT_CARD_4], 'Beard Cat', 'Play as a pair to steal a random card.');
  addCards(CardType.CAT_CARD_5, counts[CardType.CAT_CARD_5], 'Rainbow-Ralphing Cat', 'Play as a pair to steal a random card.');

  // Imploding Kittens Expansion Cards (20 cards)
  addCards(CardType.FERAL_CAT, 4, 'Feral Cat', 'Use as any cat card.');
  addCards(CardType.ALTER_THE_FUTURE_3X, 4, 'Alter the Future 3x', 'Privately view and rearrange the top three cards of the draw pile.');
  addCards(CardType.DRAW_FROM_THE_BOTTOM, 4, 'Draw From the Bottom', 'End your turn by drawing the bottom card from the Draw Pile.');
  addCards(CardType.REVERSE, 4, 'Reverse', 'Reverse the order of play and end your turn without drawing a card.');
  addCards(CardType.TARGETED_ATTACK, 3, 'Targeted Attack 2x', 'End your turn without drawing a card. Force ANY OTHER PLAYER to take 2 turns in a row.');
  addCards(CardType.IMPLODING_KITTEN, 1, 'Imploding Kitten', 'When drawn face down, put back face up. When drawn face up, explode immediately. Cannot be defused.');

  return shuffleDeck(deck);
}
