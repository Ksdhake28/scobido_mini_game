import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const Sidebar = ({ currentSocketId, leaderboard = [], players = [] }) => {
  const socket = useSocket();
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.on('timer', (time) => {
      setTimer(time);
    });

    return () => {
      socket.off('timer');
    };
  }, [socket]);

  return (
    <div className="sidebar">
      <div className="timer-box">
        <h3>Time Left: <span className={timer <= 10 && timer !== 0 ? 'time-low' : ''}>{timer}s</span></h3>
      </div>
      <div className="players-list">
        <h3>Leaderboard</h3>
        {leaderboard.map((pd, index) => {
           // Find the player object matching username
           const playerMatch = players.find(p => p.username === pd.value);
           const isMe = playerMatch ? playerMatch.socketId === currentSocketId : false;

           return (
             <div key={index} className={`player-card ${isMe ? 'is-me' : ''}`}>
               <span className="rank">#{index + 1}</span>
               <span className="player-name">{pd.value}</span>
               <span className="player-score">{pd.score} pts</span>
             </div>
           );
        })}
        {leaderboard.length === 0 && <p className="waiting">Waiting for players...</p>}
      </div>
    </div>
  );
};

export default Sidebar;
