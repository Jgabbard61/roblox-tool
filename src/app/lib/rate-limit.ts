import { getRedisClient } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds until reset
}

/**
 * Implements token bucket rate limiting using Redis
 * Each API key gets a bucket that refills at a constant rate
 */
export async function checkRateLimit(
  apiKeyId: number,
  limit: number, // requests per hour
  window: number = 3600 // window in seconds (default 1 hour)
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate_limit:${apiKeyId}`;
  const now = Date.now();
  const windowStart = now - (window * 1000);

  try {
    // Use Redis sorted set to track requests
    // Score is timestamp, member is request ID
    
    // Remove old requests outside the window
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests
    const currentCount = await redis.zcard(key);

    if (currentCount >= limit) {
      // Rate limit exceeded
      // Get the oldest request to calculate when window resets
      const oldestRequests = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldestRequests.length > 0 
        ? parseInt(oldestRequests[1]) 
        : now;
      
      const resetTime = new Date(oldestTimestamp + (window * 1000));
      const retryAfter = Math.ceil((resetTime.getTime() - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    // Add current request
    const requestId = `${now}-${Math.random()}`;
    await redis.zadd(key, now, requestId);

    // Set expiration on the key
    await redis.expire(key, window);

    // Calculate next reset time
    const resetTime = new Date(now + (window * 1000));

    return {
      allowed: true,
      remaining: limit - (currentCount + 1),
      resetTime,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetTime: new Date(now + (window * 1000)),
    };
  }
}

/**
 * Gets the current rate limit status for an API key
 */
export async function getRateLimitStatus(
  apiKeyId: number,
  limit: number,
  window: number = 3600
): Promise<{
  used: number;
  remaining: number;
  limit: number;
  resetTime: Date;
}> {
  const redis = getRedisClient();
  const key = `rate_limit:${apiKeyId}`;
  const now = Date.now();
  const windowStart = now - (window * 1000);

  try {
    // Remove old requests
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests
    const used = await redis.zcard(key);
    const remaining = Math.max(0, limit - used);

    // Get oldest request for reset time
    const oldestRequests = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTimestamp = oldestRequests.length > 0
      ? parseInt(oldestRequests[1]) + (window * 1000)
      : now + (window * 1000);

    return {
      used,
      remaining,
      limit,
      resetTime: new Date(resetTimestamp),
    };
  } catch (error) {
    console.error('Get rate limit status error:', error);
    return {
      used: 0,
      remaining: limit,
      limit,
      resetTime: new Date(now + (window * 1000)),
    };
  }
}

/**
 * Resets rate limit for an API key (admin function)
 */
export async function resetRateLimit(apiKeyId: number): Promise<void> {
  const redis = getRedisClient();
  const key = `rate_limit:${apiKeyId}`;
  
  try {
    await redis.del(key);
  } catch (error) {
    console.error('Reset rate limit error:', error);
    throw error;
  }
}

/**
 * Sliding window rate limiter (more accurate than fixed window)
 */
export async function slidingWindowRateLimit(
  apiKeyId: number,
  limit: number,
  windowMs: number = 3600000 // 1 hour in milliseconds
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate_limit:sliding:${apiKeyId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Lua script for atomic sliding window check
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local window_ms = tonumber(ARGV[4])

      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

      -- Get current count
      local count = redis.call('ZCARD', key)

      if count >= limit then
        -- Get oldest entry for reset time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local reset_time = oldest[2] and (tonumber(oldest[2]) + window_ms) or (now + window_ms)
        return {0, count, reset_time}
      else
        -- Add new entry
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        redis.call('PEXPIRE', key, window_ms)
        return {1, count + 1, now + window_ms}
      end
    `;

    const result = await redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      windowStart.toString(),
      limit.toString(),
      windowMs.toString()
    ) as [number, number, number];

    const [allowed, count, resetTimestamp] = result;

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, limit - count),
      resetTime: new Date(resetTimestamp),
      retryAfter: allowed === 0 ? Math.ceil((resetTimestamp - now) / 1000) : undefined,
    };
  } catch (error) {
    console.error('Sliding window rate limit error:', error);
    // Fail open on error
    return {
      allowed: true,
      remaining: limit,
      resetTime: new Date(now + windowMs),
    };
  }
}

/**
 * Implements a leaky bucket rate limiter
 * Good for smoothing out bursty traffic
 */
export async function leakyBucketRateLimit(
  apiKeyId: number,
  capacity: number,
  leakRate: number = 10 // requests per second
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate_limit:leaky:${apiKeyId}`;
  const now = Date.now() / 1000; // Convert to seconds

  try {
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local capacity = tonumber(ARGV[2])
      local leak_rate = tonumber(ARGV[3])

      -- Get current bucket state
      local bucket = redis.call('HMGET', key, 'level', 'last_leak')
      local level = tonumber(bucket[1]) or 0
      local last_leak = tonumber(bucket[2]) or now

      -- Calculate leaked amount since last check
      local time_passed = now - last_leak
      local leaked = time_passed * leak_rate
      level = math.max(0, level - leaked)

      -- Check if we can add a request
      if level < capacity then
        level = level + 1
        redis.call('HMSET', key, 'level', level, 'last_leak', now)
        redis.call('EXPIRE', key, 3600) -- 1 hour expiry
        
        local reset_time = now + ((capacity - level) / leak_rate)
        return {1, math.floor(capacity - level), math.ceil(reset_time)}
      else
        local reset_time = now + ((level - capacity + 1) / leak_rate)
        return {0, 0, math.ceil(reset_time), math.ceil(reset_time - now)}
      end
    `;

    const result = await redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      capacity.toString(),
      leakRate.toString()
    ) as [number, number, number, number?];

    const [allowed, remaining, resetTimestamp, retryAfter] = result;

    return {
      allowed: allowed === 1,
      remaining,
      resetTime: new Date(resetTimestamp * 1000),
      retryAfter,
    };
  } catch (error) {
    console.error('Leaky bucket rate limit error:', error);
    // Fail open on error
    return {
      allowed: true,
      remaining: capacity,
      resetTime: new Date(Date.now() + 3600000),
    };
  }
}

/**
 * Check rate limit with multiple tiers (burst and sustained)
 */
export async function tieredRateLimit(
  apiKeyId: number,
  burstLimit: number = 100, // Allow burst of 100 requests
  sustainedLimit: number = 1000, // 1000 requests per hour
  burstWindow: number = 60, // 1 minute burst window
  sustainedWindow: number = 3600 // 1 hour sustained window
): Promise<RateLimitResult> {
  // Check burst limit first
  const burstResult = await checkRateLimit(
    apiKeyId,
    burstLimit,
    burstWindow
  );

  if (!burstResult.allowed) {
    return burstResult;
  }

  // Check sustained limit
  const sustainedResult = await checkRateLimit(
    apiKeyId,
    sustainedLimit,
    sustainedWindow
  );

  return sustainedResult;
}
