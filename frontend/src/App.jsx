import { useState, useEffect } from 'react';
import { useSocket } from './context/SocketContext';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const socket = useSocket();
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');

  const [drawerId, setDrawerId] = useState(null);
  const [wordToDraw, setWordToDraw] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('round_start', ({ drawerId }) => {
      setDrawerId(drawerId);
      setWordToDraw(null); // Clear previous word immediately on round start
    });

    socket.on('your_word', (word) => {
      setWordToDraw(word);
    });

    return () => {
      socket.off('round_start');
      socket.off('your_word');
    };
  }, [socket]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username && roomId) {
      socket.emit('join_room', { roomId, username });
      setJoined(true);
    }
  };

  if (!socket) return <div className="loading">Connecting to server...</div>;

  if (!joined) {
    return (
      <div className="join-container">
        <form className="join-form" onSubmit={handleJoin}>
          <h1>Skribbl Clone</h1>
          <input
            type="text"
            placeholder="Display Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
          <button type="submit">Join Game</button>
        </form>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
         <h2>Room: {roomId}</h2>
         {drawerId === socket.id ? (
           <h2 className="word-display">Word to draw: <span className="highlight-word">{wordToDraw}</span></h2>
         ) : (
           <h2 className="word-display">Guess the word!</h2>
         )}
      </div>
      <div className="game-content">
        <Sidebar currentSocketId={socket.id} />
        <Canvas drawerId={drawerId} />
        <Chat />
      </div>
    </div>
  );
}

export default App;
