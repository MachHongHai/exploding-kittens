import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game.js';
import { Player } from '../game/models.js';
import { AIBotController } from '../game/AIBot.js';
import { PlayerAction } from '../../../shared/src/types.js';

export class GameGateway {
  private io: Server;
  // Simplified for demo: Single global game instance
  private game: Game;
  private botController: AIBotController;
  private botDifficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'PLAY_WITH_GEMINI' = 'EASY';
  private bombTimers: Map<string, NodeJS.Timeout> = new Map();
  private nopeTimer: NodeJS.Timeout | null = null;
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
      });
    });
  }

  private clearAllTimers() {
    this.bombTimers.forEach(t => clearTimeout(t));
    this.countdownIntervals.forEach(t => clearInterval(t));
    this.bombTimers.clear();
    if (this.nopeTimer) clearTimeout(this.nopeTimer);
    this.nopeTimer = null;
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
  }

  private startNopeTimer() {
    if (this.nopeTimer) clearTimeout(this.nopeTimer);
    
    // Broadcast state immediately so clients see the Action Window
    this.broadcastState();

    this.nopeTimer = setTimeout(async () => {
      this.game.resolvePendingAction();
      this.nopeTimer = null;
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

  private async processAction(playerId: string, action: PlayerAction) {
    let result: 'SAFE' | 'EXPLODED' | 'DEFUSE_REQUIRED' = 'SAFE';
    let actionResult: { success: boolean; message?: string } = { success: true, message: '' };

    if (action.type === 'DRAW_CARD') {
      if (this.game.pendingAction) return { success: false, message: "Wait for action to resolve!" };
      result = this.game.drawPhase(playerId);
      if (result === 'DEFUSE_REQUIRED') {
        this.startBombTimer(playerId);
      }
    } else if (action.type === 'PLAY_CARDS') {
      actionResult = this.game.playCards(playerId, action.cardIds, action.targetId, action.requestedCardType);
      if (actionResult.success && this.game.pendingAction) {
        this.startNopeTimer();
        return actionResult; // Return immediately to let timer handle next steps
      }
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
      } else {
        return { success: false, message: "Invalid defuse action" };
      }
    }

    this.broadcastState();

    if (this.game.status === 'PLAYING') {
      await this.checkBotTurn();
    }

    return actionResult;
  }

  private async checkBotTurn() {
    const currentPlayer = this.game.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isBot || this.game.status !== 'PLAYING') return;

    if (this.game.pendingAction || this.game.waitingForFavor || this.game.waitingForSteal) {
      console.log(`[GameGateway] Bot turn paused because game has pending action or is waiting for Favor/Steal.`);
      return;
    }

    const requiresDefuse = this.game.waitingForDefuse === currentPlayer.id;

    // Increased thinking delay to 5 seconds for a more relaxed pace
    const delay = 5000; 
    setTimeout(async () => {
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
        const delay = 1500; // 1.5 seconds response delay for the bot
        setTimeout(async () => {
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

  private broadcastState() {
    this.game.players.forEach(p => {
      if (!p.isBot) {
        this.io.to(p.id).emit('match_state_update', this.game.getStateForPlayer(p.id));
      }
    });
  }
}
