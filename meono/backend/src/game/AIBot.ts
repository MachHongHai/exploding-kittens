import { Game } from './Game.js';
import { askAIForMove, BotDecision } from '../services/ai-service.js';
import { CardType, PlayerAction } from '../../../shared/src/types.js';

export class AIBotController {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  async takeTurn(botId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI', requiresDefuse: boolean = false): Promise<PlayerAction> {
    const player = this.game.players.find(p => p.id === botId);
    if (!player) throw new Error("Bot player not found");

    // Check if bot wants to play a late Nope first (Case 5/6)
    const lateNope = this.getLateNopeDecision(botId);
    if (lateNope) {
      return lateNope;
    }

    // NEW: Handle being targeted by a Favor
    if (this.game.waitingForFavor?.victimId === botId) {
      const weakestCardId = this.chooseWeakestCard(player.hand);
      return { type: 'GIVE_CARD', requesterId: this.game.waitingForFavor.requesterId, cardId: weakestCardId };
    }

    if (difficulty === 'PLAY_WITH_GEMINI') {
      return this.takeGeminiTurn(botId, requiresDefuse);
    } else if (difficulty === 'HARD') {
      return this.takeHardRuleTurn(botId, requiresDefuse);
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

  private getValidComboType(
    counts: Record<string, string[]>, 
    minCount: number, 
    allowValuable: boolean
  ): string | null {
    // Cat Cards are the ONLY cards that should be used as combos under normal circumstances.
    // Their sole purpose IS to be played as pairs/triplets. Action cards are always more valuable
    // for their effects (Skip, Attack, etc.) than as combo fodder.
    const catTypes = Object.keys(counts).filter(type => type.startsWith('CAT_CARD') && counts[type].length >= minCount);
    if (catTypes.length > 0) return catTypes[0];

    // Only in absolute desperation (bomb imminent, no escape, no defuse) do we sacrifice action cards as combos.
    // This is a Hail Mary play - the bot is about to die and has nothing else to try.
    if (allowValuable) {
      const desperateTypes = Object.keys(counts).filter(type => {
        if (counts[type].length < minCount) return false;
        if (type.startsWith('CAT_CARD')) return false;
        // Even in desperation, NEVER sacrifice Defuse or Nope
        if (type === CardType.DEFUSE || type === CardType.NOPE) return false;
        return true;
      });
      if (desperateTypes.length > 0) return desperateTypes[0];
    }

    return null;
  }

  private getBestCardTypeToRequest(target: any, preferredType?: CardType): CardType {
    if (!target || target.handCount === 0) return CardType.DEFUSE;

    const targetTypes = target.hand.map((c: any) => c.type);

    // If a preferred type is specified and target has it, return it
    if (preferredType && targetTypes.includes(preferredType)) {
      return preferredType;
    }

    // Strategic priority list
    const priority = [
      CardType.DEFUSE,
      CardType.NOPE,
      CardType.ATTACK,
      CardType.SKIP,
      CardType.SHUFFLE,
      CardType.SEE_THE_FUTURE,
      CardType.FAVOR
    ];

    for (const type of priority) {
      if (targetTypes.includes(type)) {
        return type as CardType;
      }
    }

    // Fallback: Return any cat card they have
    const catCard = target.hand.find((c: any) => c.type.startsWith('CAT_CARD'));
    if (catCard) return catCard.type as CardType;

    return target.hand[0].type as CardType;
  }

  /**
   * SAFETY NET: If the bot KNOWS a bomb is on top, try absolutely anything to avoid drawing.
   * This prevents the bot from 'forgetting' bomb knowledge after playing combos.
   * Called as a fallback before every DRAW_CARD return when bomb is confirmed on top.
   */
  private getLastResortAction(botId: string): PlayerAction | null {
    const player = this.game.players.find(p => p.id === botId)!;
    const hand = player.hand;
    const isBombOnTop = player.knownDeckTop.length > 0 &&
                        player.knownDeckTop[0].cardType === CardType.EXPLODING_KITTEN;

    if (!isBombOnTop) return null; // Only engage if bomb is CONFIRMED on top

    // Re-scan hand for ANY escape/utility card (the bot may have stolen one via a combo!)
    const attack = hand.find(c => c.type === CardType.ATTACK);
    if (attack) {
      console.log(`[Expert SAFETY] ${player.name}: Found stolen Attack! Using it to escape bomb.`);
      return { type: 'PLAY_CARDS', cardIds: [attack.id] };
    }

    const skip = hand.find(c => c.type === CardType.SKIP);
    if (skip) {
      console.log(`[Expert SAFETY] ${player.name}: Found stolen Skip! Using it to dodge bomb.`);
      return { type: 'PLAY_CARDS', cardIds: [skip.id] };
    }

    const shuffle = hand.find(c => c.type === CardType.SHUFFLE);
    if (shuffle) {
      console.log(`[Expert SAFETY] ${player.name}: Found Shuffle! Randomizing bomb position.`);
      return { type: 'PLAY_CARDS', cardIds: [shuffle.id] };
    }

    // Try any remaining combo (pairs/triplets) to steal one more card
    const counts: Record<string, string[]> = {};
    hand.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });
    const target = this.selectStrategicTarget(botId);
    if (target && target.handCount > 0) {
      // Try triplet (including action cards as desperate combo fodder)
      const tripletType = this.getValidComboType(counts, 3, true);
      if (tripletType) {
        const requestedType = this.getBestCardTypeToRequest(target, CardType.ATTACK);
        console.log(`[Expert SAFETY] ${player.name}: Last resort 3-of-a-kind for ${requestedType} from ${target.name}!`);
        return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: target.id, requestedCardType: requestedType as any };
      }
      // Try pair
      const pairType = this.getValidComboType(counts, 2, true);
      if (pairType) {
        console.log(`[Expert SAFETY] ${player.name}: Last resort pair steal from ${target.name}!`);
        return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
      }
      // Try favor
      const favor = hand.find(c => c.type === CardType.FAVOR);
      if (favor) {
        console.log(`[Expert SAFETY] ${player.name}: Last resort Favor on ${target.name}!`);
        return { type: 'PLAY_CARDS', cardIds: [favor.id], targetId: target.id };
      }
    }

    // Try See The Future (won't save us, but buys info for next turn — better than nothing)
    const stf = hand.find(c => c.type === CardType.SEE_THE_FUTURE);
    if (stf) {
      console.log(`[Expert SAFETY] ${player.name}: Playing See The Future as stall tactic.`);
      return { type: 'PLAY_CARDS', cardIds: [stf.id] };
    }

