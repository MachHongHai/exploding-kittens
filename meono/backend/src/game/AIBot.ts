import { Game } from './Game';
import { askAIForMove, BotDecision } from '../services/ai-service.js';
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
      // Find the next active player
      let nextIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
      while (this.game.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % this.game.players.length;
      }
      const nextPlayer = this.game.players[nextIndex];
      
      // Heuristic: If next player has no Defuse card, place bomb on top (index 0) to eliminate them.
      // Otherwise, place it randomly between index 1 and 3 (or deck size) to buy time.
      const hasDefuse = nextPlayer.hasDefuse();
      const insertIndex = !hasDefuse ? 0 : Math.floor(Math.random() * Math.min(3, this.game.drawPile.length + 1));
      console.log(`[AIBot - Medium] Bot ${player.name} is defusing. Next player has defuse? ${hasDefuse}. Placing bomb at index ${insertIndex}.`);
      return { type: 'DEFUSE', insertIndex };
    }

    // 1. Memory Defense: If a bomb is known to be in the range of cards we must draw
    const bombInRangeIndex = player.knownDeckTop.findIndex((c: any, idx: number) => 
      c.cardType === CardType.EXPLODING_KITTEN && idx < player.turnsToPlay
    );
    
    if (bombInRangeIndex !== -1) {
      console.log(`[AIBot - Medium] Bot ${player.name} knows a bomb is coming at draw index ${bombInRangeIndex}! Trying to play defense...`);
      // Play Skip or Attack to avoid drawing
      const skipOrAttack = player.hand.find(c => c.type === CardType.SKIP || c.type === CardType.ATTACK);
      if (skipOrAttack) {
        return { type: 'PLAY_CARDS', cardIds: [skipOrAttack.id] };
      }
      // Play Shuffle to randomize the bomb's position
      const shuffleCard = player.hand.find(c => c.type === CardType.SHUFFLE);
      if (shuffleCard) {
        return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
      }
    }

    // 2. Defensive check if being attacked (but no known bomb is immediate)
    if (player.turnsToPlay > 1) {
      const defenseCard = player.hand.find(c => c.type === CardType.SKIP || c.type === CardType.ATTACK);
      if (defenseCard) {
        return { type: 'PLAY_CARDS', cardIds: [defenseCard.id] };
      }
    }

    // 3. Play See The Future or Shuffle under appropriate conditions
    const seeFutureCard = player.hand.find(c => c.type === CardType.SEE_THE_FUTURE);
    if (seeFutureCard && (this.game.drawPile.length <= 10 || Math.random() > 0.7)) {
      return { type: 'PLAY_CARDS', cardIds: [seeFutureCard.id] };
    }

    const shuffleCard = player.hand.find(c => c.type === CardType.SHUFFLE);
    if (shuffleCard) {
      // Don't shuffle if we know the top card is safe!
      const topCardIsSafe = player.knownDeckTop.length > 0 && player.knownDeckTop[0].cardType !== CardType.EXPLODING_KITTEN;
      if (!topCardIsSafe && (this.game.drawPile.length <= 10 || Math.random() > 0.8)) {
        return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
      }
    }

    // 4. Strategic Favor: Play Favor to steal
    const favorCard = player.hand.find(c => c.type === CardType.FAVOR);
    if (favorCard && Math.random() > 0.6) {
      const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
      const targetId = opponents.length > 0 ? opponents[Math.floor(Math.random() * opponents.length)].id : undefined;
      if (targetId) return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId };
    }

    // 5. Combos: Check for pairs
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
    
    // OPTIMIZATION: If not forced to Defuse, and has no playable action cards or pairs, draw automatically to save quota
    if (!requiresDefuse) {
      const hasSinglePlayable = player.hand.some(c => 
        c.type === CardType.ATTACK || 
        c.type === CardType.SKIP || 
        c.type === CardType.FAVOR || 
        c.type === CardType.SHUFFLE || 
        c.type === CardType.SEE_THE_FUTURE
      );

      const cardCounts: Record<string, number> = {};
      player.hand.forEach(c => cardCounts[c.type] = (cardCounts[c.type] || 0) + 1);
      const hasPairPlayable = Object.values(cardCounts).some(count => count >= 2);

      if (!hasSinglePlayable && !hasPairPlayable) {
        console.log(`[AIBot - Hard] Bot ${player.name} has no playable cards. Drawing automatically to save quota.`);
        return { type: 'DRAW_CARD' };
      }
    }

    // Build context for Gemini
    const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated).map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.handCount,
      turnsToPlay: p.turnsToPlay,
      hasDefuse: p.hasDefuse() // Tell Gemini if they have defuse (critical for placing bombs!)
    }));

    const knownTop = player.knownDeckTop.length > 0
      ? player.knownDeckTop.map((c: any, i: number) => `Position ${i} (0 is top/immediate draw): ${c.cardName}`).join('\n')
      : 'None (Unknown cards)';

    const gameStateDesc = `
    - Draw pile size: ${this.game.drawPile.length}
    - Discard pile top card: ${this.game.discardPile.length > 0 ? this.game.discardPile[this.game.discardPile.length - 1].name : 'Empty'}
    - Your turns to play: ${player.turnsToPlay}
    - Requires Defuse right now?: ${requiresDefuse ? 'YES' : 'NO'}
    - Cards you know at the top of the draw pile (from top to bottom):
${knownTop}
    - Opponents: ${JSON.stringify(opponents)}
    `;

    const decision = await askAIForMove(gameStateDesc, player.hand);

    if (decision) {
      if (decision.action === 'DEFUSE' && requiresDefuse) {
         // pos represents how many cards from top to insert. 0 means on top (index 0).
         const pos = decision.insertIndex !== undefined ? decision.insertIndex : 0;
         console.log(`[AIBot - Hard] Bot ${player.name} decided to insert bomb at position ${pos}`);
         return { type: 'DEFUSE', insertIndex: pos };
      }
      if (decision.action === 'PLAY_CARDS' && decision.cardIds && decision.cardIds.length > 0) {
         return { type: 'PLAY_CARDS', cardIds: decision.cardIds, targetId: decision.targetId, requestedCardType: decision.requestedCardType };
      }
      if (decision.action === 'DRAW_CARD' && !requiresDefuse) {
         return { type: 'DRAW_CARD' };
      }
    }

    // Fallback if AI Service fails or returns invalid action
    console.log("[AIBot] AI Service failed or timed out, falling back to Medium logic.");
    return this.takeMediumTurn(botId, requiresDefuse);
  }
}
