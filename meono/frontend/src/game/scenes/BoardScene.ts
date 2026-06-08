import Phaser from 'phaser';
import { gameManager } from '../GameManager';
import { CardType, type Card } from '../../../../shared/src/types';

export class BoardScene extends Phaser.Scene {
  private deckSprite!: Phaser.GameObjects.Image;
  private discardSprites: Phaser.GameObjects.Image[] = [];
  private deckText!: Phaser.GameObjects.Text;
  
  private localCards: Phaser.GameObjects.Container[] = [];
  private selectedCards: Set<string> = new Set();
  private locallyAnimatedCardIds: Set<string> = new Set();
  private skipNextDrawAnimation: boolean = false;
  private isDrawingDragActive: boolean = false;
  private activeDragCard: {
    container: Phaser.GameObjects.Container;
    targetX: number;
    targetY: number;
    targetRotation: number;
    offsetX: number;
    offsetY: number;
    pointer: Phaser.Input.Pointer;
    prevX: number;
    prevTime: number;
  } | null = null;
  
  private opponentContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private animatedCards: Phaser.GameObjects.Image[] = [];

  private prevDiscardPile: Card[] = [];
  private prevPlayersState: any[] = [];
  private prevDrawPileCount: number = 0;
  
  private tabletopGaugeGraphics!: Phaser.GameObjects.Graphics;
  private tabletopGaugeText!: Phaser.GameObjects.Text;
  private maxDrawPileCount: number = 20;
  private dragArmGraphics!: Phaser.GameObjects.Graphics;
  private deckStackGraphics!: Phaser.GameObjects.Graphics;

  private favorPawSprite: Phaser.GameObjects.Image | null = null;
  private isFavorAnimationRunning: boolean = false;
  private newlyDrawnCardId: string | null = null;
  private assignedPawAssetKey: string = '';

  constructor() {
    super('BoardScene');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Assign a random paw from allowed list (3, 4, 5, 8, 9) for the entire match duration
    const allowedPaws = [3, 4, 5, 8, 9];
    const randomIndex = Phaser.Math.Between(0, allowedPaws.length - 1);
    this.assignedPawAssetKey = `paw_${allowedPaws[randomIndex]}`;

    // 1. Draw deck & discard piles (center of the screen)
    this.setupCenterPiles();

    // 3. Register state update listener from React Socket
    gameManager.on('state_updated', this.onStateUpdated, this);
    gameManager.on('socket_id_set', this.onSocketIdSet, this);
    gameManager.on('give_card_local', this.onGiveCardLocal, this);

    // Clean up listeners on shutdown/destroy to avoid memory leaks/ReferenceErrors
    this.events.on('shutdown', this.cleanup, this);
    this.events.on('destroy', this.cleanup, this);

    // Trigger initial render if state is already loaded
    if (gameManager.gameState) {
      this.onStateUpdated(gameManager.gameState);
    }

    this.dragArmGraphics = this.add.graphics();
    this.dragArmGraphics.setDepth(99);
  }

  update(time: number, delta: number) {
    if (this.activeDragCard) {
      const drag = this.activeDragCard;
      const pointer = drag.pointer;

      // Update target coordinate
      drag.targetX = pointer.x - drag.offsetX;
      drag.targetY = pointer.y - drag.offsetY;

      // Calculate velocity
      const dt = Math.max(1, time - drag.prevTime);
      const vx = (pointer.x - drag.prevX) / dt;
      drag.prevX = pointer.x;
      drag.prevTime = time;

      // Card base rotation (PI/2 for deck card draw, 0 for hand cards)
      const baseRot = drag.container.getData('isDrawCard') ? Math.PI / 2 : 0;
      // Procedural tilt based on mouse velocity
      drag.targetRotation = Math.min(0.25, Math.max(-0.25, vx * 4.8)) + baseRot;

      // Frame-rate independent lerp using exponentiation
      const lerpPos = 1 - Math.exp(-22 * (delta / 1000)); // fast snappy position tracking
      const lerpRot = 1 - Math.exp(-12 * (delta / 1000)); // smooth springy rotation tilt

      drag.container.x += (drag.targetX - drag.container.x) * lerpPos;
      drag.container.y += (drag.targetY - drag.container.y) * lerpPos;
      drag.container.rotation += (drag.targetRotation - drag.container.rotation) * lerpRot;
    }
    this.dragArmGraphics.clear();
  }

  private cleanup() {
    gameManager.off('state_updated', this.onStateUpdated, this);
    gameManager.off('socket_id_set', this.onSocketIdSet, this);
    gameManager.off('give_card_local', this.onGiveCardLocal, this);
  }

  private onSocketIdSet() {
    if (gameManager.gameState) {
      this.onStateUpdated(gameManager.gameState);
    }
  }

  private setupCenterPiles() {
    const cx = 960;
    const cy = 495;

    // Draw Pile 3D Stack Graphics
    this.deckStackGraphics = this.add.graphics();
    this.deckStackGraphics.setDepth(4);

    // Draw Pile (Left) - scaled and rotated CARD_BACK logo
    this.deckSprite = this.add.image(cx - 150, cy, 'CARD_BACK');
    this.deckSprite.setDisplaySize(250, 52.2);
    this.deckSprite.setRotation(Math.PI / 2);
    this.deckSprite.setDepth(5);

    // Interaction zone covering the full card area (200x280)
    const deckZone = this.add.zone(cx - 150, cy, 200, 280);
    deckZone.setInteractive({ useHandCursor: true });
    
    // Glowing border / tint for deck when it's our turn to draw
    deckZone.on('pointerover', () => {
      if (this.isMyTurnToDraw()) {
        this.deckSprite.setTint(0xffd700);
      }
    });
    deckZone.on('pointerout', () => {
      if (this.isMyTurnToDraw()) {
        this.deckSprite.setTint(0xffe066);
      } else {
        this.deckSprite.clearTint();
      }
    });
    deckZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isMyTurnToDraw()) return;
      
      const startPointerX = pointer.x;
      const startPointerY = pointer.y;
      const startTime = this.time.now;

      // Prevent hand interaction
      this.isDrawingDragActive = true;
      
      // Create a temporary card back container at the deck position
      const drawCardContainer = this.add.container(cx - 150, cy);
      drawCardContainer.setDepth(100);
      
      const cbBg = this.add.graphics();
      // White border base
      cbBg.fillStyle(0xffffff, 1);
      cbBg.fillRoundedRect(-100, -140, 200, 280, 24);
      cbBg.lineStyle(1.5, 0x000000, 0.45);
      cbBg.strokeRoundedRect(-100, -140, 200, 280, 24);
      // Red backing inside
      cbBg.fillStyle(0x8b1a28, 1);
      cbBg.fillRoundedRect(-96, -136, 192, 272, 20);

      const cbImg = this.add.image(0, 0, 'CARD_BACK');
      cbImg.setDisplaySize(250, 52.2);
      cbImg.setRotation(Math.PI / 2);

      drawCardContainer.add([cbBg, cbImg]);
      
      // Calculate grab offsets
      const grabOffsetX = pointer.x - (cx - 150);
      const grabOffsetY = pointer.y - cy;
      
      // Mark as draw card and set active drag target
      drawCardContainer.setData('isDrawCard', true);
      
      this.activeDragCard = {
        container: drawCardContainer,
        targetX: cx - 150,
        targetY: cy,
        targetRotation: Math.PI / 2,
        offsetX: grabOffsetX,
        offsetY: grabOffsetY,
        pointer,
        prevX: pointer.x,
        prevTime: this.time.now
      };
      
