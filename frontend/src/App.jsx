import { useState, useEffect } from 'react';
import { useSocket } from './context/SocketContext';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const socket = useSocket();
  const [joined, setJoined] = useState(false);
  const [mode, setMode] = useState('join'); // 'join' | 'create'
  
  const [username, setUsername] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [time, setTime] = useState(60);
  const [rounds, setRounds] = useState(3);

  const [isAdmin, setIsAdmin] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting'); // 'waiting' | 'playing' | 'game_over'
  
  const [drawerId, setDrawerId] = useState(null);
  const [wordToDraw, setWordToDraw] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(1);
  const [expirationTimer, setExpirationTimer] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('room_joined', ({ roomId: joinedRoomId, isAdmin, status }) => {
       setJoined(true);
       setRoomId(joinedRoomId);
       setIsAdmin(isAdmin);
       setGameStatus(status);
    });

    socket.on('error', (msg) => {
       alert(msg);
    });

    socket.on('game_started', () => {
       setGameStatus('playing');
    });

    socket.on('round_start', ({ drawerId, currentRound, totalRounds }) => {
      setDrawerId(drawerId);
      setWordToDraw(null);
      if (currentRound) setCurrentRound(currentRound);
      if (totalRounds) setTotalRounds(totalRounds);
      setGameStatus('playing');
    });

    socket.on('your_word', (word) => {
      setWordToDraw(word);
    });

    socket.on('game_over', () => {
      setGameStatus('game_over');
      setDrawerId(null);
      setWordToDraw(null);
    });

    socket.on('leaderboard_update', ({ leaderboard }) => {
      setLeaderboard(leaderboard);
    });

    socket.on('room_expire_timer', (timeLeft) => {
      setExpirationTimer(timeLeft);
    });
    
    socket.on('room_expired', () => {
       alert("Room has expired.");
       window.location.reload();
    });

    return () => {
      socket.off('room_joined');
      socket.off('error');
      socket.off('game_started');
      socket.off('round_start');
      socket.off('your_word');
      socket.off('game_over');
      socket.off('leaderboard_update');
      socket.off('room_expire_timer');
      socket.off('room_expired');
    };
  }, [socket]);

  const handleJoinOrCreate = (e) => {
    e.preventDefault();
    if (!username) return alert("Please enter a username.");
    if (!inputRoomId && mode === 'join') return alert("Please enter a room ID.");

    if (mode === 'create') {
       socket.emit('create_room', { 
         username, 
         roomId: inputRoomId || Math.random().toString(36).substring(2, 8), 
         settings: { maxPlayers: parseInt(maxPlayers), time: parseInt(time), rounds: parseInt(rounds) } 
       });
    } else {
       socket.emit('join_room', { roomId: inputRoomId, username });
    }
  };

  const handleStartGame = () => {
    socket.emit('start_game', roomId);
  };

  if (!socket) return <div className="loading">Connecting to server...</div>;

  if (!joined) {
    return (
      <div className="join-container">
        <form className="join-form" onSubmit={handleJoinOrCreate}>
          <h1>Scobido</h1>
          <div className="tab-buttons" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
             <button type="button" onClick={() => setMode('join')} className={mode === 'join' ? 'active' : ''}>Join Room</button>
             <button type="button" onClick={() => setMode('create')} className={mode === 'create' ? 'active' : ''}>Create Room</button>
          </div>

          <input
            type="text"
            placeholder="Display Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder={mode === 'create' ? "Room ID (Optional)" : "Room ID"}
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
            required={mode === 'join'}
          />

          {mode === 'create' && (
            <div className="settings-panel" style={{ display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'left', marginBottom: '20px' }}>
               <label>Max Players (2-10):</label>
               <input type="number" min="2" max="10" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={{ padding: '8px' }} />
               
               <label>Game Time (seconds):</label>
               <select value={time} onChange={e => setTime(e.target.value)} style={{ padding: '8px' }}>
                 <option value="30">30s</option>
                 <option value="45">45s</option>
                 <option value="60">60s</option>
                 <option value="90">90s</option>
                 <option value="120">120s</option>
               </select>

               <label>Rounds:</label>
               <select value={rounds} onChange={e => setRounds(e.target.value)} style={{ padding: '8px' }}>
                  {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} rounds</option>)}
               </select>
            </div>
          )}

          <button type="submit">{mode === 'create' ? 'Create Game' : 'Join Game'}</button>
        </form>
      </div>
    );
  }

  if (gameStatus === 'waiting') {
    return (
       <div className="game-container game-over-screen" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="final-leaderboard" style={{ background: 'white', padding: '2rem', borderRadius: '12px', minWidth: '400px', textAlign: 'center' }}>
            <h1>Room: {roomId}</h1>
            <h2 style={{ marginBottom: '1rem', color: '#7f8c8d' }}>Waiting for players...</h2>
            
            <div style={{ textAlign: 'left', background: '#ecf0f1', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
               <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Players Joined ({leaderboard.length}/{maxPlayers})</h3>
               <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                 {leaderboard.map((p, i) => (
                   <li key={i} style={{ fontSize: '1.2rem', padding: '5px 0', color: '#2c3e50', fontWeight: 'bold' }}>{p.value}</li>
                 ))}
               </ul>
            </div>

            {isAdmin ? (
               <button onClick={handleStartGame} style={{ marginTop: '10px', padding: '12px 25px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer', width: '100%' }}>Start Game</button>
            ) : (
               <p style={{ marginTop: '10px', fontSize: '18px', color: '#7f8c8d' }}>Waiting for admin to start the game.</p>
            )}
          </div>
       </div>
    );
  }

  if (gameStatus === 'game_over') {
    return (
      <div className="game-container game-over-screen" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="final-leaderboard" style={{ background: 'white', padding: '2rem', borderRadius: '12px', minWidth: '400px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h1 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Game Over!</h1>
          <h2 style={{ color: '#34495e', marginBottom: '1rem' }}>Final Leaderboard</h2>
          {expirationTimer !== null && (
             <h3 style={{ color: '#e74c3c', marginBottom: '2rem' }}>Room expires in: {expirationTimer}s</h3>
          )}
          <div className="players-list-final" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.map((pd, index) => (
               <div key={index} className="player-card" style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '15px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                 <span className="rank" style={{ color: '#7f8c8d' }}>#{index + 1}</span>
                 <span className="player-name" style={{ color: '#2980b9' }}>{pd.value}</span>
                 <span className="player-score" style={{ color: '#27ae60' }}>{pd.score} pts</span>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header" style={{ position: 'relative' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2>Room: {roomId}</h2>
           <span style={{ fontSize: '1rem', color: '#ccc' }}>Round {currentRound} of {totalRounds}</span>
         </div>
         {drawerId === socket.id ? (
           <h2 className="word-display" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Word to draw: <span className="highlight-word">{wordToDraw}</span></h2>
         ) : (
           <h2 className="word-display" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Guess the word!</h2>
         )}
         <div style={{ minWidth: '100px' }}></div> {/* Spacer to keep layout balanced */}
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
