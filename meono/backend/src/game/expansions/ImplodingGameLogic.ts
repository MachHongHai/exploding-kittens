import { GameEngine } from '../GameEngine.js';
import { Player, generateCardId } from '../models.js';
import { Card, CardType } from '../../../../shared/src/types.js';

export class ImplodingGameLogic {

  static setupDeck(game: GameEngine) {
    // Add Imploding Kitten
    game.drawPile.push({
      id: generateCardId(),
      type: CardType.IMPLODING_KITTEN,
      name: 'Imploding Kitten',
      description: 'When drawn face down, put back face up. When drawn face up, explode immediately. Cannot be defused.',
      isFaceUp: false
    });

    // Add Exploding Kittens: (playerCount - 2) total exploding bombs
    const bombCount = Math.max(0, game.players.length - 2);
    for (let i = 0; i < bombCount; i++) {
      game.drawPile.push({
        id: generateCardId(),
        type: CardType.EXPLODING_KITTEN,
        name: 'Exploding Kitten',
        description: 'You explode and are out of the game!'
      });
    }
  }

  static handleDrawCard(game: GameEngine, player: Player, card: Card): 'EXPLODED' | 'DEFUSE_REQUIRED' | 'UNHANDLED' {
    if (card.type === CardType.IMPLODING_KITTEN) {
      if (card.isFaceUp) {
        // Face-up: instant death, cannot be defused
        game.lastAction = `${player.name} drew the face-up Imploding Kitten and is eliminated!`;
        game.eliminatePlayer(player.id);
        return 'EXPLODED';
      } else {
        // Face-down: player must re-insert it face-up (like defuse but free)
        game.lastAction = `${player.name} drew the Imploding Kitten! Must place it back face-up.`;
        game.waitingForImplodingInsert = player.id;
        return 'DEFUSE_REQUIRED';
      }
    }
    return 'UNHANDLED';
  }

  static handleDrawFromBottomEvent(game: GameEngine, player: Player, card: Card): 'EXPLODED' | 'DEFUSE_REQUIRED' | 'UNHANDLED' {
    if (card.type === CardType.IMPLODING_KITTEN) {
      if (card.isFaceUp) {
        game.lastAction = `${player.name} drew the face-up Imploding Kitten from the bottom and is eliminated!`;
        game.eliminatePlayer(player.id);
        return 'EXPLODED';
      } else {
        game.lastAction = `${player.name} drew the Imploding Kitten from the bottom! Must place it back face-up.`;
        game.waitingForImplodingInsert = player.id;
        return 'DEFUSE_REQUIRED';
      }
    }
    return 'UNHANDLED';
  }

  static insertImplodingKitten(game: GameEngine, playerId: string, insertIndex: number): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player || game.waitingForImplodingInsert !== playerId) return false;

    const pos = Math.max(0, Math.min(insertIndex, game.drawPile.length));
    game.drawPile.splice(game.drawPile.length - pos, 0, {
      id: generateCardId(),
      type: CardType.IMPLODING_KITTEN,
      name: 'Imploding Kitten',
      description: 'When drawn face up, explode immediately!',
      isFaceUp: true
    });

    // The inserting player remembers where they put it
    while (player.knownDeckTop.length < pos) {
      player.knownDeckTop.push({ cardType: 'UNKNOWN', cardName: 'Unknown Card' });
    }
    player.knownDeckTop.splice(pos, 0, { cardType: CardType.IMPLODING_KITTEN, cardName: 'Imploding Kitten' });

    // Invalidate other players' memories since cards shifted
    game.players.forEach(p => {
      if (p.id !== player.id) {
        p.knownDeckTop = [];
      }
    });

    game.lastAction = `${player.name} placed the Imploding Kitten back face-up.`;

    game.waitingForImplodingInsert = null;
    if (--player.turnsToPlay <= 0) game.nextTurn();
    return true;
  }
  
  static handleAlterFuture3x(game: GameEngine, player: Player) {

    const top3Alter = game.drawPile.slice(-3).reverse();
    game.alteringFutureCards = top3Alter;
    game.playerAlteringFuture = player.id;
    game.lastAction = `Waiting for ${player.name} to alter the future.`;
  }

  static confirmAlterFuture(game: GameEngine, playerId: string, reorderedCardIds: string[]): boolean {
    if (game.playerAlteringFuture !== playerId) return false;
    
    // Validate that the provided IDs match the cards we gave them
    const originalIds = game.alteringFutureCards.map(c => c.id).sort();
    const newIds = [...reorderedCardIds].sort();
    if (JSON.stringify(originalIds) !== JSON.stringify(newIds)) return false;

    // Use a public method or property to get the player
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    if (game.getCurrentPlayer().id !== playerId) return false;

    // Create the reordered array
    const reorderedCards = reorderedCardIds.map(id => game.alteringFutureCards.find(c => c.id === id)!);

    // Remove the top cards from the draw pile
    game.drawPile.splice(-game.alteringFutureCards.length);

    // Push the reordered cards back onto the draw pile.
    // The UI shows them as [Top, Middle, Bottom]. 
    // To put them back on the drawPile (where the end of the array is the Top),
    // we need to reverse the reorderedCards array before pushing.
    // Example: If reorderedCards is [Card A (Top), Card B, Card C (Bottom)]
    // We push C, then B, then A. So A is at the end (Top).
    game.drawPile.push(...[...reorderedCards].reverse());

    // Update knownDeckTop
    player.knownDeckTop = reorderedCards.map(c => ({ cardType: c.type, cardName: c.name }));

    game.playerAlteringFuture = null;
    game.alteringFutureCards = [];
    (game as any).isTopCardSuspect = false; // Reset suspicion after altering
    game.lastAction = `${player.name} altered the future.`;

    return true;
  }

  static handleReverse(game: GameEngine, player: Player) {
    // Reverse the play direction
    game.playDirection = game.playDirection === 1 ? -1 : 1;
    const directionText = game.playDirection === 1 ? 'clockwise' : 'counter-clockwise';
    
    // Reverse also ends your turn without drawing (like Skip)
    player.turnsToPlay -= 1;
    if (player.turnsToPlay <= 0) {
      game.nextTurn();
    }
    game.lastAction = `${player.name} reversed the turn order! Now playing ${directionText}.`;
  }

  static handleDrawFromBottom(game: GameEngine, player: Player) {
    // This card makes the player end their turn by drawing from the bottom
    // The actual drawing is handled by Game.drawFromBottom() which is called from GameGateway
    // We just set a flag and the gateway will call drawFromBottom
    game.lastAction = `${player.name} will draw from the bottom!`;
  }

  static resolveTargetedAttack(game: GameEngine, attacker: Player, target: Player) {
    // Similar to Attack but targets a SPECIFIC player
    const stackedTurns = attacker.turnsToPlay > 1 ? attacker.turnsToPlay + 2 : 2;

    attacker.turnsToPlay = 0;

    // Move to the target player directly (skip normal turn order)
    const targetIndex = game.players.findIndex(p => p.id === target.id);
    game.currentPlayerIndex = targetIndex;
    target.turnsToPlay = stackedTurns;

    // Clear interaction states
    game.lastTheft = null;
    game.waitingForSteal = null;
    game.waitingForFavor = null;
    game.playerSeeingFuture = null;
    game.waitingForTarget = null;

    game.turnExpiresAt = Date.now() + 15000;
    game.lastAction = `${attacker.name} targeted ${target.name} with a Targeted Attack! ${target.name} has ${stackedTurns} turns to play!`;
  }
}
