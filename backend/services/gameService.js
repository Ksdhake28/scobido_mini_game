// services/gameService.js
const WORDS = ['apple', 'cat', 'guitar', 'ocean', 'mountain', 'robot', 'pizza', 'dragon', 'telephone', 'bicycle', 'sunflower', 'castle', 'spaceship', 'dinosaur', 'wizard', 'penguin', 'telescope'];

export class GameService {
  constructor(redisService, io) {
    this.redisService = redisService;
    this.io = io;
    this.timers = {}; // Store timer intervals
    this.expireTimers = {}; // Store room expiration timers
  }

  getRandomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  async startRound(roomId) {
    const players = await this.redisService.getPlayers(roomId);
    if (players.length < 2) {
      this.io.to(roomId).emit('chat_message', { system: true, message: 'Game stopped. Need at least 2 players.' });
      return;
    }

    let roomData = await this.redisService.getRoom(roomId);
    
    // Automatically clear the canvas at the start of a round
    this.io.to(roomId).emit('clear_canvas');

    let turnCount = roomData.turnCount ? parseInt(roomData.turnCount) : 0;
    let numRounds = roomData.rounds ? parseInt(roomData.rounds) : 3;
    let timePerRound = roomData.time ? parseInt(roomData.time) : 60;
    
    // Check if the game is over (all rounds completed)
    if (turnCount >= players.length * numRounds) {
      this.io.to(roomId).emit('game_over');
      this.io.to(roomId).emit('chat_message', { system: true, message: 'Game Over! The final leaderboard is ready.' });
      await this.broadcastLeaderboard(roomId);
      
      await this.redisService.setRoomField(roomId, 'turnCount', '0');
      await this.redisService.setRoomField(roomId, 'status', 'game_over');
      await this.redisService.setRoomField(roomId, 'drawerIndex', '-1');
      await this.redisService.setRoomField(roomId, 'currentWord', '');

      // Set expiration timer (e.g. 120 seconds)
      this.startRoomExpireTimer(roomId, 120);
      return;
    }

    // Pick a new drawer
    let previousDrawerIndex = roomData.drawerIndex ? parseInt(roomData.drawerIndex) : -1;
    let newDrawerIndex = (previousDrawerIndex + 1) % players.length;
    let newDrawer = players[newDrawerIndex];

    await this.redisService.setRoomField(roomId, 'turnCount', (turnCount + 1).toString());
    await this.redisService.setRoomField(roomId, 'drawerIndex', newDrawerIndex.toString());

    const currentWord = this.getRandomWord();

    await this.redisService.setRoomField(roomId, 'currentWord', currentWord);
    await this.redisService.setRoomField(roomId, 'drawerSocketId', newDrawer.socketId);

    // Notify users
    this.io.to(roomId).emit('round_start', {
      drawerId: newDrawer.socketId,
      drawerName: newDrawer.username,
      currentRound: Math.floor(turnCount / players.length) + 1,
      totalRounds: numRounds
    });
    
    // Only tell the drawer what the word is
    this.io.to(newDrawer.socketId).emit('your_word', currentWord);

    this.startTimer(roomId, timePerRound);
  }

  startTimer(roomId, duration) {
    if (this.timers[roomId]) {
      clearInterval(this.timers[roomId]);
    }

    let timeLeft = duration;
    this.timers[roomId] = setInterval(async () => {
      timeLeft -= 1;
      this.io.to(roomId).emit('timer', timeLeft);

      if (timeLeft <= 0) {
        // Time's up!
        clearInterval(this.timers[roomId]);
        this.timers[roomId] = null;
        
        const roomData = await this.redisService.getRoom(roomId);
        this.io.to(roomId).emit('round_end', { reason: 'time_up', word: roomData.currentWord });
        this.io.to(roomId).emit('chat_message', { system: true, message: `Time's up! The word was: ${roomData.currentWord}` });

        // Wait a few seconds then start next round
        setTimeout(() => this.startRound(roomId), 5000);
      }
    }, 1000);
  }

  async handleCorrectGuess(roomId, socketId) {
    const roomData = await this.redisService.getRoom(roomId);
    const drawerId = roomData.drawerSocketId;

    if (socketId === drawerId) return; // Drawer can't guess!

    // Give points
    const players = await this.redisService.getPlayers(roomId);
    const guesser = players.find(p => p.socketId === socketId);
    const drawer = players.find(p => p.socketId === drawerId);

    if (guesser) {
      await this.redisService.updateScore(roomId, guesser.username, 100);
    }
    if (drawer) {
      await this.redisService.updateScore(roomId, drawer.username, 50);
    }

    // Notify correct guess
    this.io.to(roomId).emit('chat_message', { system: true, message: `${guesser.username} guessed the word!` });
    
    // Broadcast updated leaderboard
    await this.broadcastLeaderboard(roomId);

    // End round early
    if (this.timers[roomId]) {
      clearInterval(this.timers[roomId]);
      this.timers[roomId] = null;
    }

    this.io.to(roomId).emit('round_end', { reason: 'guessed', word: roomData.currentWord });
    
    // Start next round in 5 seconds
    setTimeout(() => this.startRound(roomId), 5000);
  }

  async broadcastLeaderboard(roomId) {
    const leaderboard = await this.redisService.getLeaderboard(roomId);
    const players = await this.redisService.getPlayers(roomId);
    this.io.to(roomId).emit('leaderboard_update', { leaderboard, players });
  }
  
  clearRoom(roomId) {
     if(this.timers[roomId]) {
         clearInterval(this.timers[roomId]);
     }
     if(this.expireTimers[roomId]) {
         clearInterval(this.expireTimers[roomId]);
     }
  }

  startRoomExpireTimer(roomId, duration) {
     if (this.expireTimers[roomId]) {
       clearInterval(this.expireTimers[roomId]);
     }
     
     let timeLeft = duration;
     this.expireTimers[roomId] = setInterval(async () => {
        timeLeft -= 1;
        this.io.to(roomId).emit('room_expire_timer', timeLeft);

        if (timeLeft <= 0) {
           clearInterval(this.expireTimers[roomId]);
           this.expireTimers[roomId] = null;
           this.io.to(roomId).emit('room_expired');
           
           // Cleanup redis data
           await this.redisService.redis.del(`room:${roomId}`);
           await this.redisService.redis.del(`room:${roomId}:players`);
           await this.redisService.redis.del(`room:${roomId}:leaderboard`);
        }
     }, 1000);
  }
}
