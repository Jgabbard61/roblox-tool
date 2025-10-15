import Redis, { type Redis as RedisClient } from 'ioredis';

// Create Redis client
let redis: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    redis = new Redis(redisUrl);
    
    redis.on('error', (err: Error) => {
      console.error('Redis connection error:', err);
    });
    
    redis.on('connect', () => {
      console.log('Successfully connected to Redis');
    });
  }
  
  return redis;
}

// Helper function to close Redis connection (useful for cleanup)
export async function closeRedisClient(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Export default client getter
export default getRedisClient;
