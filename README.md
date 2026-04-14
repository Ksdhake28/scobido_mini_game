# Skribbl.io Clone - Distributed Real-time Web App

A full-stack distributed real-time multiplayer drawing and guessing game built with React, Node.js, Socket.IO, and Redis.

## Features
- Scalable real-time synchronization using Socket.IO and Redis Pub/Sub.
- Collaborative HTML5 Canvas drawing with stroke styling (colors, thickness).
- Room-based instances with active player limits and role rotations.
- Live chat system with cheat protection.
- Leaderboards managed with blazing-fast Redis Sorted Sets.

---

## 🏗 Stack Overview
- **Frontend**: React.js (via Vite)
- **Backend**: Node.js + Express
- **Real-Time Engine**: Socket.IO
- **Database/Cache**: Redis 

---

## 🧠 How Redis is Used

Redis is central to the architecture, functioning as the persistent state manager and event broker to allow seamless distribution and horizontal scaling.

1. **Pub/Sub (Real-time broadcasting)**:
   - To support scaling across multiple Node.js server instances, socket events such as drawing strokes and chat instances are broadcast using Redis Pub/Sub. 
   - When a user draws on the canvas, the backend publishes the stroke to a room-specific channel (e.g., `room:1234:draw`). All server instances subscribed to that channel forward the socket emit to their connected frontend clients.
   
2. **Game State Management (Redis Hashes)**:
   - Instead of storing game state in Node.js memory (which fails to scale), we use Redis Hashes.
   - Example keys: `room:{roomId}` stores values like `currentWord`, `drawerSocketId`, `status`.
   - Active players in a room are stored in a parallel hash map `room:{roomId}:players`.

3. **Leaderboard (Redis Sorted Sets)**:
   - When users score points (via guessing the correct word or having a user guess their drawing), the points are pushed to a Redis Sorted Set (`zIncrBy` on `room:{roomId}:leaderboard`).
   - Sorted Sets automatically enforce O(log N) sorting by standard numerical scores, enabling us to safely and instantly pull the most updated top-scoring players (`zRangeWithScores`) without relying on expensive database queries.

---

## 🚀 Steps to Run the Project Locally

### Prerequisites
- [Node.js](https://nodejs.org/en/) installed (v18+).
- [Redis](https://redis.io/) installed and running locally on standard port `6379`, or a cloud connection URL.

### 1. Start Redis
Ensure your Redis server is running:
- **Windows**: `redis-server` (via WSL or Redis for Windows setup)
- **Mac/Linux**: `redis-server` or `systemctl start redis`

### 2. Backend Setup
Open a terminal inside the project directory:
```bash
cd backend
npm install
npm start
```
The server will start on `http://localhost:4000`.

### 3. Frontend Setup
Open a second terminal inside the project directory:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start. Vite usually binds to `http://localhost:5173`.

### 4. Playing the Game
1. Open up 2 or 3 browser windows side-by-side to `http://localhost:5173`.
2. Input distinct **Display Names** but join the exact **same Room ID**.
3. Once 2 players join, the game countdown will begin.
4. The drawer will see the word assigned at the top and the canvas toolbar.
5. The guessers must type into the chat panel to score!
