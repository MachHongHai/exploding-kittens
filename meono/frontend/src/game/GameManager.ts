import Phaser from 'phaser';

export class GameManager extends Phaser.Events.EventEmitter {
  private static instance: GameManager;
  public gameState: any = null;
  public socketId: string = '';

  private constructor() {
    super();
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public setSocketId(id: string) {
    this.socketId = id;
    this.emit('socket_id_set', id);
  }

  public updateState(state: any) {
    this.gameState = state;
    this.emit('state_updated', state);
  }

  public sendAction(action: any) {
    this.emit('player_action', action);
  }
}

export const gameManager = GameManager.getInstance();
