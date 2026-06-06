import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from '../game/config';
import { gameManager } from '../game/GameManager';
import type { GameState, PlayerAction } from '../../../shared/src/types';

interface GameCanvasProps {
  gameState: GameState;
  socketId: string;
  onAction: (action: PlayerAction) => void;
  onSelectionChange: (selectedIds: string[]) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  socketId, 
  onAction, 
  onSelectionChange 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Keep references to latest callbacks to avoid triggering useEffect re-instantiation
  const onActionRef = useRef(onAction);
  const onSelectionChangeRef = useRef(onSelectionChange);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // Handle socketId updates without recreating the game
  useEffect(() => {
    gameManager.setSocketId(socketId);
  }, [socketId]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Phaser game exactly once
    const config = getGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Setup action listener from Phaser using refs
    const handlePlayerAction = (action: PlayerAction) => {
      onActionRef.current(action);
    };

    // Setup selection listener from Phaser using refs
    const handleSelectionChange = (selectedIds: string[]) => {
      onSelectionChangeRef.current(selectedIds);
    };

    gameManager.on('player_action', handlePlayerAction);
    gameManager.on('card_selection_changed', handleSelectionChange);

    return () => {
      gameManager.off('player_action', handlePlayerAction);
      gameManager.off('card_selection_changed', handleSelectionChange);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []); // Run ONLY once on mount

  // Sync state changes from React into Phaser
  useEffect(() => {
    if (gameState) {
      gameManager.updateState(gameState);
    }
  }, [gameState]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative z-10"
    />
  );
};
