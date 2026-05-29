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
} as const;

export type CardType = typeof CardType[keyof typeof CardType];

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
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
  players: PlayerState[];
  currentPlayerId: string | null;
  drawPileCount: number;
  discardPile: Card[];
  lastAction: string | null;
  winner: string | null;
  waitingForDefuse: string | null;
  bombCountdown?: number; 
  waitingForSteal?: {
    stealerId: string;
    victimId: string;
    count: number;
  };
  waitingForFavor?: {
    requesterId: string;
    victimId: string;
  };
  lastTheft?: {
    stealerId: string;
    victimId: string;
    cardId?: string; 
  };
  futureCards?: Card[]; 
  actionWindow?: {
    actionId: string;
    actionName: string;
    expiresAt: number;
    nopeCount: number;
    targetName?: string;
    initiatorId: string;
    lastNoperId?: string;
  };
  explodingKittensCount?: number;
  actionHistory?: string[];
  lastNopeableAction?: {
    type: 'ATTACK' | 'SKIP' | 'FAVOR' | '2-CARD' | '3-CARD' | 'NOPE';
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
  | { type: 'PLAY_CARDS', cardIds: string[], targetId?: string, requestedCardType?: CardType }
  | { type: 'STEAL_CARD', victimId: string, cardIndex: number }
  | { type: 'GIVE_CARD', requesterId: string, cardId: string }
  | { type: 'CONFIRM_FUTURE' }
  | { type: 'DEFUSE', insertIndex: number }
  | { type: 'PLAY_NOPE', cardId: string }
  | { type: 'PASS_NOPE' };
