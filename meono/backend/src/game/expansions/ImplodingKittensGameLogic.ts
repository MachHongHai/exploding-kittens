import { Game } from '../Game.js';
import { Player } from '../models.js';

export class ImplodingKittensGameLogic {
  
  static handleAlterFuture3x(game: Game, player: Player) {
    const top3Alter = game.drawPile.slice(-3).reverse();
    game.alteringFutureCards = top3Alter;
    game.playerAlteringFuture = player.id;
    game.lastAction = `Waiting for ${player.name} to alter the future.`;
  }

  static confirmAlterFuture(game: Game, playerId: string, reorderedCardIds: string[]): boolean {
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

  static handleReverse(game: Game, player: Player) {
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

  static handleDrawFromBottom(game: Game, player: Player) {
    // This card makes the player end their turn by drawing from the bottom
    // The actual drawing is handled by Game.drawFromBottom() which is called from GameGateway
    // We just set a flag and the gateway will call drawFromBottom
    game.lastAction = `${player.name} will draw from the bottom!`;
  }

  static resolveTargetedAttack(game: Game, attacker: Player, target: Player) {
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
