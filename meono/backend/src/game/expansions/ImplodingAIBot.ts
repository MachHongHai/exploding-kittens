import { GameEngine } from '../GameEngine.js';
import { Card, CardType, PlayerAction } from '../../../../shared/src/types.js';

/**
 * ImplodingAIBot handles all AI logic specific to the Imploding Kittens expansion.
 * It provides specialized tactical decision-making for expansion cards and ensures
 * bots treat Imploding Kittens (face-up and face-down) as lethal threats.
 */
export class ImplodingAIBot {
  private game: GameEngine;

  constructor(game: GameEngine) {
    this.game = game;
  }

  /**
   * Centralized check for lethal kittens (Exploding or Imploding).
   */
  static isBomb(cardType: string): boolean {
    return cardType === CardType.EXPLODING_KITTEN || cardType === CardType.IMPLODING_KITTEN;
  }

  /**
   * Main entry point for expansion-specific turn logic.
   * Note: This is called by OriginalAIBot to handle expansion-specific states.
   */
  async takeTurn(botId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI', requiresDefuse: boolean = false): Promise<PlayerAction | null> {
    const player = this.game.players.find(p => p.id === botId);
    if (!player) return null;

    // 1. Handle special expansion-only states
    if (this.game.playerAlteringFuture === botId) {
      return ImplodingAIBot.handleBotAlteringFuture(botId, this.game);
    }

    // 2. High-priority threat detection (Kittens on top)
    const knownTop = player.knownDeckTop;
    const isBombOnTop = (knownTop.length > 0 && ImplodingAIBot.isBomb(knownTop[0].cardType)) || (this.game as any).isTopCardSuspect;

    if (isBombOnTop && difficulty !== 'EASY') {
      const escapeAction = ImplodingAIBot.getExpansionEscapeAction(botId, this.game);
      if (escapeAction) return escapeAction;
    }

    // 3. Specific card-type usage (Expansion cards)
    if (difficulty !== 'EASY' && !requiresDefuse) {
      const expansionAction = this.takeExpansionTacticalTurn(botId, difficulty);
      if (expansionAction) return expansionAction;
    }

    // 4. Defuse/Implode Insert logic
    if (requiresDefuse) {
      return this.handleImplodingInsert(botId, difficulty);
    }

    return null; // Fallback to OriginalAIBot for standard cards
  }

  /**
   * Handles the placement of an Imploding Kitten back into the deck.
   */
  private handleImplodingInsert(botId: string, difficulty: string): PlayerAction {
    const player = this.game.players.find(p => p.id === botId)!;
    const deckSize = this.game.drawPile.length;

    if (difficulty === 'EASY') {
      return { type: 'IMPLODE_INSERT', insertIndex: Math.floor(Math.random() * Math.min(5, deckSize + 1)) };
    }

    // Expert/Medium: Try to hit another player
    const remainingDraws = player.turnsToPlay - 1;
    if (remainingDraws > 0) {
      // If still under attack, place it deep enough to not hit us
      const safePos = Math.min(remainingDraws + 1, deckSize);
      console.log(`[ImplodingBot] Under attack! Placing Imploding Kitten at safe index ${safePos}`);
      return { type: 'IMPLODE_INSERT', insertIndex: safePos };
    }

    // Kill shot: Place at index 0 to hit the next player immediately (Imploding can't be defused!)
    console.log(`[ImplodingBot] KILL SHOT! Placing Imploding Kitten on top.`);
    return { type: 'IMPLODE_INSERT', insertIndex: 0 };
  }

