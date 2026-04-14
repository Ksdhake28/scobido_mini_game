import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const socket = useSocket();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('chat_message');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      socket.emit('send_message', inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.system ? 'system-message' : ''}`}>
             {msg.system ? (
                <strong>{msg.message}</strong>
             ) : (
                <><strong>{msg.username}:</strong> {msg.message}</>
             )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Guess the word..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;
