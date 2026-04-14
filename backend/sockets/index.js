import { RedisService } from '../services/redisService.js';
import { GameService } from '../services/gameService.js';

const subscribedRooms = new Set();

const subscribeToRoom = (redisService, io, roomId) => {
  if (!subscribedRooms.has(roomId)) {
    subscribedRooms.add(roomId);
    redisService.subscribe(`room:${roomId}:draw`, (drawData) => {
      io.to(roomId).emit('draw_stroke', drawData);  
    });
    redisService.subscribe(`room:${roomId}:chat`, (chatMsg) => {
      io.to(roomId).emit('chat_message', chatMsg);
    });
  }
};

export default function registerSocketHandlers(io, { redisClient, pubClient, subClient }) {
  const redisService = new RedisService(redisClient, pubClient, subClient);
  const gameService = new GameService(redisService, io);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create_room', async ({ roomId, username, settings }) => {
      try {
          let room = await redisService.getRoom(roomId);
          if (room && Object.keys(room).length > 0) {
             return socket.emit('error', 'Room already exists.');
          }
          
          await redisService.createRoom(roomId, { 
             status: 'waiting', 
             currentWord: '',
             adminSocketId: socket.id,
             maxPlayers: settings.maxPlayers.toString(),
             time: settings.time.toString(),
             rounds: settings.rounds.toString()
          });

          socket.join(roomId);
          socket.roomId = roomId;
          socket.username = username;

          subscribeToRoom(redisService, io, roomId);
          await redisService.addPlayer(roomId, socket.id, username);
          
          socket.emit('room_joined', { roomId, isAdmin: true, status: 'waiting' });
          io.to(roomId).emit('chat_message', { system: true, message: `${username} created the room.` });
          await gameService.broadcastLeaderboard(roomId);
      } catch (err) {
          console.error(err);
          socket.emit('error', 'Failed to create room.');
      }
    });

    socket.on('join_room', async ({ roomId, username }) => {
      try {
          let room = await redisService.getRoom(roomId);
          if (!room || Object.keys(room).length === 0) {
             return socket.emit('error', 'Room not found.');
          }

          const players = await redisService.getPlayers(roomId);
          const maxPlayers = parseInt(room.maxPlayers || '10');
          if (players.length >= maxPlayers) {
             return socket.emit('error', 'Room is full.');
          }

          // Check if username already exists
          if (players.find(p => p.username === username)) {
             return socket.emit('error', 'Username is already taken in this room.');
          }

          socket.join(roomId);
          socket.roomId = roomId;
          socket.username = username;

          subscribeToRoom(redisService, io, roomId);
          await redisService.addPlayer(roomId, socket.id, username);

          socket.emit('room_joined', { roomId, isAdmin: false, status: room.status });
          io.to(roomId).emit('chat_message', { system: true, message: `${username} joined the room.` });
          await gameService.broadcastLeaderboard(roomId);

          if (room.status === 'playing') {
             // Let the joining player know the game is running without giving away word unless drawer
             socket.emit('game_started');
          } else if (players.length + 1 >= maxPlayers) {
             io.to(roomId).emit('chat_message', { system: true, message: 'Room is full! Admin can start the game.' });
          }
      } catch (err) {
          console.error(err);
          socket.emit('error', 'Failed to join room.');
      }
    });

    socket.on('start_game', async (roomId) => {
       try {
           if (socket.roomId !== roomId) return;
           let room = await redisService.getRoom(roomId);
           if (room.adminSocketId !== socket.id) {
              return socket.emit('error', 'Only admin can start the game.');
           }
           if (room.status === 'playing') {
              return socket.emit('error', 'Game has already started.');
           }
           const players = await redisService.getPlayers(roomId);
           if (players.length < 2) {
              return socket.emit('error', 'Need at least 2 players to start.');
           }
           io.to(roomId).emit('game_started');
           await redisService.setRoomField(roomId, 'status', 'playing');
           gameService.startRound(roomId);
       } catch (err) {
           console.error(err);
       }
    });

    socket.on('draw', async (drawData) => {
       try {
           if (!socket.roomId) return;
           await redisService.publish(`room:${socket.roomId}:draw`, drawData);
       } catch (err) {}
    });
    
    socket.on('clear_canvas', () => {
       if(!socket.roomId) return;
       io.to(socket.roomId).emit('clear_canvas');
    });

    socket.on('send_message', async (message) => {
      try {
          const roomId = socket.roomId;
          if (!roomId) return;

          const roomData = await redisService.getRoom(roomId);
          
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

          await redisService.publish(`room:${roomId}:chat`, {
            username: socket.username,
            message: message,
            system: false
          });
      } catch(err) {
          console.error(err);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      try {
          if (socket.roomId) {
            const removedPlayer = await redisService.removePlayer(socket.roomId, socket.id);
            if (removedPlayer) {
                io.to(socket.roomId).emit('chat_message', { system: true, message: `${removedPlayer.username} left the room.` });
                await gameService.broadcastLeaderboard(socket.roomId);
                
                const players = await redisService.getPlayers(socket.roomId);
                const room = await redisService.getRoom(socket.roomId);

                if (players.length < 2 && room.status === 'playing') {
                   gameService.clearRoom(socket.roomId);
                   redisService.setRoomField(socket.roomId, 'status', 'waiting');
                   io.to(socket.roomId).emit('chat_message', { system: true, message: 'Game paused. Not enough players.' });
                } else if (players.length === 0) {
                   gameService.clearRoom(socket.roomId);
                   redisService.redis.del(`room:${socket.roomId}`);
                   redisService.redis.del(`room:${socket.roomId}:players`);
                   redisService.redis.del(`room:${socket.roomId}:leaderboard`);
                }
            }
          }
      } catch(err) {
          console.error(err);
      }
    });
  });
}
