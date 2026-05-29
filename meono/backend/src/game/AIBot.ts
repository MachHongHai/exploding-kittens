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

    opponents.forEach(p => {
      // 1. Base score from hand count (more cards = higher value target)
      let score = p.handCount * 1.5;

      // 2. Turn order pressure (target next player to reduce their defensive options right before they draw)
      if (p.id === nextPlayer.id) {
        score += 6.0;
      }

      // 3. Defuse card strategic targeting
      const opponentHasDefuse = p.hasDefuse();
      if (!botHasDefuse) {
        // If the bot has NO Defuse card, it should prioritize stealing from players who actually have a Defuse card!
        if (opponentHasDefuse) {
          score += 10.0;
        }
      } else {
        // If the bot already has a Defuse, it's still good to steal a Defuse, but stealing from a player who has NO Defuse
        // might leave them completely defenseless and eliminate them on their next turn!
        if (!opponentHasDefuse) {
          score += 4.0;
        }
      }

      // 4. Retaliation / Play history (check if they targeted us recently in the action history)
      const targetName = p.name;
      const botName = bot?.name || "";
      let retaliationCount = 0;
      
      const gameWithHistory = this.game as any;
      if (gameWithHistory.actionHistory) {
        const history: string[] = gameWithHistory.actionHistory;
        // Check the last 10 actions for aggression against this bot
        const recentHistory = history.slice(-10);
        let lastActionByBot = false;
        recentHistory.forEach(action => {
          if (action.includes(targetName) && (
            action.includes("played Favor on " + botName) || 
            action.includes("played a Pair on " + botName) || 
            action.includes("Three of a kind on " + botName) || 
            action.includes("stole from " + botName)
          )) {
            retaliationCount++;
          }
          if (action.includes(`${botName} played`)) {
            lastActionByBot = true;
          } else if (action.includes("Nope!")) {
            if (lastActionByBot && action.includes(targetName)) {
              retaliationCount++;
            }
          } else {
            lastActionByBot = false;
          }
        });
      }
      score += retaliationCount * 8.0; // Add 8 points for each recent aggressive action against us

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
    }

    // Play See The Future - save for late game or when danger is present
    if (seeFutureCard && (isEndGame || Math.random() > 0.8)) {
      console.log(`[AIBot - Medium] Playing See The Future.`);
      return { type: 'PLAY_CARDS', cardIds: [seeFutureCard.id] };
    }

    // Play Shuffle if we don't know the deck top and it's late game
    if (shuffleCard && isEndGame && !isTopCardSafe && Math.random() > 0.8) {
      console.log(`[AIBot - Medium] Playing Shuffle preventative.`);
      return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
    }

    // Combos / Stealing (Favor / Pairs) - play them strategic (use smart targeting score)
    const target = this.selectStrategicTarget(botId);

    if (target) {
      // Pairs
      const counts: Record<string, string[]> = {};
      player.hand.forEach(c => {
        if (!counts[c.type]) counts[c.type] = [];
        counts[c.type].push(c.id);
      });
      const pairType = Object.keys(counts).find(type => counts[type].length >= 2);
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

    return { type: 'DRAW_CARD' };
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
    // We only Nope if the action is currently active/successful (nopeCount is even: 0, 2, etc.)
    if (action.nopeCount % 2 !== 0) return null;

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

    // --- 0. HANDLE DEFUSE REQUIRED ---
    if (requiresDefuse) {
      let nextIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
      while (this.game.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % this.game.players.length;
      }
      const nextPlayer = this.game.players[nextIndex];
      const hasDefuse = nextPlayer.hasDefuse();
      
      // If the next player has no Defuse, place bomb on top (index 0) to eliminate them immediately!
      if (!hasDefuse) {
        console.log(`[AIBot - Hard] Bot ${player.name} placing bomb at index 0 to eliminate defuse-less ${nextPlayer.name}!`);
        return { type: 'DEFUSE', insertIndex: 0 };
      } else {
        // Next player has defuse. Try to place it strategically.
        let insertIndex = 0;
        if (nextPlayer.turnsToPlay > 1) {
          insertIndex = Math.random() > 0.4 ? 1 : 0;
        } else {
          const rand = Math.random();
          if (rand < 0.6) {
            insertIndex = 0; // Put it on top (60% chance)
          } else if (rand < 0.9) {
            insertIndex = 1; // Put it second card (30% chance)
          } else {
            insertIndex = Math.min(2, this.game.drawPile.length); // Put it third card (10% chance)
          }
        }
        console.log(`[AIBot - Hard] Bot ${player.name} placing bomb at index ${insertIndex} against defuse-carrying ${nextPlayer.name}.`);
        return { type: 'DEFUSE', insertIndex };
      }
    }

    // --- 1. CORE VARIABLES & STATE ANALYSIS ---
    const remainingCards = this.game.drawPile.length;
    const isEndGame = remainingCards <= 8; // End game phase
    const isMidGame = remainingCards > 8;

    // Check if we know exactly where a bomb is from See the Future
    const bombInRangeIndex = player.knownDeckTop.findIndex((c: any, idx: number) => 
      c.cardType === CardType.EXPLODING_KITTEN && idx < player.turnsToPlay
    );
    const isBombKnown = bombInRangeIndex !== -1;

    // Check if we suspect a bomb (e.g. someone recently defused and we are in the draw range of the suspicion window)
    const lastDefuse = (this.game as any).lastDefuseAction;
    const isBombSuspected = lastDefuse && 
                            lastDefuse.playerId !== botId && 
                            lastDefuse.drawsSinceDefuse < 3;

    // Top card status from memory
    const isTopCardSafe = player.knownDeckTop.length > 0 && 
                          player.knownDeckTop[0].cardType !== CardType.EXPLODING_KITTEN;

    // Bomb danger flag
    let isBombDanger = (isBombKnown || isBombSuspected) && !isTopCardSafe;

    // --- 2. GATHER AVAILABLE CARDS IN HAND ---
    const hand = player.hand;
    const attackCard = hand.find(c => c.type === CardType.ATTACK);
    const skipCard = hand.find(c => c.type === CardType.SKIP);
    const seeFutureCard = hand.find(c => c.type === CardType.SEE_THE_FUTURE);
    const shuffleCard = hand.find(c => c.type === CardType.SHUFFLE);
    const favorCard = hand.find(c => c.type === CardType.FAVOR);

    // Group cat cards / pairs / triplets
    const counts: Record<string, string[]> = {};
    hand.forEach(c => {
      if (!counts[c.type]) counts[c.type] = [];
      counts[c.type].push(c.id);
    });

    // Check desperation mode: bomb is imminent, we have NO defuse in hand, and NO escape cards (skip, attack, shuffle)
    const hasDefuse = player.hasDefuse();
    const isDesperation = isBombDanger && !hasDefuse && !attackCard && !skipCard && !shuffleCard;

    // Helper to find a valid combo card type
    const getValidComboType = (minCount: number, allowValuable: boolean): string | null => {
      // Prioritize Cat Cards first
      const catTypes = Object.keys(counts).filter(type => type.startsWith('CAT_CARD') && counts[type].length >= minCount);
      if (catTypes.length > 0) return catTypes[0];

      // Then non-valuable functional cards
      const otherTypes = Object.keys(counts).filter(type => {
        if (counts[type].length < minCount) return false;
        if (type.startsWith('CAT_CARD')) return false;
        // Strict preservation under normal circumstances
        if (!allowValuable && (type === CardType.DEFUSE || type === CardType.NOPE)) return false;
        return true;
      });
      if (otherTypes.length > 0) return otherTypes[0];

      return null;
    };

    const tripletType = getValidComboType(3, isDesperation);
    const pairType = getValidComboType(2, isDesperation);

    // Find opponents and select strategic target
    const richestOpponent = this.selectStrategicTarget(botId);

    // --- 3. DECISION-MAKING FLOW ---

    // Case 3a: We know top card is SAFE. Do NOT play any defensive/high-value cards. Just draw!
    if (isTopCardSafe) {
      console.log(`[AIBot - Hard] Bot ${player.name} knows top card is safe. Saving cards and drawing.`);
      return { type: 'DRAW_CARD' };
    }

    // Case 3b: Imminent/Suspected Bomb Danger
    if (isBombDanger) {
      console.log(`[AIBot - Hard] Bot ${player.name} detects bomb danger (Known: ${isBombKnown}, Suspected: ${isBombSuspected}).`);

      // 1. If we suspect a bomb but don't know for sure, try to verify using See The Future first!
      if (isBombSuspected && !isBombKnown && seeFutureCard && player.knownDeckTop.length === 0) {
        console.log(`[AIBot - Hard] Playing See The Future to verify the suspected bomb.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCard.id] };
      }

      // 2. Play Skip or Attack to avoid drawing the bomb.
      // Prioritize Attack if the opponent has no Defuse card (lethal pressure) or if we have multiple attacks.
      if (attackCard || skipCard) {
        const opponentHasNoDefuse = richestOpponent && !richestOpponent.hasDefuse();
        if (attackCard && (opponentHasNoDefuse || !skipCard)) {
          console.log(`[AIBot - Hard] Playing Attack to bypass bomb and target ${richestOpponent?.name}.`);
          return { type: 'PLAY_CARDS', cardIds: [attackCard.id] };
        }
        if (skipCard) {
          console.log(`[AIBot - Hard] Playing Skip to bypass bomb.`);
          return { type: 'PLAY_CARDS', cardIds: [skipCard.id] };
        }
      }

      // 3. Play Shuffle to randomize the deck since we have no Skip/Attack.
      if (shuffleCard) {
        console.log(`[AIBot - Hard] No skip/attack available. Playing Shuffle to randomize bomb.`);
        return { type: 'PLAY_CARDS', cardIds: [shuffleCard.id] };
      }

      // 4. Try to steal a defense card (Attack/Skip/Defuse) using Triplet, Pair, or Favor.
      if (richestOpponent && richestOpponent.handCount > 0) {
        if (tripletType) {
          const requestedType = richestOpponent.hasDefuse() ? CardType.DEFUSE : CardType.ATTACK;
          console.log(`[AIBot - Hard] Emergency 3-of-a-kind on ${richestOpponent.name} requesting ${requestedType}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: richestOpponent.id, requestedCardType: requestedType as any };
        }
        if (pairType) {
          console.log(`[AIBot - Hard] Playing Pair on ${richestOpponent.name} to steal defense.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: richestOpponent.id };
        }
        if (favorCard) {
          console.log(`[AIBot - Hard] Playing Favor on ${richestOpponent.name} to request defense.`);
          return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId: richestOpponent.id };
        }
      }
    }

    // Case 3c: End Game Phase (Deck <= 8 cards) - Risk is generally high even if no specific bomb is suspected yet.
    if (isEndGame) {
      console.log(`[AIBot - Hard] Bot ${player.name} is in End Game (draw pile: ${remainingCards}). Playing tactically.`);

      // 1. Play See The Future to inspect what's coming before making decisions.
      if (seeFutureCard && player.knownDeckTop.length === 0) {
        console.log(`[AIBot - Hard] End Game: Playing See The Future to inspect top cards.`);
        return { type: 'PLAY_CARDS', cardIds: [seeFutureCard.id] };
      }

      // 2. Play high-value defensive cards if we have to draw and don't know if it's safe (preventative defense)
      if (player.turnsToPlay > 1 || Math.random() > 0.4) {
        if (skipCard) {
          console.log(`[AIBot - Hard] End Game: Playing Skip preventatively.`);
          return { type: 'PLAY_CARDS', cardIds: [skipCard.id] };
        }
        if (attackCard) {
          console.log(`[AIBot - Hard] End Game: Playing Attack preventatively.`);
          return { type: 'PLAY_CARDS', cardIds: [attackCard.id] };
        }
      }

      // 3. Strategic stealing to strip opponent's defenses in the final phase
      if (richestOpponent && richestOpponent.handCount > 0) {
        if (tripletType && Math.random() > 0.5) {
          const requestedType = richestOpponent.hasDefuse() ? CardType.DEFUSE : CardType.ATTACK;
          console.log(`[AIBot - Hard] End Game: Playing 3-of-a-kind on ${richestOpponent.name} requesting ${requestedType}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: richestOpponent.id, requestedCardType: requestedType as any };
        }
        if (pairType && Math.random() > 0.6) {
          console.log(`[AIBot - Hard] End Game: Playing Pair on ${richestOpponent.name} to strip defense.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: richestOpponent.id };
        }
        if (favorCard && Math.random() > 0.6) {
          console.log(`[AIBot - Hard] End Game: Playing Favor on ${richestOpponent.name} to strip defense.`);
          return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId: richestOpponent.id };
        }
      }
    }

    // Case 3d: Early/Mid Game Phase (Deck > 8 cards) - Save valuable cards!
    if (isMidGame) {
      // 1. Use Favor, Pairs, and Triplets early to build hand size and steal opponent's cards.
      // This is a great way to build resources for the end game.
      if (richestOpponent && richestOpponent.handCount > 0 && player.handCount > 3) {
        if (tripletType && Math.random() > 0.3) {
          const requestedType = richestOpponent.hasDefuse() ? CardType.DEFUSE : CardType.ATTACK;
          console.log(`[AIBot - Hard] Mid Game: Playing 3-of-a-kind on ${richestOpponent.name} requesting ${requestedType}.`);
          return { type: 'PLAY_CARDS', cardIds: counts[tripletType].slice(0, 3), targetId: richestOpponent.id, requestedCardType: requestedType as any };
        }
        if (pairType && Math.random() > 0.4) {
          console.log(`[AIBot - Hard] Mid Game: Playing Pair on ${richestOpponent.name} strategically.`);
          return { type: 'PLAY_CARDS', cardIds: counts[pairType].slice(0, 2), targetId: richestOpponent.id };
        }
        if (favorCard && Math.random() > 0.5) {
          console.log(`[AIBot - Hard] Mid Game: Playing Favor on ${richestOpponent.name} strategically.`);
          return { type: 'PLAY_CARDS', cardIds: [favorCard.id], targetId: richestOpponent.id };
        }
      }

      // 2. Do NOT play Attack, Skip, or See The Future unless we have an excess of them (e.g. > 2 skips, or > 2 attacks)
      // to keep them for the critical end game.
      const attacks = hand.filter(c => c.type === CardType.ATTACK);
      const skips = hand.filter(c => c.type === CardType.SKIP);
      
      if (attacks.length >= 2 && Math.random() > 0.7) {
        console.log(`[AIBot - Hard] Mid Game: Playing excess Attack.`);
        return { type: 'PLAY_CARDS', cardIds: [attacks[0].id] };
      }
      if (skips.length >= 2 && Math.random() > 0.7) {
        console.log(`[AIBot - Hard] Mid Game: Playing excess Skip.`);
        return { type: 'PLAY_CARDS', cardIds: [skips[0].id] };
      }
    }

    // Default action: Draw a card to end the turn and build the hand.
    console.log(`[AIBot - Hard] Bot ${player.name} drawing card safely.`);
    return { type: 'DRAW_CARD' };
  }
}
