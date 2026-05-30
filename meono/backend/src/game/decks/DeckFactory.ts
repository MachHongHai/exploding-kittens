import { Card } from '../../../../shared/src/types.js';
import { createOriginalDeck } from './OriginalDeck.js';
import { createImplodingKittensDeck } from './ImplodingKittensDeck.js';

export function createDeckFactory(deckType: 'ORIGINAL' | 'IMPLODING_KITTENS', playerCount: number): Card[] {
  if (deckType === 'IMPLODING_KITTENS') {
    return createImplodingKittensDeck(playerCount);
  }
  return createOriginalDeck(playerCount);
}
