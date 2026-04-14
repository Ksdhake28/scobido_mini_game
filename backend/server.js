import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeRedis } from './config/redis.js';
import registerSocketHandlers from './sockets/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.send({ status: 'ok', msg: 'Skribbl Backend is running.' });
});

async function startServer() {
  try {
    // Initialize Redis connections
    const { redisClient, pubClient, subClient } = await initializeRedis();

    // Setup Socket.IO Event Handlers
    registerSocketHandlers(io, { redisClient, pubClient, subClient });

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