  /**
   * Decide how to use expansion cards when NOT in immediate bomb danger.
   */
  private takeExpansionTacticalTurn(botId: string, difficulty: string): PlayerAction | null {
    const player = this.game.players.find(p => p.id === botId)!;
    const hand = player.hand;
    const deckSize = this.game.drawPile.length;
    
    const alterFuture = hand.find(c => c.type === CardType.ALTER_THE_FUTURE_3X);
    const drawBottom = hand.find(c => c.type === CardType.DRAW_FROM_THE_BOTTOM);
    const reverse = hand.find(c => c.type === CardType.REVERSE);
    const targetedAttack = hand.find(c => c.type === CardType.TARGETED_ATTACK);

    const isEndGame = deckSize <= this.game.players.filter(p => !p.isEliminated).length * 2.5;

    // Targeted Attack is extremely valuable. Use it if we can kill someone or if we have multiples.
    if (targetedAttack && (isEndGame || hand.filter(c => c.type === CardType.TARGETED_ATTACK).length > 1 || Math.random() > 0.8)) {
       const victims = this.game.players.filter(p => p.id !== botId && !p.isEliminated);
       const target = victims.find(v => !v.hasDefuse()) || victims[0];
       if (target) return { type: 'PLAY_CARDS', cardIds: [targetedAttack.id], targetId: target.id };
    }

    // Alter the Future is great for scouting/fixing. Use it if we don't know the top or in end game.
    if (alterFuture && (player.knownDeckTop.length === 0 || isEndGame) && Math.random() > 0.7) {
      return { type: 'PLAY_CARDS', cardIds: [alterFuture.id] };
    }

    // Draw from Bottom: Use if we know the top card is BAD or if we just want to save cards.
    // (Logic for 'top is bad' is already in getExpansionEscapeAction)

    return null;
  }

  /**
   * Tactical logic for expansion cards when the bot needs to avoid a confirmed bomb.
   */
  static getExpansionEscapeAction(botId: string, game: GameEngine): PlayerAction | null {
    const player = game.players.find(p => p.id === botId)!;
    const hand = player.hand;
    
    // 1. TARGETED ATTACK (The Ultimate Escape + Kill)
    const targetedAttack = hand.find(c => c.type === CardType.TARGETED_ATTACK);
    if (targetedAttack) {
      const victims = game.players.filter(p => p.id !== botId && !p.isEliminated);
      const target = victims.find(v => !v.hasDefuse()) || victims[0];
      if (target) return { type: 'PLAY_CARDS', cardIds: [targetedAttack.id], targetId: target.id };
    }

    // 2. REVERSE (Turn escape)
    const reverse = hand.find(c => c.type === CardType.REVERSE);
    if (reverse) return { type: 'PLAY_CARDS', cardIds: [reverse.id] };

    // 3. DRAW FROM THE BOTTOM (Dodge the top card)
    const drawBottom = hand.find(c => c.type === CardType.DRAW_FROM_THE_BOTTOM);
    if (drawBottom) return { type: 'PLAY_CARDS', cardIds: [drawBottom.id] };

    // 4. ALTER THE FUTURE (Bury or move the bomb)
    const alterFuture = hand.find(c => c.type === CardType.ALTER_THE_FUTURE_3X);
    if (alterFuture) return { type: 'PLAY_CARDS', cardIds: [alterFuture.id] };

    return null;
  }

  /**
   * Logic for rearranging cards during Alter the Future.
   */
  static handleBotAlteringFuture(botId: string, game: GameEngine): PlayerAction | null {
    if (game.playerAlteringFuture !== botId || !game.alteringFutureCards) return null;

    const sortedCards = [...game.alteringFutureCards].sort((a, b) => {
      const isABomb = this.isBomb(a.type);
      const isBBomb = this.isBomb(b.type);
      
      if (isABomb && !isBBomb) return 1; // Put bombs at the bottom
      if (!isABomb && isBBomb) return -1;

      const getCardValue = (type: string) => {
        switch (type) {
          case CardType.DEFUSE: return 10;
          case CardType.ATTACK: 
          case CardType.TARGETED_ATTACK: return 9;
          case CardType.NOPE: return 8;
          case CardType.SKIP: 
          case CardType.REVERSE: return 7;
          case CardType.DRAW_FROM_THE_BOTTOM: return 6;
          case CardType.ALTER_THE_FUTURE_3X: return 5;
          case CardType.SEE_THE_FUTURE: return 4;
          default: return 1;
        }
      };

      return getCardValue(b.type) - getCardValue(a.type);
    });

    return { type: 'CONFIRM_ALTER_FUTURE', reorderedCardIds: sortedCards.map(c => c.id) };
  }
}
