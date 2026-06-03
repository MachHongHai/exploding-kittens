import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { GameState, PlayerAction } from '../../../shared/src/types';

const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : ''; // Rỗng nghĩa là kết nối về cùng một origin chứa frontend

export function useGameState() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('match_state_update', (state: GameState) => {
      setGameState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinMatch = (name: string, difficulty: 'HARD' | 'PLAY_WITH_GEMINI', botCount: number, deckType: 'ORIGINAL' | 'IMPLODING_KITTENS' = 'ORIGINAL') => {
    if (socket) {
      setPlayerName(name);
      socket.emit('join_match', { name, difficulty, botCount, deckType });
    }
  };

  const sendAction = (action: PlayerAction, callback?: (res: any) => void) => {
    if (socket) {
      socket.emit('player_action', action, callback);
    }
  };

  return {
    gameState,
    playerName,
    joinMatch,
    sendAction,
    socketId: socket?.id
  };
}
