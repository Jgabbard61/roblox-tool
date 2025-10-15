import Redis from 'ioredis';

// Create Redis client
const redis = new Redis(process.env.REDIS_URL || '', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Handle connection errors
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Connect to Redis
redis.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

export default redis;