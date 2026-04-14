// services/redisService.js

export class RedisService {
  constructor(redisClient, pubClient, subClient) {
    this.redis = redisClient;
    this.pub = pubClient;
    this.sub = subClient;
  }

  /* Room Management */
  async createRoom(roomId, roomData) {
    await this.redis.hSet(`room:${roomId}`, roomData);
  }

  async getRoom(roomId) {
    return await this.redis.hGetAll(`room:${roomId}`);
  }

  async setRoomField(roomId, field, value) {
    await this.redis.hSet(`room:${roomId}`, field, value);
  }

  /* Player Management */
  async addPlayer(roomId, socketId, username) {
    const playerStr = JSON.stringify({ socketId, username, score: 0 });
    await this.redis.hSet(`room:${roomId}:players`, socketId, playerStr);
    
    // Add to sorted set for leaderboard (Initial score 0)
    await this.redis.zAdd(`room:${roomId}:leaderboard`, [{ score: 0, value: username }]);
  }

  async getPlayers(roomId) {
    const playersMap = await this.redis.hGetAll(`room:${roomId}:players`);
    return Object.values(playersMap).map(p => JSON.parse(p));
  }

  async removePlayer(roomId, socketId) {
    const playerRaw = await this.redis.hGet(`room:${roomId}:players`, socketId);
    if (!playerRaw) return null;
    const player = JSON.parse(playerRaw);

    await this.redis.hDel(`room:${roomId}:players`, socketId);
    await this.redis.zRem(`room:${roomId}:leaderboard`, player.username);
    
    return player;
  }

  /* Scoring & Leaderboard (Redis Sorted Sets) */
  async updateScore(roomId, username, points) {
    // Increment the score in the sorted set
    const newScore = await this.redis.zIncrBy(`room:${roomId}:leaderboard`, points, username);
    
    // Also update the player object in the hash
    const players = await this.getPlayers(roomId);
    const p = players.find(p => p.username === username);
    if (p) {
      p.score = newScore;
      await this.redis.hSet(`room:${roomId}:players`, p.socketId, JSON.stringify(p));
    }
  }

  async getLeaderboard(roomId) {
    // Get top players, ascending order from Redis 5 compatible command, then reverse
    const leaderboard = await this.redis.zRangeWithScores(`room:${roomId}:leaderboard`, 0, -1);
    return leaderboard.reverse();
  }

  /* Pub/Sub */
  async publish(channel, message) {
    await this.pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel, callback) {
    await this.sub.subscribe(channel, (message) => {
      callback(JSON.parse(message));
    });
  }
  
  async unsubscribe(channel) {
    await this.sub.unsubscribe(channel);
  }
}
