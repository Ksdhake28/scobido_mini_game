// sockets/index.js
import { RedisService } from '../services/redisService.js';
import { GameService } from '../services/gameService.js';

export default function registerSocketHandlers(io, { redisClient, pubClient, subClient }) {
  const redisService = new RedisService(redisClient, pubClient, subClient);
  const gameService = new GameService(redisService, io);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', async ({ roomId, username }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;

      // Ensure room exists
      let room = await redisService.getRoom(roomId);
      if (!room || Object.keys(room).length === 0) {
        await redisService.createRoom(roomId, { status: 'waiting', currentWord: '' });
        
        // Subscribe to pub/sub channels for this room (useful for horizontal scaling)
        redisService.subscribe(`room:${roomId}:draw`, (drawData) => {
          // If we had multiple servers, we'd emit to our local clients. 
          // Since we use Socket.io, we can also use adapters.
          // But as requested, we demonstrate Redis Pub/Sub directly
          io.to(roomId).emit('draw_stroke', drawData);  
        });
        
        redisService.subscribe(`room:${roomId}:chat`, (chatMsg) => {
           io.to(roomId).emit('chat_message', chatMsg);
        })
      }

      await redisService.addPlayer(roomId, socket.id, username);

      io.to(roomId).emit('chat_message', { system: true, message: `${username} joined the room.` });
      
      await gameService.broadcastLeaderboard(roomId);

      const players = await redisService.getPlayers(roomId);
      if (players.length >= 2 && room?.status !== 'playing') {
        gameService.startRound(roomId);
      }
    });

    socket.on('draw', async (drawData) => {
       const roomId = socket.roomId;
       if (!roomId) return;
       
       // Publish the stroke to Redis
       await redisService.publish(`room:${roomId}:draw`, drawData);
    });
    
    socket.on('clear_canvas', () => {
       if(!socket.roomId) return;
       io.to(socket.roomId).emit('clear_canvas');
    });

    socket.on('send_message', async (message) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      const roomData = await redisService.getRoom(roomId);
      
      // Basic cheat block (drawer can't say the word)
      if (socket.id === roomData.drawerSocketId && message.toLowerCase().includes(roomData.currentWord)) {
          socket.emit('chat_message', { system: true, message: "You cannot say the word!" });
          return;
      }

      if (roomData.status === 'playing' && socket.id !== roomData.drawerSocketId) {
        if (message.toLowerCase() === roomData.currentWord.toLowerCase()) {
          await gameService.handleCorrectGuess(roomId, socket.id);
          return;
        }
      }

      // Publish chat to redis
      await redisService.publish(`room:${roomId}:chat`, {
        username: socket.username,
        message: message,
        system: false
      });
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.roomId) {
        const removedPlayer = await redisService.removePlayer(socket.roomId, socket.id);
        if (removedPlayer) {
            io.to(socket.roomId).emit('chat_message', { system: true, message: `${removedPlayer.username} left the room.` });
            await gameService.broadcastLeaderboard(socket.roomId);
            
            // Check if game should stop
            const players = await redisService.getPlayers(socket.roomId);
            if (players.length < 2) {
               gameService.clearRoom(socket.roomId);
               redisService.setRoomField(socket.roomId, 'status', 'waiting');
               io.to(socket.roomId).emit('chat_message', { system: true, message: 'Game paused. Waiting for players.' });
            }
        }
      }
    });
  });
}