    return null; // Truly nothing left
  }

  private selectStrategicTarget(botId: string): any {
    const opponents = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
    if (opponents.length === 0) return null;
    if (opponents.length === 1) return opponents[0];

    // Find the next active player in the turn order
    let nextIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
    while (this.game.players[nextIndex].isEliminated) {
      nextIndex = (nextIndex + 1) % this.game.players.length;
    }
    const nextPlayer = this.game.players[nextIndex];

    const bot = this.game.players.find(p => p.id === botId);
    const botHasDefuse = bot ? bot.hand.some(c => c.type === CardType.DEFUSE) : false;

    let bestTarget = opponents[0];
    let highestScore = -Infinity;

    // Determine bot's mindset for this specific action
    // 70% chance to target leaders/hoarders (Standard), 30% chance to target the weakest link (Ruthless)
    const isRuthless = Math.random() < 0.3;

    const aliveCount = this.game.players.filter(p => !p.isEliminated).length;
    const totalCards = this.game.players.filter(p => !p.isEliminated).reduce((sum, p) => sum + p.handCount, 0);
    const avgCards = aliveCount > 0 ? totalCards / aliveCount : 0;

    opponents.forEach(p => {
      let score = 0;

      if (isRuthless) {
        // "Ruthless Execution" Mode: Eliminate the weak
        // High score for players with very few cards, making them prime targets for elimination
        score += Math.max(0, (7 - p.handCount)) * 3.0; 
        if (p.handCount <= 2) {
          score += 25.0; // Massive bonus for targeting someone on the brink of death
        }
      } else {
        // "Eat the Rich" Mode: Target hoarders and leaders
        score += p.handCount * 1.5;
        
        if (p.handCount >= avgCards + 2) {
          score += (p.handCount - avgCards) * 4.0; 
          if (p.handCount >= avgCards + 4) score += 20.0; // Heavy penalty for the clear leader
        }
      }

      // 2. Turn order pressure (target next player to reduce their defensive options right before they draw)
      if (p.id === nextPlayer.id) {
        score += 6.0;
      }

      // 3. Defuse card strategic targeting (Vulnerability Exploitation)
      const opponentHasDefuse = p.hasDefuse();
      if (!botHasDefuse) {
        // We desperately need a Defuse, so prioritize stealing from those who have it
        if (opponentHasDefuse) {
          score += 15.0; // Increased priority
        }
      } else {
        // We are safe, let's try to eliminate vulnerable players!
        if (!opponentHasDefuse) {
          score += 20.0; // Massive score for targeting unprotected players
        }
      }

      // 4. Retaliation / Play history (The Grudge System)
      const targetName = p.name;
      const botName = bot?.name || "";
      let revengeScore = 0;
      
      const gameWithHistory = this.game as any;
      if (gameWithHistory.actionHistory) {
        const history: string[] = gameWithHistory.actionHistory;
        // Check the entire history (max 30 actions), giving more weight to recent actions
        const totalActions = history.length;
        
        let lastActionByBot = false;
        
        history.forEach((action, idx) => {
          // Calculate recency weight (from 1.0 for oldest to 3.0 for newest)
          const recencyWeight = 1.0 + (idx / totalActions) * 2.0; 
          
          if (action.includes(targetName)) {
            // Direct aggression against the bot
            if (
              action.includes("played Favor on " + botName) || 
              action.includes("played a Pair on " + botName) || 
              action.includes("Three of a kind on " + botName) || 
              action.includes("stole from " + botName)
            ) {
              revengeScore += 8.0 * recencyWeight;
            }
            // Indirect aggression (e.g. playing Attack on the bot, but the action string might just say "played an Attack card")
            // Wait, Attack cards don't have targets in the action string, they affect the next player. 
            // We rely on direct targeted actions here.
          }
          
          // Noping the bot's actions is the ultimate offense
          if (action.includes(`${botName} played`)) {
            lastActionByBot = true;
          } else if (action.includes("Nope!")) {
            if (lastActionByBot && action.includes(targetName)) {
              revengeScore += 12.0 * recencyWeight; // Massive grudge for Noping us!
            }
          } else {
            lastActionByBot = false;
          }
        });
      }
      
      score += revengeScore;

      // Add a slight randomness to break ties or prevent perfectly predictable behavior
      score += Math.random() * 2.0;

      if (score > highestScore) {
        highestScore = score;
        bestTarget = p;
      }
    });

    return bestTarget;
  }

  private takeEasyTurn(botId: string, requiresDefuse: boolean): PlayerAction {
    const player = this.game.players.find(p => p.id === botId)!;

    if (requiresDefuse) {
      return { type: 'DEFUSE', insertIndex: Math.floor(Math.random() * 3) };
    }

    const actionCards = player.hand.filter(c => c.type !== CardType.DEFUSE && c.type !== CardType.EXPLODING_KITTEN && c.type !== CardType.NOPE);
    
    // Check for pairs first (Easy bot loves combos)
    const counts: Record<string, string[]> = {};
    player.hand.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });
    const pairType = this.getValidComboType(counts, 2, false);
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
      if (cardToPlay.type === CardType.FAVOR) {
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
      
      const remainingDrawsAfterDefuse = player.turnsToPlay - 1;
      if (remainingDrawsAfterDefuse > 0) {
        // Safe placement: beyond remaining draws
        const safeDepth = Math.min(remainingDrawsAfterDefuse + 1, this.game.drawPile.length);
        console.log(`[AIBot - Medium] Under attack with ${remainingDrawsAfterDefuse} draws left. Placing bomb at safe depth ${safeDepth} to avoid self-draw.`);
        return { type: 'DEFUSE', insertIndex: safeDepth };
      }

      // Heuristic: If next player has no Defuse card, place bomb on top (index 0) to eliminate them.
      // Otherwise, place it randomly between index 1 and 3 (or deck size) to buy time.
      const hasDefuse = nextPlayer.hasDefuse();
      const insertIndex = !hasDefuse ? 0 : Math.floor(Math.random() * Math.min(3, this.game.drawPile.length + 1));
      console.log(`[AIBot - Medium] Bot ${player.name} is defusing. Next player has defuse? ${hasDefuse}. Placing bomb at index ${insertIndex}.`);
      return { type: 'DEFUSE', insertIndex };
    }

    const remainingCards = this.game.drawPile.length;
    const isEndGame = remainingCards <= 10;

    // Check memory for bomb
    const bombInRangeIndex = player.knownDeckTop.findIndex((c: any, idx: number) => 
      c.cardType === CardType.EXPLODING_KITTEN && idx < player.turnsToPlay
    );
    const isBombKnown = bombInRangeIndex !== -1;

    // Check suspicion (someone recently defused and we are in draw range)
    const lastDefuse = (this.game as any).lastDefuseAction;
    const isBombSuspected = lastDefuse && lastDefuse.playerId !== botId && lastDefuse.drawsSinceDefuse === 0;

    const isTopCardSafe = player.knownDeckTop.length > 0 && player.knownDeckTop[0].cardType !== CardType.EXPLODING_KITTEN;
    const isBombDanger = (isBombKnown || isBombSuspected) && !isTopCardSafe;

    const skipOrAttack = player.hand.find(c => c.type === CardType.SKIP || c.type === CardType.ATTACK);
    const seeFutureCard = player.hand.find(c => c.type === CardType.SEE_THE_FUTURE);
    const shuffleCard = player.hand.find(c => c.type === CardType.SHUFFLE);
    const favorCard = player.hand.find(c => c.type === CardType.FAVOR);
    const target = this.selectStrategicTarget(botId);

    // If top card is safe, save cards and draw!
    if (isTopCardSafe) {
      console.log(`[AIBot - Medium] Top card is safe. Saving cards and drawing.`);
      return { type: 'DRAW_CARD' };
    }

    // Defensive check (bomb danger or attacked with turns to play)
    if (isBombDanger || player.turnsToPlay > 1) {
      if (skipOrAttack) {
        console.log(`[AIBot - Medium] Bot ${player.name} playing defense skip/attack under danger/attack.`);
        return { type: 'PLAY_CARDS', cardIds: [skipOrAttack.id] };
      }
      if (shuffleCard) {
        console.log(`[AIBot - Medium] Bot ${player.name} playing shuffle under danger.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
      }

      // If we are in bomb danger (e.g. bomb known on top) and have no direct escape cards:
      // Try Favor or Pair combo with 100% probability to steal an escape card (desperate defense)!
      if (isBombDanger && target && target.handCount > 0) {
        // Favor
        if (favorCard) {
          console.log(`[AIBot - Medium] DESPERATE Favor on ${target.name} to steal defense under bomb danger.`);
          return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId: target.id };
        }
        
        // Pairs (allowing action card pairs in desperation)
        const counts: Record<string, string[]> = {};
        player.hand.forEach(c => {
          if (!counts[c.type]) counts[c.type] = [];
          counts[c.type].push(c.id);
        });
        const pairType = this.getValidComboType(counts, 2, true); // Allow valuable cards in desperation
        if (pairType) {
          console.log(`[AIBot - Medium] DESPERATE Pair on ${target.name} to steal defense under bomb danger.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
      }
    }

    // Play See The Future - save for late game or when danger is present, and only if memory is empty
    if (seeFutureCard && player.knownDeckTop.length === 0 && (isEndGame || Math.random() > 0.8)) {
      console.log(`[AIBot - Medium] Playing See The Future.`);
      return { type: 'PLAY_CARDS', cardIds: [seeFutureCard.id] };
    }

    // Play Shuffle if we don't know the deck top and it's late game
    if (shuffleCard && isEndGame && !isTopCardSafe && Math.random() > 0.8) {
      console.log(`[AIBot - Medium] Playing Shuffle preventative.`);
      return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
    }

    // Combos / Stealing (Favor / Pairs / Triplets) under normal conditions
    if (target && target.handCount > 0) {
      const counts: Record<string, string[]> = {};
      player.hand.forEach(c => {
        if (!counts[c.type]) counts[c.type] = [];
        counts[c.type].push(c.id);
      });

      // Triplets (3-of-a-kind) - Ultimate priority
      const tripletType = this.getValidComboType(counts, 3, false);
      if (tripletType) {
        const preferred = player.hasDefuse() ? CardType.ATTACK : CardType.DEFUSE;
        const requestedType = this.getBestCardTypeToRequest(target, preferred);
        console.log(`[AIBot - Medium] Playing 3-of-a-kind requesting ${requestedType} from ${target.name}.`);
        return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: target.id, requestedCardType: requestedType as any };
      }

      // Pairs
      const pairType = this.getValidComboType(counts, 2, false);
      if (pairType && Math.random() > 0.5) {
        console.log(`[AIBot - Medium] Playing Pair on ${target.name}.`);
        return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
      }

      // Favor
      if (favorCard && Math.random() > 0.6) {
        console.log(`[AIBot - Medium] Playing Favor on ${target.name}.`);
        return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId: target.id };
      }
    }

    return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
  }

  private async takeGeminiTurn(botId: string, requiresDefuse: boolean): Promise<PlayerAction> {
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

    const gameWithHistory = this.game as any;
    const historyDesc = gameWithHistory.actionHistory && gameWithHistory.actionHistory.length > 0
      ? gameWithHistory.actionHistory.slice(-10).join('\n')
      : 'None yet';

    // Compute hostile players for Gemini
    const botName = player.name;
    const hostilityCounts: Record<string, number> = {};
    if (gameWithHistory.actionHistory) {
      const history: string[] = gameWithHistory.actionHistory.slice(-15);
      let lastActionByBot = false;
      history.forEach(action => {
        opponents.forEach(opp => {
          const oppName = opp.name;
          if (action.includes(oppName) && (
            action.includes("played Favor on " + botName) || 
            action.includes("played a Pair on " + botName) || 
            action.includes("Three of a kind on " + botName) || 
            action.includes("stole from " + botName)
          )) {
            hostilityCounts[oppName] = (hostilityCounts[oppName] || 0) + 1;
          }
          if (action.includes(`${botName} played`)) {
            lastActionByBot = true;
          } else if (action.includes("Nope!")) {
            if (lastActionByBot && action.includes(oppName)) {
              hostilityCounts[oppName] = (hostilityCounts[oppName] || 0) + 1;
            }
          } else {
            lastActionByBot = false;
          }
        });
      });
    }

    const hostileList = Object.entries(hostilityCounts)
      .map(([name, count]) => `${name} (Attacked/Noped you ${count} times)`)
      .join(', ') || 'None';

    const gameStateDesc = `
    - Draw pile size: ${this.game.drawPile.length}
    - Discard pile top card: ${this.game.discardPile.length > 0 ? this.game.discardPile[this.game.discardPile.length - 1].name : 'Empty'}
    - Your turns to play: ${player.turnsToPlay}
    - Requires Defuse right now?: ${requiresDefuse ? 'YES' : 'NO'}
    - Cards you know at the top of the draw pile (from top to bottom):
${knownTop}
    - Recent Action History (last 10 moves):
${historyDesc}
    - Hostility & Revenge (Players who targeted you recently): ${hostileList}
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
         if (decision.cardIds.length === 3) {
           const targetId = decision.targetId || this.selectStrategicTarget(botId)?.id;
           const target = this.game.players.find(p => p.id === targetId);
           const preferred = decision.requestedCardType as CardType | undefined;
           const requestedType = this.getBestCardTypeToRequest(target, preferred);
           console.log(`[AIBot - Gemini] Sanitized 3-of-a-kind to requested type: ${requestedType} from target: ${target?.name}`);
           return { type: 'PLAY_CARDS', cardIds: decision.cardIds, targetId, requestedCardType: requestedType };
         }
         return { type: 'PLAY_CARDS', cardIds: decision.cardIds, targetId: decision.targetId, requestedCardType: decision.requestedCardType as CardType | undefined };
      }
      if (decision.action === 'DRAW_CARD' && !requiresDefuse) {
         return { type: 'DRAW_CARD' };
      }
    }

    // Fallback if AI Service fails or returns invalid action
    console.log("[AIBot] AI Service failed or timed out, falling back to Medium logic.");
    return this.takeMediumTurn(botId, requiresDefuse);
  }

  public async takeNopeDecision(botId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI'): Promise<PlayerAction | null> {
    const player = this.game.players.find(p => p.id === botId);
    if (!player || !this.game.pendingAction) return null;

    const nopeCard = player.hand.find(c => c.type === CardType.NOPE);
    if (!nopeCard) return null;

    const action = this.game.pendingAction;
    const deckSize = this.game.drawPile.length;
    const handSize = player.handCount;
    const hasDefuse = player.hand.some(c => c.type === CardType.DEFUSE);
    
    // Check if bot knows the top card of the deck is a bomb
    const isTopCardBomb = player.knownDeckTop.length > 0 && 
                          player.knownDeckTop[0].cardType === CardType.EXPLODING_KITTEN;

    // Easy bots: simple 25% chance of noping if targeted, never counter-nope
    if (difficulty === 'EASY') {
      if (action.playerId !== botId && action.nopeCount === 0 && action.targetId === botId && Math.random() < 0.25) {
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
      return null;
    }

    // --- CASE 1: COUNTER-NOPING (YUP) to protect our own action ---
    if (action.playerId === botId) {
      // We only counter-nope if our action is currently noped (nopeCount is odd: 1, 3, etc.)
      if (action.nopeCount % 2 === 0) return null;

      const cardType = action.cards[0]?.type;

      // 1. Never counter-nope Shuffle, See the Future, or Favor. Let them waste their Nope!
      if (cardType === CardType.SHUFFLE || cardType === CardType.SEE_THE_FUTURE || cardType === CardType.FAVOR) {
        console.log(`[AIBot - Nope] Bot ${player.name} chooses NOT to counter-nope low-value ${cardType}. Letting it fail.`);
        return null;
      }

      // 2. Attack / Skip: Counter-nope only if we are in danger (bomb known at top or we have no Defuse card in late game)
      if (cardType === CardType.ATTACK || cardType === CardType.SKIP) {
        const inDanger = isTopCardBomb || (!hasDefuse && deckSize <= 8);
        if (inDanger) {
          console.log(`[AIBot - Nope] Bot ${player.name} counter-nopes to save itself from drawing (Action: ${cardType}).`);
          return { type: 'PLAY_NOPE', cardId: nopeCard.id };
        }
        console.log(`[AIBot - Nope] Bot ${player.name} chooses not to waste Nope defending ${cardType} (Not in immediate danger).`);
        return null;
      }

      // 3. Combos (Pairs / 3-of-a-kind): Counter-nope only if it's late game and we are targeting a Defuse card
      if (action.actionType === '2-CARD' || action.actionType === '3-CARD') {
        const targetPlayer = this.game.players.find(p => p.id === action.targetId);
        const targetHasDefuse = targetPlayer?.hasDefuse();
        if (deckSize <= 8 && !hasDefuse && targetHasDefuse) {
          console.log(`[AIBot - Nope] Bot ${player.name} counter-nopes combo to steal Defuse from ${targetPlayer?.name}.`);
          return { type: 'PLAY_NOPE', cardId: nopeCard.id };
        }
        return null;
      }

      return null;
    }

    // --- CASE 2: Noping an opponent's action ---
    // Normally, we only Nope if the action is currently active/successful (nopeCount is even: 0, 2, etc.)
    if (action.nopeCount % 2 !== 0) {
      // PRO COLLUSION: If the action is currently NOPED (odd count), it might have been Noped by the LEADER to save themselves!
      // E.g., someone attacked the Leader. The Leader Noped it. We should Counter-Nope the Leader to ensure the attack hits!
      const lastNoper = this.game.players.find(p => p.id === action.lastNoperId);
      if (lastNoper && lastNoper.id !== botId) {
        const aliveCount = this.game.players.filter(p => !p.isEliminated).length;
        const totalCards = this.game.players.filter(p => !p.isEliminated).reduce((sum, p) => sum + p.handCount, 0);
        const avgCards = aliveCount > 0 ? totalCards / aliveCount : 0;
        
        // If the noper is a massive hoarder/leader, and we have a Nope, we counter-nope them to bleed their cards and force the action!
        if (lastNoper.handCount >= avgCards + 3 && Math.random() < 0.6) {
          console.log(`[AIBot - Nope] Bot ${player.name} Counter-Nopes ${lastNoper.name} purely because they are the LEADER (Collusion)!`);
          return { type: 'PLAY_NOPE', cardId: nopeCard.id };
        }
      }
      return null;
    }

    const cardType = action.cards[0]?.type;
    const isTargeted = action.targetId === botId;

    // 1. Never Nope Shuffle or See the Future. It's a waste of a precious defensive card.
    if (cardType === CardType.SHUFFLE || cardType === CardType.SEE_THE_FUTURE) {
      return null;
    }

    // 2. Pro Gamer Move: If the top card of the deck is a known bomb, and the current active player
    // tries to play SKIP or ATTACK to avoid bosing it, we ALWAYS Nope them to force them to draw the bomb!
    if (isTopCardBomb && (cardType === CardType.SKIP || cardType === CardType.ATTACK)) {
      const activePlayer = this.game.players.find(p => p.id === action.playerId);
      // Ensure the active player is the one whose turn it is to draw (turnsToPlay > 0)
      if (activePlayer && activePlayer.turnsToPlay > 0 && activePlayer.id === this.game.getCurrentPlayer()?.id) {
        console.log(`[AIBot - Nope] Bot ${player.name} Nopes ${activePlayer.name}'s ${cardType} to force them to draw the known bomb!`);
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
    }

    // 3. If targeted by Favor or Steal combo:
    if (isTargeted && (cardType === CardType.FAVOR || action.actionType === '2-CARD' || action.actionType === '3-CARD')) {
      // Protect our cards if we have a small hand (protecting Defuse/Nope) or in late game
      const protectingDefuse = hasDefuse && handSize <= 3;
      const isLateGame = deckSize <= 8;
      if (protectingDefuse || isLateGame || Math.random() < 0.3) {
        console.log(`[AIBot - Nope] Bot ${player.name} Nopes combo/favor from ${this.game.players.find(p => p.id === action.playerId)?.name} to protect its hand.`);
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
      return null;
    }

    // 4. If opponent plays Attack targeting us (or we are next in turn order):
    if (cardType === CardType.ATTACK) {
      // Determine if we are the victim of the attack
      let nextIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
      while (this.game.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % this.game.players.length;
      }
      const nextPlayerId = this.game.players[nextIndex].id;

      if (nextPlayerId === botId || action.targetId === botId) {
        // Nope the Attack only if we are in danger (no Defuse or deck is late game)
        if (!hasDefuse || deckSize <= 8) {
          console.log(`[AIBot - Nope] Bot ${player.name} Nopes Attack from opponent due to danger.`);
          return { type: 'PLAY_NOPE', cardId: nopeCard.id };
        }
      }
    }

    // 5. Collusion: Gang up on the Leader (Third-party Nope)
    // If a player has a massive advantage (e.g., they have >= avg + 3 cards), and they play a combo or favor against someone else,
    // we might Nope them just to bleed their cards and protect the other weak players!
    if (!isTargeted && action.playerId !== botId && (cardType === CardType.FAVOR || action.actionType === '2-CARD' || action.actionType === '3-CARD')) {
      const activePlayer = this.game.players.find(p => p.id === action.playerId);
      const aliveCount = this.game.players.filter(p => !p.isEliminated).length;
      const totalCards = this.game.players.filter(p => !p.isEliminated).reduce((sum, p) => sum + p.handCount, 0);
      if (activePlayer && aliveCount >= 3) {
        const avgCards = totalCards / aliveCount;
        if (activePlayer.handCount >= avgCards + 3 && Math.random() < 0.4) {
          console.log(`[AIBot - Nope] Bot ${player.name} Nopes ${activePlayer.name}'s action purely because they are the LEADER (Collusion)!`);
          return { type: 'PLAY_NOPE', cardId: nopeCard.id };
        }
      }
    }

    return null;
  }

  public getLateNopeDecision(botId: string): PlayerAction | null {
    const player = this.game.players.find(p => p.id === botId);
    if (!player || !this.game.lastNopeableAction) return null;

    const nopeCard = player.hand.find(c => c.type === CardType.NOPE);
    if (!nopeCard) return null;

    const lastAction = this.game.lastNopeableAction;
    const deckSize = this.game.drawPile.length;
    const hasDefuse = player.hasDefuse();

    // Case 5: Attack/Skip active turn change
    if ((lastAction.type === 'ATTACK' || lastAction.type === 'SKIP') &&
        lastAction.targetId === botId &&
        this.game.getCurrentPlayer().id === botId) {
      
      // Nope the Attack/Skip if we are in danger (no Defuse or deck is late game) or 50% chance normally
      if (!hasDefuse || deckSize <= 8 || Math.random() < 0.5) {
        console.log(`[AIBot - LateNope] Bot ${player.name} plays late Nope to revert the ${lastAction.type}.`);
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
    }

    // Case 6: Noping a resolved Nope (counter-noping after the window has expired)
    if (lastAction.type === 'NOPE' &&
        lastAction.targetId === botId &&
        lastAction.originalAction) {
      
      const orig = lastAction.originalAction;
      // Re-nope to protect valuable plays (Attack, Skip, or Combos)
      if (orig.type === CardType.ATTACK || 
          orig.type === CardType.SKIP || 
          orig.actionType === '2-CARD' || 
          orig.actionType === '3-CARD') {
        console.log(`[AIBot - LateNope] Bot ${player.name} plays late Nope to counter player's Nope on ${orig.type}.`);
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
    }

    // Case 4: Recent card transfer flying animation (within 1000ms)
    if ((lastAction.type === '2-CARD' || lastAction.type === '3-CARD' || lastAction.type === 'FAVOR') &&
        lastAction.targetId === botId &&
        Date.now() - lastAction.timestamp < 1000 &&
        lastAction.stolenCard) {
      
      const stolen = lastAction.stolenCard.card;
      // Nope the steal if it took a valuable card (Defuse/Nope) or if we have a small hand
      if (stolen.type === CardType.DEFUSE || 
          stolen.type === CardType.NOPE || 
          player.handCount <= 3 || 
          Math.random() < 0.4) {
        console.log(`[AIBot - LateNope] Bot ${player.name} plays late Nope to cancel card transfer of ${stolen.name}.`);
        return { type: 'PLAY_NOPE', cardId: nopeCard.id };
      }
    }

    return null;
  }

  private takeHardRuleTurn(botId: string, requiresDefuse: boolean): PlayerAction {
    const player = this.game.players.find(p => p.id === botId)!;
    const hand = player.hand;
    const deckSize = this.game.drawPile.length;
    const hasDefuse = player.hasDefuse();
    const alivePlayers = this.game.players.filter(p => !p.isEliminated).length;

    // ==========================================
    // PHASE 0: DEFUSE PLACEMENT (Expert-level)
    // ==========================================
    if (requiresDefuse) {
      // After defusing, turnsToPlay is decremented by 1.
      // If we still have more draws left, we MUST place the bomb deep enough to not draw it again ourselves.
      const remainingDrawsAfterDefuse = player.turnsToPlay - 1;

      if (remainingDrawsAfterDefuse > 0) {
        // We're under Attack and still have draws remaining. Place bomb PAST our remaining draws.
        const safeDepth = Math.min(remainingDrawsAfterDefuse + 1, this.game.drawPile.length);
        console.log(`[Expert] ${player.name}: Under attack with ${remainingDrawsAfterDefuse} draws left. Placing bomb at depth ${safeDepth} to avoid self-draw.`);
        return { type: 'DEFUSE', insertIndex: safeDepth };
      }

      // This is our last draw. Next player will draw after us.
      let nextIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
      while (this.game.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % this.game.players.length;
      }
      const nextPlayer = this.game.players[nextIndex];

      if (!nextPlayer.hasDefuse()) {
        // KILL SHOT: Next player has no Defuse → place on top for instant elimination
        console.log(`[Expert] ${player.name}: KILL SHOT! Placing bomb on top to eliminate defuse-less ${nextPlayer.name}!`);
        return { type: 'DEFUSE', insertIndex: 0 };
      }

      // Next player HAS Defuse. Force them to waste it by placing on top.
      // In competitive play, draining an opponent's Defuse is almost as good as killing them.
      // Mix in position 1 occasionally (they might See The Future + Skip past index 0).
      const insertIndex = Math.random() < 0.75 ? 0 : 1;
      console.log(`[Expert] ${player.name}: Placing bomb at index ${insertIndex} to drain ${nextPlayer.name}'s Defuse.`);
      return { type: 'DEFUSE', insertIndex };
    }

    // ==========================================
    // PHASE 1: INTELLIGENCE GATHERING
    // ==========================================
    // Bomb knowledge from See The Future memory
    const isBombOnTop = player.knownDeckTop.length > 0 &&
                        player.knownDeckTop[0].cardType === CardType.EXPLODING_KITTEN;
    const isTopCardSafe = player.knownDeckTop.length > 0 &&
                          player.knownDeckTop[0].cardType !== CardType.EXPLODING_KITTEN;
    const bombInDrawRange = player.knownDeckTop.findIndex((c: any, idx: number) =>
      c.cardType === CardType.EXPLODING_KITTEN && idx < player.turnsToPlay
    ) !== -1;

    // Suspicion from recent defuses by other players
    const lastDefuse = (this.game as any).lastDefuseAction;
    const isBombSuspected = lastDefuse &&
                            lastDefuse.playerId !== botId &&
                            lastDefuse.drawsSinceDefuse < 2;

    // Threat assessment
    const bombsInDeck = this.game.drawPile.filter(c => c.type === CardType.EXPLODING_KITTEN).length;
    const bombProbability = deckSize > 0 ? bombsInDeck / deckSize : 0;
    const isCriticalDeck = deckSize <= 3;
    const isEndGame = deckSize <= 6;
    const isMidGame = deckSize > 6 && deckSize <= 12;
    const isEarlyGame = deckSize > 12;
    const isDangerZone = (bombInDrawRange || isBombOnTop) || (isBombSuspected && !isTopCardSafe);

    // ==========================================
    // PHASE 2: HAND INVENTORY
    // ==========================================
    const attackCards = hand.filter(c => c.type === CardType.ATTACK);
    const skipCards = hand.filter(c => c.type === CardType.SKIP);
    const seeFutureCards = hand.filter(c => c.type === CardType.SEE_THE_FUTURE);
    const shuffleCards = hand.filter(c => c.type === CardType.SHUFFLE);
    const favorCards = hand.filter(c => c.type === CardType.FAVOR);
    const nopeCards = hand.filter(c => c.type === CardType.NOPE);
    const escapeCount = attackCards.length + skipCards.length; // Cards that avoid drawing

    // Cat Card combos (the ONLY cards that should be used as combos normally)
    const counts: Record<string, string[]> = {};
    hand.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });
    const isDesperation = isDangerZone && escapeCount === 0 && shuffleCards.length === 0;
    const pairType = this.getValidComboType(counts, 2, isDesperation);
    const tripletType = this.getValidComboType(counts, 3, isDesperation);

    // Strategic target selection
    const target = this.selectStrategicTarget(botId);

    // Helper: find the best target for Favor (player with fewest cards = highest chance of stealing Defuse)
    const getBestFavorTarget = (): any => {
      const candidates = this.game.players.filter(p => p.id !== botId && !p.isEliminated && p.handCount > 0);
      if (candidates.length === 0) return null;
      // Prioritize: (1) player who has Defuse and fewest cards, (2) player with fewest cards
      const defuseHolders = candidates.filter(p => p.hasDefuse()).sort((a, b) => a.handCount - b.handCount);
      if (defuseHolders.length > 0 && !hasDefuse) return defuseHolders[0]; // Steal from smallest-hand Defuse holder
      return candidates.sort((a, b) => a.handCount - b.handCount)[0]; // Smallest hand = highest value per card
    };

    // ==========================================
    // RULE 0: TOP CARD IS SAFE → DRAW (conserve everything)
    // ==========================================
    if (isTopCardSafe) {
      console.log(`[Expert] ${player.name}: Top card is safe. Conserving resources, drawing.`);
      return { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 1: UNDER ATTACK (turnsToPlay > 1)
    // ==========================================
    // When attacked, the priority is to escape without drawing.
    // Expert move: Chain Attack BACK → opponent takes even more turns (stacking pressure).
    if (player.turnsToPlay > 1) {
      // 1a. CHAIN ATTACK (offensive counter) - force pressure back onto opponents
      if (attackCards.length > 0) {
        console.log(`[Expert] ${player.name}: CHAIN ATTACK! Reflecting attack pressure back.`);
        return { type: 'PLAY_CARDS', cardIds: [attackCards[0].id] };
      }
      // 1b. Skip to reduce turn count by 1
      if (skipCards.length > 0) {
        console.log(`[Expert] ${player.name}: Using Skip to reduce attack pressure (${player.turnsToPlay} → ${player.turnsToPlay - 1} turns).`);
        return { type: 'PLAY_CARDS', cardIds: [skipCards[0].id] };
      }
      // 1c. Shuffle if bomb suspected (we must draw, so at least randomize)
      if ((isDangerZone || isBombSuspected) && shuffleCards.length > 0) {
        console.log(`[Expert] ${player.name}: Shuffling deck under attack with bomb suspicion.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCards[0].id] };
      }
      // 1d. Scout before forced draw
      if (seeFutureCards.length > 0 && player.knownDeckTop.length === 0) {
        console.log(`[Expert] ${player.name}: Scouting deck before forced draw under attack.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCards[0].id] };
      }
      // 1e. No escape available - must draw
      console.log(`[Expert] ${player.name}: No escape cards under attack. Drawing.`);
      return { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 2: BOMB IMMINENT (confirmed or strongly suspected)
    // ==========================================
    if (isDangerZone) {
      const threatLevel = isBombOnTop ? 'CONFIRMED ON TOP' : (bombInDrawRange ? 'IN DRAW RANGE' : 'SUSPECTED');
      console.log(`[Expert] ${player.name}: BOMB ${threatLevel}! Survival protocol activated.`);

      // 2a. If only suspected (not confirmed), verify with See The Future before wasting escape cards
      if (!isBombOnTop && !bombInDrawRange && seeFutureCards.length > 0 && player.knownDeckTop.length === 0) {
        console.log(`[Expert] ${player.name}: Verifying suspected bomb with See The Future before committing escape cards.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCards[0].id] };
      }

      // 2b. Attack (BEST escape: skip your draw AND punish opponent with 2 extra turns over the bomb)
      if (attackCards.length > 0) {
        // Prefer Attack over Skip when a vulnerable opponent exists (no Defuse = potential kill)
        const vulnerableOpponent = this.game.players.find(p => p.id !== botId && !p.isEliminated && !p.hasDefuse());
        console.log(`[Expert] ${player.name}: Playing Attack to escape bomb${vulnerableOpponent ? ` (targeting defuse-less ${vulnerableOpponent.name})` : ''}!`);
        return { type: 'PLAY_CARDS', cardIds: [attackCards[0].id] };
      }

      // 2c. Skip (safe escape, no extra pressure on opponents)
      if (skipCards.length > 0) {
        console.log(`[Expert] ${player.name}: Playing Skip to dodge bomb.`);
        return { type: 'PLAY_CARDS', cardIds: [skipCards[0].id] };
      }

      // 2d. Shuffle (no Skip/Attack available - randomize bomb position as last resort)
      if (shuffleCards.length > 0) {
        console.log(`[Expert] ${player.name}: No escape cards! Shuffling to randomize bomb.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCards[0].id] };
      }

      // 2e. DESPERATION: No escape cards at all. Try stealing defense with combos or Favor.
      if (target && target.handCount > 0) {
        if (tripletType) {
          // Request Defuse if we don't have one, otherwise request Attack/Skip
          const preferred = !hasDefuse ? CardType.DEFUSE : CardType.ATTACK;
          const requestedType = this.getBestCardTypeToRequest(target, preferred);
          console.log(`[Expert] ${player.name}: DESPERATE 3-of-a-kind for ${requestedType} from ${target.name}!`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: target.id, requestedCardType: requestedType as any };
        }
        if (pairType) {
          console.log(`[Expert] ${player.name}: DESPERATE pair steal from ${target.name}!`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
        if (favorCards.length > 0) {
          const favorTarget = getBestFavorTarget() || target;
          console.log(`[Expert] ${player.name}: DESPERATE Favor on ${favorTarget.name}!`);
          return { type: 'PLAY_CARDS', cardIds: [favorCards[0].id], targetId: favorTarget.id };
        }
      }

      // Truly no options. Draw and hope for Defuse.
      console.log(`[Expert] ${player.name}: No options left. Drawing into danger.`);
      return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 3: CRITICAL DECK (≤ 3 cards left)
    // ==========================================
    // Every draw is life-threatening. Play hyper-defensively.
    if (isCriticalDeck) {
      console.log(`[Expert] ${player.name}: CRITICAL DECK (${deckSize} cards). Hyper-defensive mode.`);

      // 3a. Always scout before drawing
      if (seeFutureCards.length > 0 && player.knownDeckTop.length === 0) {
        console.log(`[Expert] ${player.name}: Critical scouting with See The Future.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCards[0].id] };
      }

      // 3b. Use Attack/Skip to avoid drawing entirely
      if (attackCards.length > 0) {
        console.log(`[Expert] ${player.name}: Critical Attack to avoid drawing.`);
        return { type: 'PLAY_CARDS', cardIds: [attackCards[0].id] };
      }
      if (skipCards.length > 0) {
        console.log(`[Expert] ${player.name}: Critical Skip to avoid drawing.`);
        return { type: 'PLAY_CARDS', cardIds: [skipCards[0].id] };
      }

      // 3c. Try to steal Defuse if we don't have one
      if (!hasDefuse && target && target.handCount > 0) {
        if (tripletType) {
          const defuseHolder = this.game.players.find(p => p.id !== botId && !p.isEliminated && p.hasDefuse() && p.handCount > 0);
          const stealTarget = defuseHolder || target;
          const requestedType = this.getBestCardTypeToRequest(stealTarget, CardType.DEFUSE);
          console.log(`[Expert] ${player.name}: Critical 3-of-a-kind for ${requestedType} from ${stealTarget.name}!`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: stealTarget.id, requestedCardType: requestedType as any };
        }
        if (pairType) {
          console.log(`[Expert] ${player.name}: Critical pair steal from ${target.name}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
        if (favorCards.length > 0) {
          const favorTarget = getBestFavorTarget() || target;
          console.log(`[Expert] ${player.name}: Critical Favor on ${favorTarget.name}.`);
          return { type: 'PLAY_CARDS', cardIds: [favorCards[0].id], targetId: favorTarget.id };
        }
      }

      // 3d. Shuffle as last resort if unknown deck
      if (shuffleCards.length > 0 && player.knownDeckTop.length === 0) {
        console.log(`[Expert] ${player.name}: Critical Shuffle to randomize before forced draw.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCards[0].id] };
      }

      console.log(`[Expert] ${player.name}: Critical draw (no options left).`);
      return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 3.5: OFFENSIVE REVENGE (The Grudge System)
    // ==========================================
    // If the next player has severely wronged us recently, punish them with an Attack.
    let nextIdx = (this.game.currentPlayerIndex + 1) % this.game.players.length;
    while (this.game.players[nextIdx].isEliminated) {
      nextIdx = (nextIdx + 1) % this.game.players.length;
    }
    const nextPlayerObj = this.game.players[nextIdx];
    
    let nextPlayerRevengeScore = 0;
    if ((this.game as any).actionHistory) {
      const history = (this.game as any).actionHistory as string[];
      let lastActionByBot = false;
      history.forEach((action, idx) => {
        const recencyWeight = 1.0 + (idx / history.length) * 2.0; 
        if (action.includes(nextPlayerObj.name) && (
          action.includes("played Favor on " + player.name) || 
          action.includes("played a Pair on " + player.name) || 
          action.includes("Three of a kind on " + player.name) || 
          action.includes("stole from " + player.name)
        )) {
          nextPlayerRevengeScore += 8.0 * recencyWeight;
        }
        if (action.includes(`${player.name} played`)) {
          lastActionByBot = true;
        } else if (action.includes("Nope!")) {
          if (lastActionByBot && action.includes(nextPlayerObj.name)) {
            nextPlayerRevengeScore += 12.0 * recencyWeight;
          }
        } else {
          lastActionByBot = false;
        }
      });
    }

    // If revenge score is very high (> 15), unleash an Attack aggressively
    if (nextPlayerRevengeScore >= 15.0 && attackCards.length > 0 && Math.random() > 0.2) {
      console.log(`[Expert] ${player.name}: REVENGE TIME! Playing Attack aggressively to punish ${nextPlayerObj.name}!`);
      return { type: 'PLAY_CARDS', cardIds: [attackCards[0].id] };
    }

    // ==========================================
    // RULE 4: END GAME (≤ 6 cards in deck)
    // ==========================================
    if (isEndGame) {
      console.log(`[Expert] ${player.name}: End game (${deckSize} cards left). Tactical play.`);

      // 4a. ALWAYS scout before drawing if we have no intel
      if (seeFutureCards.length > 0 && player.knownDeckTop.length === 0) {
        console.log(`[Expert] ${player.name}: End game scouting.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCards[0].id] };
      }

      // 4b. Strip opponent's Defuse - this wins end games
      if (!hasDefuse && target && target.handCount > 0) {
        // 3-of-a-kind to specifically steal Defuse
        if (tripletType) {
          const defuseHolder = this.game.players.find(p => p.id !== botId && !p.isEliminated && p.hasDefuse() && p.handCount > 0);
          const stealTarget = defuseHolder || target;
          const requestedType = this.getBestCardTypeToRequest(stealTarget, CardType.DEFUSE);
          console.log(`[Expert] ${player.name}: End game hunting ${requestedType} from ${stealTarget.name} with 3-of-a-kind.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: stealTarget.id, requestedCardType: requestedType as any };
        }
        // Pair steal (can't choose card type, but better than nothing)
        if (pairType) {
          console.log(`[Expert] ${player.name}: End game pair steal from ${target.name}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
        // Favor (target player with fewest cards for highest chance of Defuse)
        if (favorCards.length > 0) {
          const favorTarget = getBestFavorTarget() || target;
          console.log(`[Expert] ${player.name}: End game Favor on ${favorTarget.name} (${favorTarget.handCount} cards, high value per steal).`);
          return { type: 'PLAY_CARDS', cardIds: [favorCards[0].id], targetId: favorTarget.id };
        }
      }

      // 4c. If we already have Defuse, still use combos to weaken opponents
      if (hasDefuse && target && target.handCount > 0) {
        if (tripletType) {
          // Steal their Nope to prevent them from blocking our plays
          const requestedType = this.getBestCardTypeToRequest(target, CardType.NOPE);
          console.log(`[Expert] ${player.name}: End game stripping ${target.name}'s ${requestedType} with 3-of-a-kind.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: target.id, requestedCardType: requestedType as any };
        }
        if (pairType && Math.random() > 0.4) {
          console.log(`[Expert] ${player.name}: End game pair steal from ${target.name}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
      }

      // 4d. Preemptive Skip/Attack if no intel on deck and bomb probability is high
      if (player.knownDeckTop.length === 0 && bombProbability >= 0.25) {
        if (skipCards.length > 1) { // Only use Skip if we have a spare
          console.log(`[Expert] ${player.name}: End game preemptive Skip (high bomb probability: ${(bombProbability * 100).toFixed(0)}%).`);
          return { type: 'PLAY_CARDS', cardIds: [skipCards[0].id] };
        }
        if (attackCards.length > 1) {
          console.log(`[Expert] ${player.name}: End game preemptive Attack (high bomb probability).`);
          return { type: 'PLAY_CARDS', cardIds: [attackCards[0].id] };
        }
      }

      // 4e. Shuffle if someone recently defused (bomb near top)
      if (isBombSuspected && shuffleCards.length > 0) {
        console.log(`[Expert] ${player.name}: End game Shuffle after recent opponent defuse.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCards[0].id] };
      }

      console.log(`[Expert] ${player.name}: End game drawing (calculated risk).`);
      return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 5: MID GAME (7-12 cards in deck)
    // ==========================================
    if (isMidGame) {
      console.log(`[Expert] ${player.name}: Mid game (${deckSize} cards left). Building advantage.`);

      // 5a. Steal cards with Cat Card combos (building resources for endgame)
      if (target && target.handCount > 0) {
        // Triplet: steal a specific card type (Ultimate priority)
        if (tripletType) {
          const preferred = !hasDefuse ? CardType.DEFUSE : CardType.NOPE;
          const stealTarget = !hasDefuse
            ? (this.game.players.find(p => p.id !== botId && !p.isEliminated && p.hasDefuse() && p.handCount > 0) || target)
            : target;
          const requestedType = this.getBestCardTypeToRequest(stealTarget, preferred);
          console.log(`[Expert] ${player.name}: Mid game 3-of-a-kind for ${requestedType} from ${stealTarget.name}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: stealTarget.id, requestedCardType: requestedType as any };
        }
        // Pair: random steal, good for resource building
        if (pairType && Math.random() > 0.3) {
          console.log(`[Expert] ${player.name}: Mid game pair steal from ${target.name}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
        }
      }

      // 5b. Favor (good value mid-game for resource building)
      if (favorCards.length > 0 && target && target.handCount > 0 && Math.random() > 0.4) {
        const favorTarget = getBestFavorTarget() || target;
        console.log(`[Expert] ${player.name}: Mid game Favor on ${favorTarget.name}.`);
        return { type: 'PLAY_CARDS', cardIds: [favorCards[0].id], targetId: favorTarget.id };
      }

      // 5c. Scout with See The Future only if deck is getting risky
      if (seeFutureCards.length > 0 && player.knownDeckTop.length === 0 && Math.random() > 0.6) {
        console.log(`[Expert] ${player.name}: Mid game scouting with See The Future.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCards[0].id] };
      }

      // 5d. Shuffle if bomb suspected from recent defuse
      if (isBombSuspected && shuffleCards.length > 0 && Math.random() > 0.4) {
        console.log(`[Expert] ${player.name}: Mid game Shuffle after suspicious defuse.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCards[0].id] };
      }

      // 5e. SAVE Skip/Attack/Nope for critical moments. Just draw.
      console.log(`[Expert] ${player.name}: Mid game conserving defense cards. Drawing.`);
      return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
    }

    // ==========================================
    // RULE 6: EARLY GAME (> 12 cards in deck)
    // ==========================================
    // Low bomb probability. Focus on resource accumulation.
    console.log(`[Expert] ${player.name}: Early game (${deckSize} cards). Resource accumulation phase.`);

    // 6a. Cat Card combos for free steals (Triplets have ultimate priority)
    if (target && target.handCount > 0) {
      if (tripletType) {
        // Early game: steal Defuse if we don't have one, otherwise steal Attack for defense stockpile
        const preferred = !hasDefuse ? CardType.DEFUSE : CardType.ATTACK;
        const tripletTarget = !hasDefuse
          ? (this.game.players.find(p => p.id !== botId && !p.isEliminated && p.hasDefuse() && p.handCount > 0) || target)
          : target;
        const requestedType = this.getBestCardTypeToRequest(tripletTarget, preferred);
        console.log(`[Expert] ${player.name}: Early game 3-of-a-kind for ${requestedType} from ${tripletTarget.name}.`);
        return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: tripletTarget.id, requestedCardType: requestedType as any };
      }
      if (pairType && Math.random() > 0.3) {
        console.log(`[Expert] ${player.name}: Early game pair steal from ${target.name}.`);
        return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: target.id };
      }
    }

    // 6b. Favor for resource building
    if (favorCards.length > 0 && target && target.handCount > 0 && Math.random() > 0.5) {
      const favorTarget = getBestFavorTarget() || target;
      console.log(`[Expert] ${player.name}: Early game Favor on ${favorTarget.name}.`);
      return { type: 'PLAY_CARDS', cardIds: [favorCards[0].id], targetId: favorTarget.id };
    }

    // 6c. DO NOT play Skip, Attack, Shuffle, See The Future in early game.
    // These are lifesavers in late game. Conserve them absolutely.
    console.log(`[Expert] ${player.name}: Early game safe draw. Stockpiling defense cards.`);
    return this.getLastResortAction(botId) || { type: 'DRAW_CARD' };
  }
}
