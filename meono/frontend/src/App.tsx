import { useGameState } from './hooks/useGameState';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import './index.css';

function App() {
  const { gameState, joinMatch, sendAction, socketId } = useGameState();

  if (!gameState || gameState.status === 'LOBBY' || !socketId) {
    return <Lobby onJoin={joinMatch} />;
  }

  return (
    <GameBoard 
      gameState={gameState} 
      socketId={socketId} 
      onAction={sendAction} 
    />
  );
}

export default App;
