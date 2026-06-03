export const CardType = {
  EXPLODING_KITTEN: 'EXPLODING_KITTEN',
  DEFUSE: 'DEFUSE',
  ATTACK: 'ATTACK',
  SKIP: 'SKIP',
  FAVOR: 'FAVOR',
  SHUFFLE: 'SHUFFLE',
  SEE_THE_FUTURE: 'SEE_THE_FUTURE',
  NOPE: 'NOPE',
  CAT_CARD_1: 'CAT_CARD_1',
  CAT_CARD_2: 'CAT_CARD_2',
  CAT_CARD_3: 'CAT_CARD_3',
  CAT_CARD_4: 'CAT_CARD_4',
  CAT_CARD_5: 'CAT_CARD_5',
  FERAL_CAT: 'FERAL_CAT',
  DRAW_FROM_THE_BOTTOM: 'DRAW_FROM_THE_BOTTOM',
  REVERSE: 'REVERSE',
  ALTER_THE_FUTURE_3X: 'ALTER_THE_FUTURE_3X',
  TARGETED_ATTACK: 'TARGETED_ATTACK',
  IMPLODING_KITTEN: 'IMPLODING_KITTEN',
} as const;

export type CardType = typeof CardType[keyof typeof CardType];

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  isFaceUp?: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  handCount: number;
  isBot: boolean;
  turnsToPlay: number;
  isEliminated: boolean;
  hand?: Card[];
}

export interface GameState {
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  deckType?: 'ORIGINAL' | 'IMPLODING_KITTENS';
  players: PlayerState[];
  currentPlayerId: string | null;
  drawPileCount: number;
  initialDrawPileCount: number;
  faceUpTopCard?: Card | null;
  discardPile: Card[];
  lastAction: string | null;
  winner: string | null;
  turnExpiresAt?: number;
  playDirection?: 1 | -1;
  waitingForDefuse: string | null;
  waitingForImplodingInsert?: string | null;
  bombCountdown?: number;
  waitingForSteal?: {
    stealerId: string;
    victimId: string;
    count: number;
    expiresAt: number;
  };
  waitingForFavor?: {
    requesterId: string;
    victimId: string;
    expiresAt: number;
  };
  lastTheft?: {
    stealerId: string;
    victimId: string;
    cardId?: string;
  };
  futureCards?: Card[];
  alteringFutureCards?: Card[];
  actionWindow?: {
    actionId: string;
    actionName: string;
    expiresAt: number;
    nopeCount: number;
    targetName?: string;
    initiatorId: string;
    lastNoperId?: string;
  };
  waitingForTarget?: {
    type: 'FAVOR' | '2-CARD' | '3-CARD' | 'TARGETED_ATTACK';
    playerId: string;
    expiresAt: number;
  };
  explodingKittensCount?: number;
  actionHistory?: string[];
  lastNopeableAction?: {
    type: 'ATTACK' | 'SKIP' | 'FAVOR' | '2-CARD' | '3-CARD' | 'NOPE' | 'REVERSE';
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
  } | null;
}

export type PlayerAction =
  | { type: 'DRAW_CARD' }
  | { type: 'DRAW_FROM_BOTTOM' }
  | { type: 'PLAY_CARDS', cardIds: string[], targetId?: string, requestedCardType?: CardType }
  | { type: 'STEAL_CARD', victimId: string, cardIndex: number }
  | { type: 'GIVE_CARD', requesterId: string, cardId: string }
  | { type: 'CONFIRM_FUTURE' }
  | { type: 'CONFIRM_ALTER_FUTURE', reorderedCardIds: string[] }
  | { type: 'DEFUSE', insertIndex: number }
  | { type: 'IMPLODE_INSERT', insertIndex: number }
  | { type: 'PLAY_NOPE', cardId: string }
  | { type: 'PASS_NOPE' }
  | { type: 'SELECT_TARGET', targetId: string, requestedCardType?: CardType };
