import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BoardScene } from './scenes/BoardScene';

export const getGameConfig = (parent: HTMLElement): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: false,
  roundPixels: true,
  antialias: true,
  antialiasGL: true,
  resolution: window.devicePixelRatio || 1,
  transparent: true,
  scene: [BootScene, BoardScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
});
