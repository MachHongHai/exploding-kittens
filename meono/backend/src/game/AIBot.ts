import { Game } from './Game';
import { askGeminiForMove, BotDecision } from '../services/gemini';
import { CardType, PlayerAction } from '../../../shared/src/types';

export class AIBotController {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  async takeTurn(botId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD', requiresDefuse: boolean = false): Promise<PlayerAction> {
    const player = this.game.players.find(p => p.id === botId);
    if (!player) throw new Error("Bot player not found");

    // NEW: Handle being targeted by a Favor
    if (this.game.waitingForFavor?.victimId === botId) {
      const weakestCardId = this.chooseWeakestCard(player.hand);
      return { type: 'GIVE_CARD', requesterId: this.game.waitingForFavor.requesterId, cardId: weakestCardId };
    }

    if (difficulty === 'HARD') {
      return this.takeHardTurn(botId, requiresDefuse);
    } else if (difficulty === 'MEDIUM') {
      return this.takeMediumTurn(botId, requiresDefuse);
    } else {
      return this.takeEasyTurn(botId, requiresDefuse);
    }
  }

  private chooseWeakestCard(hand: any[]): string {
    // 1. Priority 1: Cat Cards (especially those without a pair)
    const counts: Record<string, number> = {};
    hand.forEach(c => counts[c.type] = (counts[c.type] || 0) + 1);
    
    const loneCat = hand.find(c => c.type.startsWith('CAT_CARD') && counts[c.type] === 1);
    if (loneCat) return loneCat.id;

    const anyCat = hand.find(c => c.type.startsWith('CAT_CARD'));
    if (anyCat) return anyCat.id;

    // 2. Priority 2: Common action cards
    const utility = hand.find(c => c.type === CardType.SHUFFLE || c.type === CardType.SEE_THE_FUTURE);
    if (utility) return utility.id;

    const common = hand.find(c => c.type === CardType.FAVOR || c.type === CardType.SKIP);
    if (common) return common.id;

    // 3. Fallback: Anything that isn't Defuse
    const fallback = hand.find(c => c.type !== CardType.DEFUSE);
    if (fallback) return fallback.id;

    return hand[0].id;
  }

  private takeEasyTurn(botId: string, requiresDefuse: boolean): PlayerAction {
    const player = this.game.players.find(p => p.id === botId)!;

    if (requiresDefuse) {
      return { type: 'DEFUSE', insertIndex: Math.floor(Math.random() * 3) };
    }

    const actionCards = player.hand.filter(c => c.type !== CardType.DEFUSE && c.type !== CardType.EXPLODING_KITTEN && c.type !== CardType.NOPE);
    
    // Check for pairs first (Easy bot loves combos)
    const counts: Record<string, string[]> = {};
    actionCards.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });
    const pairType = Object.keys(counts).find(type => counts[type].length >= 2);
    if (pairType && Math.random() > 0.3) {
      const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
      const pairTargetId = opponents.length > 0 ? opponents[Math.floor(Math.random() * opponents.length)].id : undefined;
      if (pairTargetId) {
        return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: pairTargetId };
      }
    }

    // Play high-value action cards with high probability (90%)
    if (actionCards.length > 0 && Math.random() > 0.1) {
      const cardToPlay = actionCards[Math.floor(Math.random() * actionCards.length)];
      
      let targetId;
      if ([CardType.FAVOR].includes(cardToPlay.type)) {
        const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
        if (opponents.length > 0) {
          targetId = opponents[Math.floor(Math.random() * opponents.length)].id;
        }
      }

      // Don't play cat cards individually
      if (cardToPlay.type.startsWith('CAT_CARD')) {
        return { type: 'DRAW_CARD' };
      }

      // For SEE_THE_FUTURE or SHUFFLE, Easy bot just plays them immediately
      return { type: 'PLAY_CARDS', cardIds: [cardToPlay.id], targetId };
    }

    return { type: 'DRAW_CARD' };
  }

  private takeMediumTurn(botId: string, requiresDefuse: boolean): PlayerAction {
    const player = this.game.players.find(p => p.id === botId)!;

    if (requiresDefuse) {
      return { type: 'DEFUSE', insertIndex: 1 };
    }

    // 1. Defensive: If being attacked, MUST play Skip or Attack
    if (player.turnsToPlay > 1) {
      const defenseCard = player.hand.find(c => c.type === CardType.SKIP || c.type === CardType.ATTACK);
      if (defenseCard) {
        return { type: 'PLAY_CARDS', cardIds: [defenseCard.id] };
      }
    }

    // 2. High Priority: See The Future / Shuffle when deck is low or randomly
    const utilityCard = player.hand.find(c => c.type === CardType.SEE_THE_FUTURE || c.type === CardType.SHUFFLE);
    if (utilityCard && (this.game.drawPile.length <= 10 || Math.random() > 0.8)) {
      return { type: 'PLAY_CARDS', cardIds: [utilityCard.id] };
    }

    // 3. Strategic: Play Favor to steal
    const favorCard = player.hand.find(c => c.type === CardType.FAVOR);
    if (favorCard && Math.random() > 0.6) {
      const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
      const targetId = opponents.length > 0 ? opponents[Math.floor(Math.random() * opponents.length)].id : undefined;
      if (targetId) return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId };
    }

    // 4. Combos: Check for pairs
    const counts: Record<string, string[]> = {};
    player.hand.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });
    const pairType = Object.keys(counts).find(type => counts[type].length >= 2);
    if (pairType && Math.random() > 0.5) {
      const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
      const pairTargetId = opponents.length > 0 ? opponents[Math.floor(Math.random() * opponents.length)].id : undefined;
      if (pairTargetId) {
        return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: pairTargetId };
      }
    }

    return { type: 'DRAW_CARD' };
  }

  private async takeHardTurn(botId: string, requiresDefuse: boolean): Promise<PlayerAction> {
    const player = this.game.players.find(p => p.id === botId)!;
    
    // Build context for Gemini
    const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated).map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.handCount,
      turnsToPlay: p.turnsToPlay
    }));

    const gameStateDesc = `
    - Draw pile size: ${this.game.drawPile.length}
    - Discard pile top card: ${this.game.discardPile.length > 0 ? this.game.discardPile[this.game.discardPile.length - 1].name : 'Empty'}
    - Your turns to play: ${player.turnsToPlay}
    - Requires Defuse right now?: ${requiresDefuse ? 'YES' : 'NO'}
    - Opponents: ${JSON.stringify(opponents)}
    `;

    const decision = await askGeminiForMove(gameStateDesc, player.hand);

    if (decision) {
      if (decision.action === 'DEFUSE' && requiresDefuse) {
         return { type: 'DEFUSE', insertIndex: decision.insertIndex || 0 };
      }
      if (decision.action === 'PLAY_CARD' && decision.cardId) {
         return { type: 'PLAY_CARDS', cardIds: [decision.cardId], targetId: decision.targetId };
      }
      if (decision.action === 'DRAW_CARD') {
         return { type: 'DRAW_CARD' };
      }
    }

    // Fallback if Gemini fails or returns invalid action
    console.log("[AIBot] Gemini failed or timed out, falling back to Medium logic.");
    return this.takeMediumTurn(botId, requiresDefuse);
  }
}
