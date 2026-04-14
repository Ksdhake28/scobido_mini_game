import { createClient } from 'redis';

export async function initializeRedis() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  const clientOptions = { url: REDIS_URL };
  if (REDIS_URL.startsWith('rediss://')) {
      clientOptions.socket = { tls: true, rejectUnauthorized: false };
  }

  const redisClient = createClient(clientOptions);
  const pubClient = createClient(clientOptions);
  const subClient = createClient(clientOptions);

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  pubClient.on('error', (err) => console.error('Redis PubClient Error', err));
  subClient.on('error', (err) => console.error('Redis SubClient Error', err));

  await redisClient.connect();
  await pubClient.connect();
  await subClient.connect();

  console.log('Redis connected successfully (Main, Pub, Sub)');

  return { redisClient, pubClient, subClient };
}
