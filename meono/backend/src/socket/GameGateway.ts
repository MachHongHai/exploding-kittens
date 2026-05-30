import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game.js';
import { Player } from '../game/models.js';
import { AIBotController } from '../game/AIBot.js';
import { PlayerAction, CardType } from '../../../shared/src/types.js';

export class GameGateway {
  private io: Server;
  // Simplified for demo: Single global game instance
  private game: Game;
  private botController: AIBotController;
  private botDifficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI' = 'EASY';
  private bombTimers: Map<string, NodeJS.Timeout> = new Map();
  private nopeTimer: NodeJS.Timeout | null = null;
  private targetTimer: NodeJS.Timeout | null = null;
  private botTurnTimer: NodeJS.Timeout | null = null;
  private botFavorTimer: NodeJS.Timeout | null = null;
  private stealTimer: NodeJS.Timeout | null = null;
  private favorTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private countdownIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.game = new Game('match_1');
    this.botController = new AIBotController(this.game);
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      socket.on('join_match', (data: { name: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI', botCount?: number }) => {
        this.clearAllTimers();
        // Reset game for demo purposes when a new player joins
        this.game = new Game('match_1');
        this.botController = new AIBotController(this.game);
        this.botDifficulty = data.difficulty;

        // Add human
        this.game.addPlayer(new Player(socket.id, data.name, false));
        
        // Add variable number of bots
        const count = data.botCount || 3;
        for (let i = 1; i <= count; i++) {
          this.game.addPlayer(new Player(`bot_${i}`, `Bot ${i}`, true));
        }

        this.game.start();
        console.log(`[Game] Started with ${count} bots, difficulty ${this.botDifficulty}`);

        this.broadcastState();
        this.checkBotTurn();
      });

      socket.on('player_action', async (action: PlayerAction, callback?: (res: any) => void) => {
        const currentPlayer = this.game.getCurrentPlayer();
        const res = await this.processAction(socket.id, action);
        if (callback) callback(res);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        this.clearTimersForPlayer(socket.id);

        const player = this.game.players.find(p => p.id === socket.id);
        if (player && !player.isBot) {
          console.log(`[Game] Human player ${player.name} (${socket.id}) disconnected. Stopping match.`);
          this.game.status = 'GAME_OVER';
          this.clearAllTimers();
        }
      });
    });
  }

  private clearAllTimers() {
    this.bombTimers.forEach(t => clearTimeout(t));
    this.countdownIntervals.forEach(t => clearInterval(t));
    this.bombTimers.clear();
    if (this.nopeTimer) clearTimeout(this.nopeTimer);
    this.nopeTimer = null;
    if (this.targetTimer) clearTimeout(this.targetTimer);
    this.targetTimer = null;
    if (this.stealTimer) clearTimeout(this.stealTimer);
    this.stealTimer = null;
    if (this.favorTimer) clearTimeout(this.favorTimer);
    this.favorTimer = null;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.countdownIntervals.clear();
  }

  private clearTimersForPlayer(playerId: string) {
    if (this.bombTimers.has(playerId)) {
      clearTimeout(this.bombTimers.get(playerId)!);
      this.bombTimers.delete(playerId);
    }
    if (this.countdownIntervals.has(playerId)) {
      clearInterval(this.countdownIntervals.get(playerId)!);
      this.countdownIntervals.delete(playerId);
    }
    if (this.game.waitingForTarget?.playerId === playerId && this.targetTimer) {
      clearTimeout(this.targetTimer);
      this.targetTimer = null;
    }
  }

  private startNopeTimer() {
    if (this.nopeTimer) clearTimeout(this.nopeTimer);
    
    // Broadcast state immediately so clients see the Action Window
    this.broadcastState();

    this.nopeTimer = setTimeout(async () => {
      this.game.resolvePendingAction();
      this.nopeTimer = null;
      this.checkStateTimers();
      this.broadcastState();
      
      // If playing after resolution
      if (this.game.status === 'PLAYING') {
        await this.checkBotTurn();
        await this.checkBotFavorResponse();
      }
    }, 5000);

    // Give bots a chance to Nope
    this.game.players.filter(p => p.isBot).forEach(bot => {
      setTimeout(async () => {
        if (this.game.pendingAction && this.game.status === 'PLAYING') {
           const action = await this.botController.takeNopeDecision(bot.id, this.botDifficulty);
           if (action) {
             await this.processAction(bot.id, action);
           }
        }
      }, Math.random() * 2000 + 1000); // 1-3 seconds reaction time
    });
  }

  private startBombTimer(playerId: string) {
    this.clearTimersForPlayer(playerId);
    
    let secondsLeft = 15;
    this.game.bombCountdown = secondsLeft;
    this.broadcastState();

    const interval = setInterval(() => {
      secondsLeft -= 1;
      this.game.bombCountdown = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        this.countdownIntervals.delete(playerId);
      }
      this.broadcastState();
    }, 1000);

    const timeout = setTimeout(() => {
      console.log(`[Game] Player ${playerId} failed to defuse in time.`);
      this.game.eliminatePlayer(playerId);
      this.clearTimersForPlayer(playerId);
      this.broadcastState();
      this.checkBotTurn();
    }, 15000);

    this.bombTimers.set(playerId, timeout);
    this.countdownIntervals.set(playerId, interval);
  }

  private checkStateTimers(delayExtra: number = 0) {
    if (this.game.status !== 'PLAYING') return;

    if (this.game.waitingForSteal && !this.stealTimer) {
      this.startStealTimer();
    } else if (!this.game.waitingForSteal && this.stealTimer) {
      clearTimeout(this.stealTimer);
      this.stealTimer = null;
    }

    if (this.game.waitingForFavor && !this.favorTimer) {
      this.startFavorTimer();
    } else if (!this.game.waitingForFavor && this.favorTimer) {
      clearTimeout(this.favorTimer);
      this.favorTimer = null;
    }

    const hasActiveInteraction = this.game.pendingAction || this.game.waitingForTarget || this.game.waitingForSteal || this.game.waitingForFavor || this.game.waitingForDefuse || this.game.playerSeeingFuture !== null;
    
    if (!hasActiveInteraction && !this.turnTimer) {
      this.startTurnTimer(delayExtra);
    } else if (hasActiveInteraction && this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
      this.game.turnExpiresAt = undefined;
    } else if (hasActiveInteraction && !this.turnTimer) {
      // Ensure the frontend timer is cleared if there's an interaction but the timer was already null
      this.game.turnExpiresAt = undefined;
    }
  }

  private startStealTimer() {
    if (this.stealTimer) clearTimeout(this.stealTimer);
    this.stealTimer = setTimeout(async () => {
      const state = this.game.waitingForSteal;
      if (state) {
        console.log(`[GameGateway] Steal timed out for ${state.stealerId}`);
        const victim = this.game.players.find(p => p.id === state.victimId);
        if (victim && victim.handCount > 0) {
          const randIdx = Math.floor(Math.random() * victim.handCount);
          await this.processAction(state.stealerId, { type: 'STEAL_CARD', victimId: victim.id, cardIndex: randIdx });
        } else {
          this.game.waitingForSteal = null;
          this.checkStateTimers();
          this.broadcastState();
        }
      }
    }, 10000);
  }

  private startFavorTimer() {
    if (this.favorTimer) clearTimeout(this.favorTimer);
    this.favorTimer = setTimeout(async () => {
      const state = this.game.waitingForFavor;
      if (state) {
        console.log(`[GameGateway] Favor timed out for victim ${state.victimId}`);
        const victim = this.game.players.find(p => p.id === state.victimId);
        if (victim && victim.handCount > 0) {
          const randCard = victim.hand[Math.floor(Math.random() * victim.handCount)];
          await this.processAction(state.victimId, { type: 'GIVE_CARD', requesterId: state.requesterId, cardId: randCard.id });
        } else {
          this.game.waitingForFavor = null;
          this.checkStateTimers();
          this.broadcastState();
        }
      }
    }, 10000);
  }

  private startTurnTimer(delayExtra: number = 0) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.game.turnExpiresAt = Date.now() + 15000 + delayExtra;
    this.turnTimer = setTimeout(async () => {
      const currentPlayer = this.game.getCurrentPlayer();
      if (currentPlayer && this.game.status === 'PLAYING' && !this.game.pendingAction && !this.game.waitingForDefuse && !this.game.waitingForSteal && !this.game.waitingForFavor && !this.game.waitingForTarget) {
        console.log(`[GameGateway] Turn timed out for ${currentPlayer.name}`);
        await this.processAction(currentPlayer.id, { type: 'DRAW_CARD' });
      }
    }, 15000 + delayExtra);
  }

  private async processAction(playerId: string, action: PlayerAction) {
    let result: 'SAFE' | 'EXPLODED' | 'DEFUSE_REQUIRED' = 'SAFE';
    let actionResult: { success: boolean; message?: string } = { success: true, message: '' };
    let delayExtra = 0;

    if (action.type === 'DRAW_CARD') {
      if (this.game.pendingAction) return { success: false, message: "Wait for action to resolve!" };
      result = this.game.drawPhase(playerId);
      if (result === 'DEFUSE_REQUIRED') {
        this.startBombTimer(playerId);
      }
    } else if (action.type === 'PLAY_CARDS') {
      actionResult = this.game.playCards(playerId, action.cardIds, action.targetId, action.requestedCardType);
      
      if (actionResult.success) {
        // Reset turn timer immediately upon playing a card to prevent AFK timeouts during Action Windows
        if (this.turnTimer) {
           clearTimeout(this.turnTimer);
           this.turnTimer = null;
        }
        
        if (this.game.pendingAction) {
          this.game.turnExpiresAt = undefined; // Pause AFK timer on frontend
          this.startNopeTimer();
          return actionResult; // Return immediately to let timer handle next steps
        }
        if (this.game.waitingForTarget) {
          this.game.turnExpiresAt = undefined;
          this.startTargetTimer(playerId);
          return actionResult;
        }

        // Only restart the AFK timer if there is no interaction waiting
        if (this.game.status === 'PLAYING') {
           this.game.turnExpiresAt = Date.now() + 15000;
        }
      }
    } else if (action.type === 'SELECT_TARGET') {
      if (this.targetTimer) {
        clearTimeout(this.targetTimer);
        this.targetTimer = null;
      }
      const success = this.executeTargetSelection(playerId, action.targetId, action.requestedCardType, false);
      actionResult = { success, message: success ? '' : 'Failed to select target' };
    } else if (action.type === 'PLAY_NOPE') {
      actionResult = this.game.playNope(playerId, action.cardId);
      if (actionResult.success) {
        this.startNopeTimer();
        return actionResult;
      }
    } else if (action.type === 'PASS_NOPE') {
      return { success: true };
    } else if (action.type === 'STEAL_CARD') {
      const success = this.game.stealCard(playerId, action.victimId, action.cardIndex);
      actionResult = { success, message: success ? '' : 'Failed to steal card' };
    } else if (action.type === 'GIVE_CARD') {
      const success = this.game.giveCard(playerId, action.requesterId, action.cardId);
      actionResult = { success, message: success ? '' : 'Failed to give card' };
    } else if (action.type === 'CONFIRM_FUTURE') {
      this.game.clearFuture(playerId);
    } else if (action.type === 'DEFUSE') {
      const success = this.game.defuseKitten(playerId, action.insertIndex);
      if (success) {
        this.clearTimersForPlayer(playerId);
        this.game.bombCountdown = undefined;
        delayExtra = 3000;
      } else {
        return { success: false, message: "Invalid defuse action" };
      }
    }

    if (actionResult.success) {
      if (action.type === 'PLAY_CARDS' || action.type === 'DRAW_CARD' || action.type === 'DEFUSE') {
        // Reset turn timer when taking these specific actions
        if (this.turnTimer) {
           clearTimeout(this.turnTimer);
           this.turnTimer = null;
        }
        if (this.game.status === 'PLAYING') {
           this.game.turnExpiresAt = Date.now() + 15000 + delayExtra;
        }
      }
      this.checkStateTimers(delayExtra);
    }

    this.broadcastState();

    if (this.game.status === 'PLAYING') {
      await this.checkBotTurn();
      await this.checkBotLateNope();
    }

    return actionResult;
  }

  private async checkBotLateNope() {
    if (!this.game.lastNopeableAction) return;
    
    const action = this.game.lastNopeableAction;
    // We only care about Case 4 here (card transfers) because Case 5 and 6 are handled at the start of bot turns
    if (action.type !== '2-CARD' && action.type !== '3-CARD' && action.type !== 'FAVOR') return;

    const targetBot = this.game.players.find(p => p.id === action.targetId);
    if (!targetBot || !targetBot.isBot || targetBot.isEliminated) return;

    // React quickly (e.g. 300-600ms) to Nope within the 1-second flight window
    const delay = Math.random() * 300 + 200; 
    setTimeout(async () => {
      // Re-verify action is still valid and unchanged
      if (this.game.lastNopeableAction === action && this.game.status === 'PLAYING') {
        const decision = this.botController.getLateNopeDecision(targetBot.id);
        if (decision) {
          await this.processAction(targetBot.id, decision);
        }
      }
    }, delay);
  }

  private async checkBotTurn() {
    const currentPlayer = this.game.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isBot || this.game.status !== 'PLAYING') return;

    if (this.game.pendingAction || this.game.waitingForFavor || this.game.waitingForSteal) {
      console.log(`[GameGateway] Bot turn paused because game has pending action or is waiting for Favor/Steal.`);
      return;
    }

    const requiresDefuse = this.game.waitingForDefuse === currentPlayer.id;

    // Clear any existing timer to prevent multiple overlapping bot turns
    if (this.botTurnTimer) clearTimeout(this.botTurnTimer);

    // Increased thinking delay to 5 seconds for a more relaxed pace
    const delay = 5000; 
    this.botTurnTimer = setTimeout(async () => {
      this.botTurnTimer = null;
      // Re-verify it's still their turn and the game is active
      const activePlayer = this.game.getCurrentPlayer();
      if (!activePlayer || activePlayer.id !== currentPlayer.id || this.game.status !== 'PLAYING') return;

      try {
        const action = await this.botController.takeTurn(activePlayer.id, this.botDifficulty, requiresDefuse);
        await this.processAction(activePlayer.id, action);
      } catch (error) {
        console.error("[Bot Error]", error);
        // Fallback
        if (requiresDefuse) {
          await this.processAction(activePlayer.id, { type: 'DEFUSE', insertIndex: 0 });
        } else {
          await this.processAction(activePlayer.id, { type: 'DRAW_CARD' });
        }
      }
    }, delay);
  }

  private async checkBotFavorResponse() {
    if (this.game.waitingForFavor) {
      const victimId = this.game.waitingForFavor.victimId;
      const victim = this.game.players.find(p => p.id === victimId);
      if (victim && victim.isBot) {
        if (this.botFavorTimer) clearTimeout(this.botFavorTimer);
        const delay = 1500; // 1.5 seconds response delay for the bot
        this.botFavorTimer = setTimeout(async () => {
          this.botFavorTimer = null;
          if (this.game.waitingForFavor && this.game.waitingForFavor.victimId === victimId) {
            try {
              const action = await this.botController.takeTurn(victimId, this.botDifficulty);
              await this.processAction(victimId, action);
            } catch (e) {
              console.error("[Bot Favor Response Error]", e);
            }
          }
        }, delay);
      }
    }
  }

  private startTargetTimer(playerId: string) {
    if (this.targetTimer) clearTimeout(this.targetTimer);
    this.broadcastState();
    this.targetTimer = setTimeout(() => {
      this.resolveTargetTimeout(playerId);
    }, 12500);
  }

  private resolveTargetTimeout(playerId: string) {
    this.targetTimer = null;
    if (!this.game.waitingForTarget || this.game.waitingForTarget.playerId !== playerId) return;

    const opponents = this.game.players.filter(p => p.id !== playerId && !p.isEliminated && p.handCount > 0);
    if (opponents.length === 0) {
      this.game.waitingForTarget = null;
      this.broadcastState();
      return;
    }

    const randomOpp = opponents[Math.floor(Math.random() * opponents.length)];
    let requestedCardType: any = undefined;

    if (this.game.waitingForTarget.type === '3-CARD') {
      const validTypes = Object.values(CardType).filter(t => t !== 'EXPLODING_KITTEN');
      requestedCardType = validTypes[Math.floor(Math.random() * validTypes.length)];
    }

    this.executeTargetSelection(playerId, randomOpp.id, requestedCardType, true);
  }

  private executeTargetSelection(playerId: string, targetId: string, requestedCardType?: any, isTimeout: boolean = false): boolean {
    if (!this.game.waitingForTarget || this.game.waitingForTarget.playerId !== playerId) return false;

    const target = this.game.players.find(p => p.id === targetId);
    if (!target || target.isEliminated || target.handCount === 0) return false;

    this.game.selectTarget(playerId, targetId, requestedCardType, isTimeout);
    this.game.waitingForTarget = null;
    this.broadcastState();

    if (this.game.pendingAction) {
      this.startNopeTimer();
    }

    return true;
  }

  private broadcastState() {
    this.game.players.forEach(p => {
      if (!p.isBot) {
        this.io.to(p.id).emit('match_state_update', this.game.getStateForPlayer(p.id));
      }
    });
  }
}
