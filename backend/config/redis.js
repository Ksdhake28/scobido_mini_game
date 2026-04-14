import { createClient } from 'redis';

export async function initializeRedis() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  const redisClient = createClient({ url: REDIS_URL });
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = createClient({ url: REDIS_URL });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  pubClient.on('error', (err) => console.error('Redis PubClient Error', err));
  subClient.on('error', (err) => console.error('Redis SubClient Error', err));

  await redisClient.connect();
  await pubClient.connect();
  await subClient.connect();

  console.log('Redis connected successfully (Main, Pub, Sub)');

  return { redisClient, pubClient, subClient };
}