      const onPointerUp = () => {
        this.input.off('pointerup', onPointerUp);
        
        if (this.activeDragCard && this.activeDragCard.container === drawCardContainer) {
          this.activeDragCard = null;
        }
        
        // Reset flag with a tiny delay to ensure hand sprite pointerup checks are safely bypassed
        this.time.delayedCall(50, () => {
          this.isDrawingDragActive = false;
        });
        
        const elapsed = this.time.now - startTime;
        const distMoved = Phaser.Math.Distance.Between(startPointerX, startPointerY, pointer.x, pointer.y);
        const isClick = distMoved < 15 && elapsed < 250;

        if (isClick) {
          drawCardContainer.destroy();
          this.drawCardAction();
          return;
        }

        // Check if released near the hand area (generous threshold y > 650)
        const isDroppedInHand = drawCardContainer.y > 650;
        
        if (isDroppedInHand) {
          // Tell animateCardDraw to skip the flight animation since the player dragged it locally
          this.skipNextDrawAnimation = true;
          
          // Play a animation scaling into the hand and trigger the actual draw action
          this.tweens.add({
            targets: drawCardContainer,
            x: 960,
            y: 870,
            scaleX: 220 / 200,
            scaleY: 308 / 280,
            rotation: 0,
            duration: 250,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              drawCardContainer.destroy();
              this.drawCardAction();
            }
          });
        } else {
          // Bounce back to deck pile
          this.tweens.add({
            targets: drawCardContainer,
            x: cx - 150,
            y: cy,
            rotation: Math.PI / 2,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
              drawCardContainer.destroy();
            }
          });
        }
      };
      
      this.input.on('pointerup', onPointerUp);
    });

    // Deck size counter text (Matching the original React styled "X CARDS LEFT")
    this.deckText = this.add.text(cx - 150, cy + 195, '0 CARDS LEFT', {
      fontFamily: 'Lilita One',
      fontSize: '30px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    this.deckText.setStroke('#000000', 8);
    this.deckText.setShadow(3, 3, '#000000', 3, true, true);
    this.deckText.setDepth(6);

    // Discard Pile Slot Outline (Right)
    const discardOutline = this.add.graphics();
    discardOutline.lineStyle(3.5, 0xffffff, 0.55);
    discardOutline.setDepth(3);
    this.drawDashedRoundedRect(discardOutline, cx + 150 - 100, cy - 140, 200, 280, 18, 9, 8);

    // Tabletop Gauge (Left of Deck)
    this.tabletopGaugeGraphics = this.add.graphics();
    this.tabletopGaugeGraphics.setDepth(2);

    this.tabletopGaugeText = this.add.text(cx - 380 + 10, cy + 32, '0/0', {
      fontFamily: 'Lilita One',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5).setDepth(3);
    this.tabletopGaugeText.setStroke('#000000', 5);
  }

  private updateDeckStack(drawPileCount: number) {
    if (!this.deckStackGraphics) return;

    const cx = 960;
    const cy = 495;
    const g = this.deckStackGraphics;
    g.clear();

    if (drawPileCount <= 0) {
      this.deckSprite.setVisible(false);
      return;
    }

    this.deckSprite.setVisible(true);

    // Calculate dynamic 3D stack layers (white edges with red borders inside)
    // We draw from bottom to top to stack them correctly.
    const maxLayers = 14;
    const numLayers = Math.min(maxLayers, Math.ceil(drawPileCount / 2));

    for (let i = numLayers; i >= 1; i--) {
      // Offset downwards for 3D stack perspective
      const layerY = cy + i * 2.8;

      // Subtle shadow under each layer
      g.fillStyle(0x000000, 0.12);
      g.fillRoundedRect(cx - 150 - 100, layerY - 140 + 1.5, 200, 280, 24);

      // Card outer white border
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(cx - 150 - 100, layerY - 140, 200, 280, 24);

      // Thin red strip margins on the sides (4px inset, 6px width)
      g.fillStyle(0x8b1a28, 1);
      // Left red strip
      g.fillRoundedRect(cx - 150 - 96, layerY - 136, 6, 272, 4);
      // Right red strip
      g.fillRoundedRect(cx - 150 + 90, layerY - 136, 6, 272, 4);
      // Bottom red strip
      g.fillRoundedRect(cx - 150 - 96, layerY + 130, 192, 6, 4);

      // Inner white card edge body
      g.fillStyle(0xf5f5f5, 1);
      g.fillRoundedRect(cx - 150 - 90, layerY - 136, 180, 266, 16);
    }

    // Draw top card base (at cy)
    // Outer white card border
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(cx - 150 - 100, cy - 140, 200, 280, 24);
    
    // Outer border stroke: highlight gold if my turn
    const isMyTurn = this.isMyTurnToDraw();
    if (isMyTurn) {
      g.lineStyle(4, 0xffd700, 0.95);
    } else {
      g.lineStyle(1.5, 0x000000, 0.45);
    }
    g.strokeRoundedRect(cx - 150 - 100, cy - 140, 200, 280, 24);

    // Red backing fill
    g.fillStyle(0x8b1a28, 1);
    g.fillRoundedRect(cx - 150 - 96, cy - 136, 192, 272, 20);
  }

  private drawDashedRoundedRect(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    dashLength: number = 8,
    gapLength: number = 6
  ) {
    const segments = [
      // Top line
      { type: 'line' as const, x1: x + radius, y1: y, x2: x + width - radius, y2: y },
      // Top-Right corner
      { type: 'arc' as const, cx: x + width - radius, cy: y + radius, r: radius, startAngle: -Math.PI / 2, endAngle: 0 },
      // Right line
      { type: 'line' as const, x1: x + width, y1: y + radius, x2: x + width, y2: y + height - radius },
      // Bottom-Right corner
      { type: 'arc' as const, cx: x + width - radius, cy: y + height - radius, r: radius, startAngle: 0, endAngle: Math.PI / 2 },
      // Bottom line
      { type: 'line' as const, x1: x + width - radius, y1: y + height, x2: x + radius, y2: y + height },
      // Bottom-Left corner
      { type: 'arc' as const, cx: x + radius, cy: y + height - radius, r: radius, startAngle: Math.PI / 2, endAngle: Math.PI },
      // Left line
      { type: 'line' as const, x1: x, y1: y + height - radius, x2: x, y2: y + radius },
      // Top-Left corner
      { type: 'arc' as const, cx: x + radius, cy: y + radius, r: radius, startAngle: Math.PI, endAngle: Math.PI * 1.5 }
    ];

    this.drawDashedPath(graphics, segments, dashLength, gapLength);
  }

  private drawDashedPath(
    graphics: Phaser.GameObjects.Graphics,
    segments: Array<
      | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
      | { type: 'arc'; cx: number; cy: number; r: number; startAngle: number; endAngle: number }
    >,
    dashLength: number = 8,
    gapLength: number = 6
  ) {
    let draw = true;
    let distanceLeft = dashLength;

    segments.forEach(seg => {
      if (seg.type === 'line') {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;
        const ux = dx / len;
        const uy = dy / len;

        let t = 0;
        let currentX = seg.x1;
        let currentY = seg.y1;

        while (t < len) {
          const step = Math.min(len - t, distanceLeft);
          const nextX = currentX + ux * step;
          const nextY = currentY + uy * step;

          if (draw) {
            graphics.lineBetween(currentX, currentY, nextX, nextY);
          }

          currentX = nextX;
          currentY = nextY;
          t += step;
          distanceLeft -= step;

          if (distanceLeft <= 0.0001) {
            draw = !draw;
            distanceLeft = draw ? dashLength : gapLength;
          }
        }
      } else if (seg.type === 'arc') {
        const angleDiff = seg.endAngle - seg.startAngle;
        const len = seg.r * Math.abs(angleDiff);
        if (len === 0) return;

        let t = 0;

        while (t < len) {
          const step = Math.min(len - t, distanceLeft);
          const t1 = t / len;
          const t2 = (t + step) / len;
          const a1 = seg.startAngle + t1 * angleDiff;
          const a2 = seg.startAngle + t2 * angleDiff;

          if (draw) {
            const numSteps = Math.ceil(step / 2);
            graphics.beginPath();
            graphics.moveTo(seg.cx + Math.cos(a1) * seg.r, seg.cy + Math.sin(a1) * seg.r);
            for (let k = 1; k <= numSteps; k++) {
              const subT = k / numSteps;
              const subAngle = a1 + subT * (a2 - a1);
              graphics.lineTo(seg.cx + Math.cos(subAngle) * seg.r, seg.cy + Math.sin(subAngle) * seg.r);
            }
            graphics.strokePath();
          }

          t += step;
          distanceLeft -= step;

          if (distanceLeft <= 0.0001) {
            draw = !draw;
            distanceLeft = draw ? dashLength : gapLength;
          }
        }
      }
    });
  }

  private isMyTurnToDraw(): boolean {
    const state = gameManager.gameState;
    if (!state || state.status !== 'PLAYING') return false;
    
    // It must be my turn, and no interaction pending (like See the Future, Steal selection, Defuse, etc.)
    const isMyTurn = state.currentPlayerId === gameManager.socketId;
    const isInteractionPending = state.waitingForDefuse || 
                                 state.waitingForImplodingInsert || 
                                 state.waitingForSteal || 
                                 state.waitingForFavor || 
                                 state.waitingForTarget ||
                                 state.actionWindow;
                                 
    return isMyTurn && !isInteractionPending;
  }

  private drawCardAction() {
    gameManager.sendAction({ type: 'DRAW_CARD' });
  }

  private onStateUpdated(state: any) {
    if (!state || !this.sys || !this.add) return;

    // Cat Paw Favor Request Animation Logic
    const isFavorActive = state.waitingForFavor?.victimId === gameManager.socketId;
    if (isFavorActive) {
      if (!this.favorPawSprite) {
        const requesterId = state.waitingForFavor?.requesterId;
        let startX = 960;
        let startY = 190;
        const oppContainer = this.opponentContainers.get(requesterId);
        if (oppContainer) {
          startX = oppContainer.x;
          startY = oppContainer.y;
        }

        const angle = Phaser.Math.Angle.Between(startX, startY, 960, 620) + Math.PI / 2;
        const allowedPaws = [3, 4, 5, 8, 9];
        const randomPawId = allowedPaws[Phaser.Math.Between(0, allowedPaws.length - 1)];
        this.favorPawSprite = this.add.image(startX, startY, `paw_${randomPawId}`);
        this.favorPawSprite.setDepth(98);
        this.favorPawSprite.setScale(0.85);
        this.favorPawSprite.setRotation(angle);

        this.tweens.add({
          targets: this.favorPawSprite,
          x: 960,
          y: 620,
          duration: 650,
          ease: 'Back.easeOut'
        });
      }
    } else {
      if (this.favorPawSprite && !this.isFavorAnimationRunning) {
        const paw = this.favorPawSprite;
        this.favorPawSprite = null;
        
        const requesterId = state.waitingForFavor?.requesterId || this.prevPlayersState?.[0]?.id;
        let destX = 960;
        let destY = 190;
        if (requesterId) {
          const oppContainer = this.opponentContainers.get(requesterId);
          if (oppContainer) {
            destX = oppContainer.x;
            destY = oppContainer.y;
          }
        }
        
        this.tweens.add({
          targets: paw,
          x: destX,
          y: destY,
          duration: 400,
          ease: 'Power2.easeIn',
          onComplete: () => {
            paw.destroy();
          }
        });
      }
    }

    // Save current positions of cards before any hand updates/redraws
    const localCardPositions = new Map<string, { x: number, y: number, rotation: number }>();
    this.localCards.forEach(c => {
      const cardId = c.getData('cardId');
      if (cardId) {
        localCardPositions.set(cardId, { x: c.x, y: c.y, rotation: c.rotation });
      }
    });

    // 1. Update deck count
    this.deckText.setText(`${state.drawPileCount} CARDS LEFT`);
    this.updateDeckStack(state.drawPileCount);
    
    // Highlight deck if it is local player's turn to draw
    if (this.isMyTurnToDraw()) {
      this.deckSprite.setTint(0xffe066);
    } else {
      this.deckSprite.clearTint();
    }

    // 2. Animate Drawing if deck size decreased
    if (this.prevPlayersState && this.prevPlayersState.length > 0 && state.drawPileCount < this.prevDrawPileCount) {
      for (const prevPlayer of this.prevPlayersState) {
        const currPlayer = state.players.find((p: any) => p.id === prevPlayer.id);
        if (currPlayer && currPlayer.handCount > prevPlayer.handCount) {
          let newCardType: string | undefined = undefined;
          let newCardId: string | undefined = undefined;
          if (currPlayer.id === gameManager.socketId) {
            const currentHand = currPlayer.hand || [];
            const existingIds = new Set(this.localCards.map(c => c.getData('cardId')));
            const newCard = currentHand.find((c: any) => !existingIds.has(c.id));
            if (newCard) {
              this.newlyDrawnCardId = newCard.id;
              newCardType = newCard.type;
              newCardId = newCard.id;
            }
          }
          this.animateCardDraw(currPlayer.id, newCardType, newCardId);
          break;
        }
      }
    }

    // 3. Animate Discard Pile top card / play animations
    const currentDiscardPile = state.discardPile || [];
    const prevCount = this.prevDiscardPile.length;
    const currCount = currentDiscardPile.length;

    if (currCount > prevCount) {
      const addedCards = currentDiscardPile.slice(prevCount);
      let sourceId: string | null = null;
      if (this.prevPlayersState && this.prevPlayersState.length > 0) {
        for (const prevPlayer of this.prevPlayersState) {
          const currPlayer = state.players.find((p: any) => p.id === prevPlayer.id);
          if (currPlayer && currPlayer.handCount < prevPlayer.handCount) {
            sourceId = currPlayer.id;
            break;
          }
        }
      }
      if (!sourceId) {
        sourceId = state.actionWindow?.initiatorId || state.currentPlayerId;
      }

      this.animateCardsToDiscard(addedCards, sourceId, prevCount, currentDiscardPile, localCardPositions);
    } else {
      this.renderDiscardPileStack(currentDiscardPile);
    }

    // 3. Render Local Player hand
    const myPlayer = state.players.find((p: any) => p.id === gameManager.socketId);
    if (myPlayer && myPlayer.hand) {
      this.renderLocalPlayerHand(myPlayer.hand);
    }

    // 4. Render Opponents
    const opponents = state.players.filter((p: any) => p.id !== gameManager.socketId);
    this.renderOpponents(opponents, state.currentPlayerId);

    // Detect player elimination transitions
    if (this.prevPlayersState && this.prevPlayersState.length > 0) {
      state.players.forEach((currPlayer: any) => {
        const prevPlayer = this.prevPlayersState.find((p: any) => p.id === currPlayer.id);
        if (prevPlayer && !prevPlayer.isEliminated && currPlayer.isEliminated) {
          this.playExplosionAnimation(currPlayer.id);
        }
      });
    }

    // 5. Save previous state for next diff
    this.prevDiscardPile = [...currentDiscardPile];
    this.prevPlayersState = state.players.map((p: any) => ({
      id: p.id,
      handCount: p.handCount,
      isEliminated: p.isEliminated
    }));
    this.prevDrawPileCount = state.drawPileCount;

    // 6. Update visual tabletop gauge
    this.updateTabletopGauge(state);
  }

  private updateTabletopGauge(state: any) {
    if (!state) return;
    
    const gx = 960 - 380; // center X of gauge = 580
    const gy = 495 - 15;  // center Y of gauge = 480
    
    // Save max deck count
    if (state.drawPileCount > this.maxDrawPileCount) {
      this.maxDrawPileCount = state.drawPileCount;
    }
    
    const drawCount = state.drawPileCount;
    const maxCount = Math.max(drawCount, this.maxDrawPileCount);
    
    // Display text (e.g., "11/16")
    this.tabletopGaugeText.setText(`${drawCount}/${maxCount}`);
    
    // Redraw graphics
    const g = this.tabletopGaugeGraphics;
    g.clear();
    
    // 1. Black outer plate (rounded rect)
    g.fillStyle(0x242424, 0.95);
    g.lineStyle(3, 0x000000, 1);
    g.fillRoundedRect(gx - 65, gy - 75, 130, 150, 16);
    g.strokeRoundedRect(gx - 65, gy - 75, 130, 150, 16);
    
    // Inner metal border bezel
    g.lineStyle(2, 0x555555, 0.8);
    g.strokeRoundedRect(gx - 59, gy - 69, 118, 138, 12);
    
    // 2. Arch Gauge Track (radial/arc)
    // Green segment:
    g.lineStyle(7, 0x22c55e, 1);
    g.beginPath();
    g.arc(gx, gy - 15, 34, Math.PI * 1.1, Math.PI * 1.4, false);
    g.strokePath();
    
    // Yellow segment:
    g.lineStyle(7, 0xeab308, 1);
    g.beginPath();
    g.arc(gx, gy - 15, 34, Math.PI * 1.4, Math.PI * 1.7, false);
    g.strokePath();
    
    // Red segment:
    g.lineStyle(7, 0xef4444, 1);
    g.beginPath();
    g.arc(gx, gy - 15, 34, Math.PI * 1.7, Math.PI * 1.9, false);
    g.strokePath();
    
    // Needle calculations
    const kittens = state.explodingKittensCount ?? 0;
    const isAnyExploding = !!state.waitingForDefuse;
    const basePercent = drawCount > 0 ? (kittens / drawCount) * 100 : 0;
    const kittenPercent = isAnyExploding ? 100 : basePercent;
    
    // Angle range from Math.PI * 1.1 (0% chance) to Math.PI * 1.9 (100% chance)
    const angleRange = Math.PI * 0.8;
    const needleAngle = Math.PI * 1.1 + (kittenPercent / 100) * angleRange;
    
    // Draw needle shadow
    g.lineStyle(4, 0x000000, 0.4);
    g.lineBetween(gx + 2, gy - 13, gx + 2 + Math.cos(needleAngle) * 30, gy - 13 + Math.sin(needleAngle) * 30);
    
    // Draw Needle (Red)
    g.lineStyle(3, 0xef4444, 1);
    g.lineBetween(gx, gy - 15, gx + Math.cos(needleAngle) * 30, gy - 15 + Math.sin(needleAngle) * 30);
    
    // Center pin of the gauge
    g.fillStyle(0xef4444, 1);
    g.fillCircle(gx, gy - 15, 6);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(gx, gy - 15, 2.2);
    
    // 3. Draw a tiny card stack icon next to the text at the bottom
    const tx = gx - 45;
    const ty = gy + 32;
    g.fillStyle(0xffffff, 0.85);
    g.lineStyle(1.5, 0x000000, 1);
    
    // Back card shape
    g.fillRoundedRect(tx + 4, ty - 2, 14, 20, 2);
    g.strokeRoundedRect(tx + 4, ty - 2, 14, 20, 2);
    
    // Front card shape
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(tx, ty, 14, 20, 2);
    g.strokeRoundedRect(tx, ty, 14, 20, 2);
  }

  private renderLocalPlayerHand(hand: Card[]) {
    // Clear old cards first
    this.localCards.forEach(c => c.destroy());
    this.localCards = [];

    const N = hand.length;
    if (N === 0) return;

    const cx = 960;
    const cy = 870; // Lifted hand cards to prevent clipping by bottom rounded corners
    
    // Spacing configuration
    const maxSpacing = 135;
    const minSpacing = 60;
    const calculatedSpacing = Math.max(minSpacing, Math.min(maxSpacing, 1200 / N));
    const radius = 1050;
    const angleStep = calculatedSpacing / radius;

    hand.forEach((card, index) => {
      // Fan layout calculation
      const mid = (N - 1) / 2;
      const angle = (index - mid) * angleStep; // Curve angle dynamically based on calculated spacing
      
      const x = cx + radius * Math.sin(angle);
      const y = cy + radius * (1 - Math.cos(angle));
      const rotation = angle;

      // Create a Container for the card (holds backing + border glow + card sprite)
      const container = this.add.container(x, y);
      container.setRotation(rotation);
      container.setData('cardId', card.id);
      container.setData('cardType', card.type);
      container.setData('originalX', x);
      container.setData('originalY', y);
      
      // Card Backing (White background so transparent card PNGs do not show tabletop)
      const backing = this.add.graphics();
      backing.fillStyle(0xffffff, 1);
      backing.fillRoundedRect(-110, -154, 220, 308, 20);
      
      // Card Sprite
      const sprite = this.add.image(0, 0, card.type);
      sprite.setDisplaySize(220, 308);
      
      // Keep an empty glow container to avoid breaking references in the code structure
      const glow = this.add.container(0, 0);
      glow.setVisible(false);

      container.add([backing, glow, sprite]);
      this.localCards.push(container);

      // Make card interactive for clicking and dragging
      sprite.setInteractive({ useHandCursor: true, draggable: true });

      // Click to select
      sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.isDrawingDragActive) return;
        container.setData('dragged', false);
        container.setData('isMouseDown', true);
      });

      sprite.on('pointerup', () => {
        if (this.isDrawingDragActive) return;
        if (!container.getData('isMouseDown')) return;
        container.setData('isMouseDown', false);
        
        if (!container.getData('dragged')) {
          const state = gameManager.gameState;
          const isNopeOpp = this.checkNopeOpportunity(state);
          if (isNopeOpp && card.type === CardType.NOPE) {
            gameManager.sendAction({ type: 'PLAY_NOPE', cardId: card.id });
          } else {
            this.toggleCardSelection(container, card.id, glow);
          }
        }
      });

      // Drag and Drop
      this.input.setDraggable(sprite);
      
      sprite.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        if (this.isDrawingDragActive) return;
        container.setData('isMouseDown', false); // dragging is not a click select
        this.children.bringToTop(container);
        container.setScale(1.08); // slightly larger scale for dragging focus
        
        // Calculate and store pointer grab offset to prevent card jumping
        const offsetX = pointer.x - container.x;
        const offsetY = pointer.y - container.y;
        
        container.setData('dragged', false);
        
        this.activeDragCard = {
          container,
          targetX: container.x,
          targetY: container.y,
          targetRotation: 0,
          offsetX,
          offsetY,
          pointer,
          prevX: pointer.x,
          prevTime: this.time.now
        };
      });

      sprite.on('drag', (pointer: Phaser.Input.Pointer) => {
        container.setData('dragged', true);
      });

      sprite.on('dragend', () => {
        if (this.activeDragCard && this.activeDragCard.container === container) {
          this.activeDragCard = null;
        }

        container.setScale(1.0);
        container.setRotation(rotation);

        // Check if dropped in the center drop zone or on the favor paw
        const state = gameManager.gameState;
        const isFavorActive = state?.waitingForFavor?.victimId === gameManager.socketId;
        
        let droppedOnPaw = false;
        if (isFavorActive && this.favorPawSprite) {
          const dist = Phaser.Math.Distance.Between(container.x, container.y, this.favorPawSprite.x, this.favorPawSprite.y);
          if (dist < 120) {
            droppedOnPaw = true;
          }
        }

        if (droppedOnPaw && state?.waitingForFavor) {
          // Remove from localCards so it's not destroyed by an immediate render update
          this.localCards = this.localCards.filter(c => c !== container);
          this.onGiveCardLocal({ requesterId: state.waitingForFavor.requesterId, cardId: card.id, container });
        } else if (container.y < 720 && container.x > 300 && container.x < 1620) {
          // Add cardId to locallyAnimatedCardIds to prevent duplicate animation in animateCardsToDiscard
          this.locallyAnimatedCardIds.add(card.id);
          
          // Remove from localCards so it's not destroyed by an immediate render update
          this.localCards = this.localCards.filter(c => c !== container);
          
          this.children.bringToTop(container);
          
          // Smooth swipe fly animation to center discard stack
          this.tweens.add({
            targets: container,
            x: cx + 150,
            y: cy,
            scaleX: 200 / 220, // scale to discard pile size
            scaleY: 280 / 308,
            rotation: 15 * Math.PI / 180,
            duration: 250,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              container.destroy();
              // Clean up locally animated flag after some delay (to allow server update to come in)
              setTimeout(() => {
                this.locallyAnimatedCardIds.delete(card.id);
              }, 1000);
            }
          });

          this.playDraggedCard(card.id);
        } else {
          // Bounce back to original position
          this.tweens.add({
            targets: container,
            x: container.getData('originalX'),
            y: this.selectedCards.has(card.id) ? container.getData('originalY') - 45 : container.getData('originalY'),
            rotation: rotation,
            duration: 200,
            ease: 'Back.easeOut'
          });
        }
      });

      // Restore selection state visual if re-rendering
      if (this.selectedCards.has(card.id)) {
        container.y -= 60;
        glow.setVisible(true);
      }

      // Check if this is the newly drawn card, hide it until the draw animation completes
      if (card.id === this.newlyDrawnCardId) {
        container.setVisible(false);
      }
    });
  }

  private toggleCardSelection(container: Phaser.GameObjects.Container, cardId: string, glow: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics) {
    const originalY = container.getData('originalY');

    if (this.selectedCards.has(cardId)) {
      this.selectedCards.delete(cardId);
      glow.setVisible(false);
      
      this.tweens.add({
        targets: container,
        y: originalY,
        duration: 250,
        ease: 'Back.easeOut'
      });
    } else {
      this.selectedCards.add(cardId);
      glow.setVisible(true);
      
      this.tweens.add({
        targets: container,
        y: originalY - 60,
        duration: 300,
        ease: 'Back.easeOut'
      });
    }

    // Broadcast selection changes to React for action buttons
    gameManager.emit('card_selection_changed', Array.from(this.selectedCards));
  }

  private playDraggedCard(cardId: string) {
    // If the dragged card was not part of the active selection, reset selection and just play it
    if (!this.selectedCards.has(cardId)) {
      this.selectedCards.clear();
      this.selectedCards.add(cardId);
    }

    const cardIds = Array.from(this.selectedCards);
    
    // Reset local selection state
    this.selectedCards.clear();
    gameManager.emit('card_selection_changed', []);

    // Send playing action to React socket hook
    gameManager.sendAction({
      type: 'PLAY_CARDS',
      cardIds: cardIds
    });
  }

  private renderOpponents(opponents: any[], currentPlayerId: string) {
    const K = opponents.length;
    if (K === 0) return;

    const colors = [0x4ade80, 0xf97316, 0xec4899];
    const textColors = ['#4ade80', '#f97316', '#ec4899'];

    opponents.forEach((opp, index) => {
      // Calculate generic semi-circle coordinates
      const pos = this.getOpponentPosition(index, K);
      
      // Get or create opponent container
      let container = this.opponentContainers.get(opp.id);
      if (container) {
        container.destroy();
      }

      container = this.add.container(pos.x, pos.y);
      this.opponentContainers.set(opp.id, container);

      // 1. Highlight border if active turn
      const isActive = opp.id === currentPlayerId;
      if (isActive && !opp.isEliminated) {
        const glow = this.add.graphics();
        glow.lineStyle(6, 0xffa500, 1);
        glow.strokeCircle(0, 0, 72);
        
        // Pulsing animation
        this.tweens.add({
          targets: glow,
          alpha: 0.3,
          duration: 800,
          yoyo: true,
          repeat: -1
        });
        container.add(glow);
      }

      // 2. Avatar Circle (Cat Avatar)
      const avatar = this.add.graphics();
      this.drawCatFace(avatar, index, opp.isEliminated);
      container.add(avatar);

      // Add interactive hit zone for target selection
      const hitZone = this.add.zone(0, 0, 160, 160);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => {
        const state = gameManager.gameState;
        if (state && state.waitingForTarget?.playerId === gameManager.socketId) {
          gameManager.emit('opponent_clicked', opp.id);
        }
      });
      container.add(hitZone);

      // 3. Player name text (Styled in white with black stroke, matching the screenshot)
      const botNames = ['TIGER', 'TOM', 'LUNA', 'HOLA_KITTEN'];
      const displayName = botNames[index] || opp.name.toUpperCase();
      const nameText = this.add.text(0, -90, displayName, {
        fontFamily: 'Lilita One',
        fontSize: '21px',
        color: opp.isEliminated ? '#888888' : '#ffffff',
        align: 'center'
      }).setOrigin(0.5);
      nameText.setStroke('#000000', 6);
      container.add(nameText);

      // 3b. Yellow Card Count Badge (bottom-right of avatar, matching the screenshot)
      if (!opp.isEliminated && opp.handCount >= 0) {
        const badge = this.add.graphics();
        badge.fillStyle(0xfacc15, 1); // yellow
        badge.lineStyle(3, 0x000000, 1);
        badge.fillCircle(40, 40, 16);
        badge.strokeCircle(40, 40, 16);
        container.add(badge);

        const countText = this.add.text(40, 40, opp.handCount.toString(), {
          fontFamily: 'Lilita One',
          fontSize: '16px',
          color: '#000000',
          align: 'center'
        }).setOrigin(0.5);
        container.add(countText);
      }

      // 4. Status / Turns Info (Cleaned up, only active/exploded status shown below fanned hand at y = 120)
      let statusString = '';
      if (opp.isEliminated) {
        statusString = 'EXPLODED 💥';
      } else if (isActive) {
        statusString = `TURNS: ${opp.turnsToPlay}`;
      }

      if (statusString) {
        const statusText = this.add.text(0, 120, statusString, {
          fontFamily: 'Lilita One',
          fontSize: '18px',
          color: opp.isEliminated ? '#ff3333' : '#ffd700',
          align: 'center',
          backgroundColor: '#000000a0',
          padding: { x: 9, y: 4.5 }
        }).setOrigin(0.5);
        container.add(statusText);
      }

      // 5. Facedown cards fanned out below the avatar (Matching original React fan layout)
      if (!opp.isEliminated && opp.handCount > 0) {
        const handCount = opp.handCount;
        const maxCardsToShow = Math.min(8, handCount);
        const mid = (maxCardsToShow - 1) / 2;
        const spread = Math.min(27, 180 / maxCardsToShow); // horizontal spread
        
        for (let i = 0; i < maxCardsToShow; i++) {
          const angle = (i - mid) * 0.08; // curve angle in radians
          const ox = (i - mid) * spread;
          const oy = 60 + Math.abs(i - mid) * 3; // slight arc downward

          // Draw mini red card base under the transparent card back image
          const cbBg = this.add.graphics();
          // White border base
          cbBg.fillStyle(0xffffff, 1);
          cbBg.fillRoundedRect(-27, -38, 54, 76, 8);
          cbBg.lineStyle(1.0, 0x000000, 0.35);
          cbBg.strokeRoundedRect(-27, -38, 54, 76, 8);
          // Red backing inside
          cbBg.fillStyle(0x8b1a28, 1);
          cbBg.fillRoundedRect(-25, -36, 50, 72, 6);
          cbBg.setPosition(ox, oy);
          cbBg.setRotation(angle);
          container.add(cbBg);

          const cardBack = this.add.image(ox, oy, 'CARD_BACK');
          cardBack.setDisplaySize(64, 13.4);
          cardBack.setRotation(angle + Math.PI / 2);
          
          // Make interactive for card stealing
          cardBack.setInteractive({ useHandCursor: true });
          cardBack.on('pointerdown', () => {
            const state = gameManager.gameState;
            const isStealer = state?.waitingForSteal?.stealerId === gameManager.socketId;
            const victimId = state?.waitingForSteal?.victimId;
            if (isStealer && victimId === opp.id) {
              gameManager.sendAction({
                type: 'STEAL_CARD',
                victimId: opp.id,
                cardIndex: i
              });
            }
          });
          
          container.add(cardBack);
        }
      }
    });
  }

  private getOpponentPosition(index: number, total: number) {
    const width = 1920;
    const padding = 340; // Spacing margin on left and right to prevent HUD overlay collisions
    const availableWidth = width - 2 * padding;
    
    let x;
    if (total <= 1) {
      x = 960;
    } else {
      x = padding + (index / (total - 1)) * availableWidth;
    }
    
    const y = 190; // Top row alignment matching Exploding Kittens 2
    return { x, y };
  }

  private checkNopeOpportunity(state: any): boolean {
    if (!state) return false;
    if (state.waitingForDefuse || state.waitingForImplodingInsert) return false;

    const myPlayer = state.players.find((p: any) => p.id === gameManager.socketId);
    const nopeCard = myPlayer?.hand?.find((c: any) => c.type === CardType.NOPE);
    if (!nopeCard) return false;

    const isWindowActive = !!state.actionWindow && 
                           !(state.actionWindow.initiatorId === gameManager.socketId && state.actionWindow.nopeCount === 0) && 
                           state.actionWindow.lastNoperId !== gameManager.socketId;

    const isAttackOrSkipNopeable = !!state.lastNopeableAction &&
      (state.lastNopeableAction.type === 'ATTACK' || state.lastNopeableAction.type === 'SKIP' || state.lastNopeableAction.type === 'REVERSE') &&
      state.currentPlayerId === gameManager.socketId &&
      state.lastNopeableAction.initiatorId !== gameManager.socketId;

    const isResolvedNopeNopeable = !!state.lastNopeableAction &&
      state.lastNopeableAction.type === 'NOPE' &&
      state.lastNopeableAction.initiatorId !== gameManager.socketId;

    return isWindowActive || 
           (state.waitingForFavor?.victimId === gameManager.socketId) || 
           (state.waitingForSteal?.victimId === gameManager.socketId) || 
           isAttackOrSkipNopeable ||
           isResolvedNopeNopeable;
  }

  private renderDiscardPileStack(discardPile: Card[]) {
    this.discardSprites.forEach(s => s.destroy());
    this.discardSprites = [];

    if (!discardPile || discardPile.length === 0) return;

    const cx = 960;
    const cy = 495;
    
    const startIdx = Math.max(0, discardPile.length - 5);
    for (let i = startIdx; i < discardPile.length; i++) {
      const card = discardPile[i];
      const isTop = i === discardPile.length - 1;
      
      const rotation = isTop ? 15 * Math.PI / 180 : (((i * 27) % 50) - 25) * Math.PI / 180;
      const xOffset = isTop ? 15 : ((i * 19) % 30) - 15;
      const yOffset = isTop ? -7.5 : ((i * 25) % 30) - 15;
      const posX = cx + 150 + xOffset;
      const posY = cy + yOffset;

      // Card Backing (White background so transparent card PNGs do not show tabletop)
      const backing = this.add.graphics();
      backing.fillStyle(0xffffff, 1);
      backing.fillRoundedRect(-100, -140, 200, 280, 20);
      backing.setPosition(posX, posY);
      backing.setRotation(rotation);

      const sprite = this.add.image(posX, posY, card.type);
      sprite.setDisplaySize(200, 280);
      sprite.setRotation(rotation);
      
      this.discardSprites.push(backing as any);
      this.discardSprites.push(sprite);
    }
  }

  private animateCardsToDiscard(
    addedCards: Card[], 
    sourceId: string | null, 
    prevCount: number, 
    currentDiscardPile: Card[],
    localCardPositions?: Map<string, { x: number, y: number, rotation: number }>
  ) {
    this.renderDiscardPileStack(currentDiscardPile.slice(0, prevCount));

    const cx = 960;
    const cy = 495;

    let startX = cx;
    let startY = cy;
    let startRotation = 0;

    if (sourceId === gameManager.socketId) {
      const firstNewCard = addedCards[0];
      
      // If this card was already animated locally (via swipe), we skip the flight animation to avoid duplicates!
      if (firstNewCard && this.locallyAnimatedCardIds.has(firstNewCard.id)) {
        this.renderDiscardPileStack(currentDiscardPile);
        return;
      }

      const pos = localCardPositions?.get(firstNewCard?.id);
      if (pos) {
        startX = pos.x;
        startY = pos.y;
        startRotation = pos.rotation;
      } else {
        const container = this.localCards.find(c => c.getData('cardId') === firstNewCard?.id);
        if (container) {
          startX = container.x;
          startY = container.y;
          startRotation = container.rotation;
        } else {
          startX = 960;
          startY = 870;
        }
      }
    } else if (sourceId) {
      const oppContainer = this.opponentContainers.get(sourceId);
      if (oppContainer) {
        startX = oppContainer.x;
        startY = oppContainer.y;
      } else {
        startX = 960;
        startY = 150;
      }
    }

    addedCards.forEach((card, index) => {
      const i = prevCount + index;
      const isTop = i === currentDiscardPile.length - 1;
      
      const targetRotation = isTop ? 15 * Math.PI / 180 : (((i * 27) % 50) - 25) * Math.PI / 180;
      const xOffset = isTop ? 15 : ((i * 19) % 30) - 15;
      const yOffset = isTop ? -7.5 : ((i * 25) % 30) - 15;
      const targetX = cx + 150 + xOffset;
      const targetY = cy + yOffset;

      let cardStartX = startX;
      let cardStartY = startY;
      let cardStartRotation = startRotation;

      // Use exact starting position of each card if available (e.g. when playing combos via Play button)
      if (sourceId === gameManager.socketId) {
        const pos = localCardPositions?.get(card.id);
        if (pos) {
          cardStartX = pos.x;
          cardStartY = pos.y;
          cardStartRotation = pos.rotation;
        }
      }

      const isLocal = sourceId === gameManager.socketId;
      const startScaleX = isLocal ? 1 : 54 / 220;
      const startScaleY = isLocal ? 1 : 76 / 308;

      const tempContainer = this.add.container(cardStartX, cardStartY);
      tempContainer.setRotation(cardStartRotation);
      tempContainer.setScale(startScaleX, startScaleY);
      tempContainer.setDepth(100 + index);

      // Card Backing (White background so card is not transparent during animation)
      const backing = this.add.graphics();
      backing.fillStyle(0xffffff, 1);
      backing.fillRoundedRect(-110, -154, 220, 308, 20); // Hand size!

      const tempSprite = this.add.image(0, 0, card.type);
      tempSprite.setDisplaySize(220, 308); // Hand size!

      tempContainer.add([backing, tempSprite]);

      this.tweens.add({
        targets: tempContainer,
        x: targetX,
        y: targetY,
        scaleX: 200 / 220, // Scale down to discard size (200x280)
        scaleY: 280 / 308,
        rotation: targetRotation,
        delay: index * 120,
        duration: 450,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          tempContainer.destroy();
          if (index === addedCards.length - 1) {
            this.renderDiscardPileStack(currentDiscardPile);
            this.playDiscardGlowEffect(targetX, targetY);
          }
        }
      });
    });
  }

  private playDiscardGlowEffect(x: number, y: number) {
    const glow = this.add.graphics();
    glow.lineStyle(9, 0xffd700, 0.8);
    glow.strokeRoundedRect(-105, -145, 210, 290, 24);
    glow.x = x;
    glow.y = y;
    glow.setDepth(99);

    this.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        glow.destroy();
      }
    });
  }

  private animateCardDraw(playerId: string, cardType?: string, cardId?: string) {
    const cx = 960;
    const cy = 495;
    const isLocal = playerId === gameManager.socketId;

    if (isLocal && this.skipNextDrawAnimation) {
      this.skipNextDrawAnimation = false;
      return;
    }

    if (isLocal) {
      const deckX = cx - 150;
      const deckY = cy;
      // Entry from bottom-right corner offset (diagonal trajectory from right to left)
      const startX = deckX + 250;

      // Scale paw dynamically so its height is exactly 720px to keep wrist off-screen
      const targetHeight = 720;

      // Start the paw completely off-screen (below 1080)
      const startY = 1080 + targetHeight;

      // Spawn the assigned paw sprite
      const pawSprite = this.add.image(startX, startY, this.assignedPawAssetKey);
      pawSprite.setDepth(110);
      pawSprite.setOrigin(0.5, 1.0); // bottom center (wrist)
      
      const scale = targetHeight / pawSprite.height;
      pawSprite.setScale(scale);

      // Distance from wrist (origin 1.0) to claws grab point (around 0.13 from top) is 0.87 * targetHeight
      const grabDistance = 0.87 * targetHeight;

      // Calculate diagonal angle pointing from start to target, aligned with vertical sprite pointing up
      const angle = Phaser.Math.Angle.Between(startX, startY, deckX, deckY) + Math.PI / 2;
      pawSprite.setRotation(angle);

      // Offset the target position of the wrist (paw center/bottom) so the claws land EXACTLY at deckX, deckY
      const targetX = deckX - Math.sin(angle) * grabDistance;
      const targetY = deckY + Math.cos(angle) * grabDistance;

      this.tweens.add({
        targets: pawSprite,
        x: targetX,
        y: targetY,
        duration: 500, // Snappy yet smooth rise duration
        ease: 'Sine.easeInOut', // Gentler easing curve than Cubic
        onComplete: () => {
          // Swap texture to grabbed paw version when grabbing
          pawSprite.setTexture(`${this.assignedPawAssetKey}_grab`);

          // Paw does a soft, realistic contraction grab (less violent than before)
          this.tweens.add({
            targets: pawSprite,
            scaleX: scale * 1.15,
            scaleY: scale * 1.15,
            duration: 75, // Snappy grab pulse
            yoyo: true,
            repeat: 0,
            onComplete: () => {
              const tempContainer = this.add.container(deckX, deckY);
              tempContainer.setDepth(100);
              tempContainer.setRotation(angle); // Tilt card to match paw angle

              // Create backGroup to hold card back graphics
              const backGroup = this.add.container(0, 0);
              const cbBg = this.add.graphics();
              cbBg.fillStyle(0xffffff, 1);
              cbBg.fillRoundedRect(-100, -140, 200, 280, 24);
              cbBg.lineStyle(1.5, 0x000000, 0.45);
              cbBg.strokeRoundedRect(-100, -140, 200, 280, 24);
              cbBg.fillStyle(0x8b1a28, 1);
              cbBg.fillRoundedRect(-96, -136, 192, 272, 20);

              const cbImg = this.add.image(0, 0, 'CARD_BACK');
              cbImg.setDisplaySize(250, 52.2);
              cbImg.setRotation(Math.PI / 2);
              backGroup.add([cbBg, cbImg]);

              // Create frontGroup to hold front graphics (initially hidden)
              const frontGroup = this.add.container(0, 0);
              const frontBg = this.add.graphics();
              frontBg.fillStyle(0xffffff, 1);
              frontBg.fillRoundedRect(-100, -140, 200, 280, 24);
              frontBg.lineStyle(1.5, 0x000000, 0.45);
              frontBg.strokeRoundedRect(-100, -140, 200, 280, 24);
              
              const frontSprite = this.add.image(0, 0, cardType || 'CARD_BACK');
              frontSprite.setDisplaySize(200, 280);
              frontGroup.add([frontBg, frontSprite]);
              frontGroup.setVisible(false);

              tempContainer.add([backGroup, frontGroup]);

              const targetScaleX = 220 / 200;
              const targetScaleY = 308 / 280;

              // Retract the paw back to the bottom vertically (X stays deckX)
              this.tweens.add({
                targets: pawSprite,
                x: startX,
                y: startY, // Pull completely off-screen Y
                duration: 800, // Faster, elegant retract duration
                ease: 'Sine.easeInOut',
                onUpdate: (tween, target: Phaser.GameObjects.Image) => {
                  if (tempContainer.active) {
                    // Lock position to the projected claws grab point of the paw dynamically
                    tempContainer.x = target.x + Math.sin(angle) * (0.87 * targetHeight);
                    tempContainer.y = target.y - Math.cos(angle) * (0.87 * targetHeight);
                    
                    // Scale the card container as it approaches the hand
                    const progress = tween.progress; // 0 to 1
                    tempContainer.scaleX = 1 + (targetScaleX - 1) * progress;
                    tempContainer.scaleY = 1 + (targetScaleY - 1) * progress;
                  }
                },
                onComplete: () => {
                  pawSprite.destroy();
                  tempContainer.destroy();
                  
                  if (cardId) {
                    const handCard = this.localCards.find(c => c.getData('cardId') === cardId);
                    if (handCard) {
                      handCard.setVisible(true);
                      const originalX = handCard.getData('originalX') ?? handCard.x;
                      const originalY = handCard.getData('originalY') ?? handCard.y;
                      const rotation = handCard.rotation;
                      
                      const offsetDist = 35; // Offset distance along fanned line
                      handCard.x = originalX + Math.sin(rotation) * offsetDist;
                      handCard.y = originalY + Math.cos(rotation) * offsetDist;
                      handCard.setRotation(angle); // start at paw tilt

                      this.tweens.add({
                        targets: handCard,
                        x: originalX,
                        y: originalY,
                        rotation: rotation, // transition into hand fanned rotation
                        duration: 250, // Snappy slide in
                        ease: 'Cubic.easeOut'
                      });
                    }
                    if (this.newlyDrawnCardId === cardId) {
                      this.newlyDrawnCardId = null;
                    }
                  }
                }
              });

              // Card Flip Animation: half-way down the pull
              this.time.delayedCall(150, () => {
                if (tempContainer.active) {
                  this.tweens.add({
                    targets: backGroup,
                    scaleX: 0,
                    duration: 150,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                      backGroup.setVisible(false);
                      frontGroup.setScale(0, 1);
                      frontGroup.setVisible(true);
                      this.tweens.add({
                        targets: frontGroup,
                        scaleX: 1,
                        duration: 150,
                        ease: 'Quad.easeOut'
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
      return;
    }

    let targetX = cx;
    let targetY = cy;

    const oppContainer = this.opponentContainers.get(playerId);
    if (oppContainer) {
      targetX = oppContainer.x;
      targetY = oppContainer.y;
    } else {
      targetX = 960;
      targetY = 150;
    }

    const tempContainer = this.add.container(cx - 150, cy);
    tempContainer.setDepth(90);

    const cbBg = this.add.graphics();
    // White border base
    cbBg.fillStyle(0xffffff, 1);
    cbBg.fillRoundedRect(-100, -140, 200, 280, 24);
    cbBg.lineStyle(1.5, 0x000000, 0.45);
    cbBg.strokeRoundedRect(-100, -140, 200, 280, 24);
    // Red backing inside
    cbBg.fillStyle(0x8b1a28, 1);
    cbBg.fillRoundedRect(-96, -136, 192, 272, 20);

    const cbImg = this.add.image(0, 0, 'CARD_BACK');
    cbImg.setDisplaySize(250, 52.2);
    cbImg.setRotation(Math.PI / 2);

    tempContainer.add([cbBg, cbImg]);

    const targetScaleX = 54 / 200;
    const targetScaleY = 76 / 280;

    this.tweens.add({
      targets: tempContainer,
      x: targetX,
      y: targetY,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      rotation: 15 * Math.PI / 180,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        tempContainer.destroy();
      }
    });
  }

  private playExplosionAnimation(playerId: string) {
    const isLocal = playerId === gameManager.socketId;
    let targetX = 960;
    let targetY = 540;

    if (!isLocal) {
      const oppContainer = this.opponentContainers.get(playerId);
      if (oppContainer) {
        targetX = oppContainer.x;
        targetY = oppContainer.y;
      }
    } else {
      // Local player position (bottom center)
      targetX = 960;
      targetY = 870;
    }

    // Camera shake to feel the blast!
    this.cameras.main.shake(500, 0.015);

    // Spawn a delayed burst of cartoon explosions
    const numSubExplosions = 7;
    for (let i = 0; i < numSubExplosions; i++) {
      this.time.delayedCall(i * 100, () => {
        const texNum = Phaser.Math.Between(1, 7);
        const textureKey = `explosion_${texNum}`;
        
        // Randomized slight offset from player position
        const offsetX = Phaser.Math.Between(-80, 80);
        const offsetY = Phaser.Math.Between(-80, 80);
        
        const explosion = this.add.image(targetX + offsetX, targetY + offsetY, textureKey);
        explosion.setDepth(150); // Above everything
        explosion.setScale(0.05); // Start tiny
        explosion.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
        
        // Scale and rotation speed
        const targetScale = isLocal ? Phaser.Math.FloatBetween(1.0, 1.6) : Phaser.Math.FloatBetween(0.5, 0.9);
        const rotationSpeed = Phaser.Math.FloatBetween(-0.5, 0.5);
        
        this.tweens.add({
          targets: explosion,
          scaleX: targetScale,
          scaleY: targetScale,
          rotation: explosion.rotation + rotationSpeed,
          duration: 350,
          ease: 'Back.easeOut',
          onComplete: () => {
            // Fade out and expand slightly
            this.tweens.add({
              targets: explosion,
              alpha: 0,
              scaleX: targetScale * 1.25,
              scaleY: targetScale * 1.25,
              duration: 250,
              ease: 'Quad.easeOut',
              onComplete: () => {
                explosion.destroy();
              }
            });
          }
        });
      });
    }
  }

  private drawCatFace(graphics: Phaser.GameObjects.Graphics, index: number, isEliminated: boolean) {
    if (index === 0) {
      // ----------------------------------------
      // Index 0: TIGER (Green Gameboy Cat)
      // ----------------------------------------
      const mainColor = isEliminated ? 0x444444 : 0x8ce63f; // Lime green
      
      // Draw Ears
      graphics.fillStyle(mainColor, 1);
      graphics.fillTriangle(-40, -55, -20, -55, -35, -72);
      graphics.fillTriangle(40, -55, 20, -55, 35, -72);
      graphics.lineStyle(4.5, isEliminated ? 0x888888 : 0xffffff, 1);
      graphics.strokeTriangle(-40, -55, -20, -55, -35, -72);
      graphics.strokeTriangle(40, -55, 20, -55, 35, -72);

      // Body (Rounded Rect)
      graphics.fillStyle(mainColor, 1);
      graphics.fillRoundedRect(-50, -55, 100, 110, 18);
      graphics.strokeRoundedRect(-50, -55, 100, 110, 18);

      // Re-fill body center to hide overlapping ear strokes
      graphics.fillStyle(mainColor, 1);
      graphics.fillRoundedRect(-47, -52, 94, 104, 15);

      // Screen Bezel (Dark grey)
      graphics.fillStyle(0x222222, 1);
      graphics.fillRoundedRect(-40, -45, 80, 54, 10);

      // Screen (Light yellow-green)
      graphics.fillStyle(isEliminated ? 0x555555 : 0xa3e635, 1);
      graphics.fillRoundedRect(-34, -39, 68, 42, 6);

      if (isEliminated) {
        // X eyes
        graphics.lineStyle(4, 0x222222, 1);
        graphics.lineBetween(-18, -24, -8, -14);
        graphics.lineBetween(-8, -24, -18, -14);
        graphics.lineBetween(8, -24, 18, -14);
        graphics.lineBetween(18, -24, 8, -14);
      } else {
        // Big cartoon eyes
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(-13, -19, 10);
        graphics.fillCircle(13, -19, 10);

        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(-13, -19, 5);
        graphics.fillCircle(13, -19, 5);
      }

      // Nose & Mouth line
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-2, -11, 4, 3);

      // D-Pad (Black)
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-30, 24, 22, 6);
      graphics.fillRect(-22, 16, 6, 22);

      // Red buttons
      graphics.fillStyle(0xef4444, 1);
      graphics.fillCircle(16, 28, 6);
      graphics.fillCircle(30, 28, 6);

    } else if (index === 1) {
      // ----------------------------------------
      // Index 1: TOM (Purple Curlers Cat)
      // ----------------------------------------
      const mainColor = isEliminated ? 0x444444 : 0xa855f7; // Purple

      // Draw Ears
      graphics.fillStyle(mainColor, 1);
      graphics.fillTriangle(-45, -30, -15, -52, -50, 8);
      graphics.fillTriangle(45, -30, 15, -52, 50, 8);
      graphics.lineStyle(4.5, isEliminated ? 0x888888 : 0xffffff, 1);
      graphics.strokeTriangle(-45, -30, -15, -52, -50, 8);
      graphics.strokeTriangle(45, -30, 15, -52, 50, 8);

      // Body
      graphics.fillStyle(mainColor, 1);
      graphics.fillCircle(0, 5, 55);
      graphics.strokeCircle(0, 5, 55);

      // Re-fill body center
      graphics.fillStyle(mainColor, 1);
      graphics.fillCircle(0, 5, 52.5);

      // Hair Curlers (Cyan circles at the top)
      graphics.fillStyle(isEliminated ? 0x555555 : 0x06b6d4, 1);
      graphics.lineStyle(3, 0x000000, 1);
      
      graphics.fillCircle(-24, -45, 11);
      graphics.strokeCircle(-24, -45, 11);
      
      graphics.fillCircle(0, -52, 11);
      graphics.strokeCircle(0, -52, 11);
      
      graphics.fillCircle(24, -45, 11);
      graphics.strokeCircle(24, -45, 11);

      if (isEliminated) {
        graphics.lineStyle(4, 0xffffff, 1);
        graphics.lineBetween(-22, -2, -10, 10);
        graphics.lineBetween(-10, -2, -22, 10);
        graphics.lineBetween(10, -2, 22, 10);
        graphics.lineBetween(22, -2, 10, 10);
      } else {
        // Cartoon Eyes
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(-16, 4, 11);
        graphics.fillCircle(16, 4, 11);

        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(-16, 4, 5.5);
        graphics.fillCircle(16, 4, 5.5);
      }

      // Nose
      graphics.fillStyle(0xffa5b5, 1);
      graphics.fillTriangle(-5, 16, 5, 16, 0, 21);

    } else if (index === 2) {
      // ----------------------------------------
      // Index 2: LUNA (Dog Hood Cat)
      // ----------------------------------------
      const mainColor = isEliminated ? 0x444444 : 0xd97706; // Brown hood
      const innerColor = isEliminated ? 0x555555 : 0xfef3c7; // Lighter beige face

      // Floppy Dog Ears (hanging down on the sides)
      graphics.fillStyle(mainColor, 1);
      graphics.lineStyle(4.5, isEliminated ? 0x888888 : 0xffffff, 1);
      
      graphics.fillRoundedRect(-66, -15, 20, 50, 10);
      graphics.strokeRoundedRect(-66, -15, 20, 50, 10);
      
      graphics.fillRoundedRect(46, -15, 20, 50, 10);
      graphics.strokeRoundedRect(46, -15, 20, 50, 10);

      // Main Hood Body
      graphics.fillStyle(mainColor, 1);
      graphics.fillCircle(0, 0, 55);
      graphics.strokeCircle(0, 0, 55);

      // Re-fill to clear ear lines
      graphics.fillStyle(mainColor, 1);
      graphics.fillCircle(0, 0, 52.5);

      // Inner Face Area
      graphics.fillStyle(innerColor, 1);
      graphics.fillCircle(0, 6, 38);
      graphics.lineStyle(3, 0x000000, 0.4);
      graphics.strokeCircle(0, 6, 38);

      if (isEliminated) {
        graphics.lineStyle(4, 0x222222, 1);
        graphics.lineBetween(-18, -2, -8, 8);
        graphics.lineBetween(-8, -2, -18, 8);
        graphics.lineBetween(8, -2, 18, 8);
        graphics.lineBetween(18, -2, 8, 8);
      } else {
        // Eyes
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(-13, 3, 5);
        graphics.fillCircle(13, 3, 5);
      }

      // Nose
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(0, 12, 4);

    } else {
      // ----------------------------------------
      // Index 3 or default: HOLA_KITTEN (Red Potato Chips Bag Cat)
      // ----------------------------------------
      const mainColor = isEliminated ? 0x444444 : 0xef4444; // Red

      // Main Bag Body (Rounded Rect)
      graphics.fillStyle(mainColor, 1);
      graphics.lineStyle(4.5, isEliminated ? 0x888888 : 0xffffff, 1);
      graphics.fillRoundedRect(-48, -50, 96, 100, 14);
      graphics.strokeRoundedRect(-48, -50, 96, 100, 14);

      // Re-fill body center
      graphics.fillStyle(mainColor, 1);
      graphics.fillRoundedRect(-45, -47, 90, 94, 12);

      // Crimped bag seals (crimped stripes) at top and bottom
      graphics.fillStyle(isEliminated ? 0x333333 : 0x991b1b, 1);
      graphics.fillRect(-48, -50, 96, 10);
      graphics.fillRect(-48, 40, 96, 10);

      // Yellow/Orange chips graphics on bag
      graphics.fillStyle(0xf59e0b, 1);
      graphics.fillRoundedRect(-18, 14, 36, 18, 6);

      if (isEliminated) {
        graphics.lineStyle(4, 0xffffff, 1);
        graphics.lineBetween(-20, -12, -8, 0);
        graphics.lineBetween(-8, -12, -20, 0);
        graphics.lineBetween(8, -12, 20, 0);
        graphics.lineBetween(20, -12, 8, 0);
      } else {
        // Eyes
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(-14, -6, 10);
        graphics.fillCircle(14, -6, 10);

        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(-14, -6, 5);
        graphics.fillCircle(14, -6, 5);
      }

      // Nose
      graphics.fillStyle(0xffa5b5, 1);
      graphics.fillTriangle(-4, 4, 4, 4, 0, 8);
    }
  }

  private onGiveCardLocal(data: { requesterId: string; cardId: string; container?: Phaser.GameObjects.Container }) {
    if (this.isFavorAnimationRunning) return;
    this.isFavorAnimationRunning = true;

    // Find the container if not passed
    let cardContainer = data.container;
    if (!cardContainer) {
      cardContainer = this.localCards.find(c => c.getData('cardId') === data.cardId);
      if (cardContainer) {
        // Remove from localCards so it's not destroyed by updates
        this.localCards = this.localCards.filter(c => c !== cardContainer);
      }
    }

    if (!cardContainer) {
      this.isFavorAnimationRunning = false;
      gameManager.sendAction({ type: 'GIVE_CARD', requesterId: data.requesterId, cardId: data.cardId });
      return;
    }

    this.children.bringToTop(cardContainer);

    const destX = this.favorPawSprite ? this.favorPawSprite.x : 960;
    const destY = this.favorPawSprite ? this.favorPawSprite.y : 620;

    this.tweens.add({
      targets: cardContainer,
      x: destX,
      y: destY,
      scaleX: 0.3,
      scaleY: 0.3,
      rotation: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        cardContainer?.destroy();
        
        let startX = 960;
        let startY = 190;
        const oppContainer = this.opponentContainers.get(data.requesterId);
        if (oppContainer) {
          startX = oppContainer.x;
          startY = oppContainer.y;
        }

        if (this.favorPawSprite) {
          const currentTextureKey = this.favorPawSprite.texture.key;
          if (currentTextureKey && !currentTextureKey.endsWith('_grab')) {
            this.favorPawSprite.setTexture(`${currentTextureKey}_grab`);
          }

          this.tweens.add({
            targets: this.favorPawSprite,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 150,
            yoyo: true,
            repeat: 0,
            onComplete: () => {
              if (this.favorPawSprite) {
                this.tweens.add({
                  targets: this.favorPawSprite,
                  x: startX,
                  y: startY,
                  scaleX: 0.4,
                  scaleY: 0.4,
                  duration: 450,
                  ease: 'Back.easeIn',
                  onComplete: () => {
                    this.favorPawSprite?.destroy();
                    this.favorPawSprite = null;
                    this.isFavorAnimationRunning = false;
                    gameManager.sendAction({ type: 'GIVE_CARD', requesterId: data.requesterId, cardId: data.cardId });
                  }
                });
              } else {
                this.isFavorAnimationRunning = false;
                gameManager.sendAction({ type: 'GIVE_CARD', requesterId: data.requesterId, cardId: data.cardId });
              }
            }
          });
        } else {
          this.isFavorAnimationRunning = false;
          gameManager.sendAction({ type: 'GIVE_CARD', requesterId: data.requesterId, cardId: data.cardId });
        }
      }
    });
  }
}
