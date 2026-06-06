import Phaser from 'phaser';
import ek2Tabletop from '../../assets/ek2_tabletop.png';
import { CardType } from '../../../../shared/src/types';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Loading...',
      style: {
        font: '20px monospace',
        color: '#ffffff'
      }
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffa500, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      this.scene.start('BoardScene');
    });

    // Load custom tabletop background
    this.load.image('tabletop', ek2Tabletop);
    
    // Load card back
    this.load.image('CARD_BACK', 'cards/CARD_BACK.png');
    
    // Load all card front faces dynamically
    Object.values(CardType).forEach((type) => {
      this.load.image(type, `cards/${type}.png`);
    });

    // Load cartoon explosion frames
    for (let i = 1; i <= 7; i++) {
      this.load.image(`explosion_${i}`, `assets/explosion/explosion_${i}.png`);
    }

    // Load cat paw frames (only 3, 4, 5, 8, 9)
    const allowedPaws = [3, 4, 5, 8, 9];
    allowedPaws.forEach((i) => {
      this.load.image(`paw_${i}`, `assets/paws/paw_${i}.png`);
    });
  }
}
