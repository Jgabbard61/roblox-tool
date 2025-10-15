/**
 * Caching Utility with Redis/Vercel KV and In-Memory Fallback
 *
 * Provides intelligent caching for Roblox API responses
 * with different TTL strategies for exact vs fuzzy searches
 */
import crypto from "crypto";

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
}

export interface CachedResponse<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Generate a consistent cache key from search parameters
 *
 * @param params - Object containing search parameters
 * @param namespace - Optional namespace prefix
 * @returns Cache key string
 */
export function generateCacheKey(
  params: Record<string, unknown>,
  namespace: string = "roblox"
): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const paramsString = JSON.stringify(sortedParams);
  const hash = crypto.createHash("sha256").update(paramsString).digest("hex");

  return `${namespace}:${hash}`;
}

/**
 * Simple in-memory cache (fallback for development/testing)
 * WARNING: Not shared across serverless instances - use Redis in production
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100; // Prevent memory leaks

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Periodic cleanup
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new InMemoryCache();

// Run cleanup every 5 minutes (server-side only)
if (typeof window === "undefined") {
  setInterval(() => {
    memoryCache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Get cached data from Redis or in-memory cache
 *
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
export async function getCached<T>(
  key: string
): Promise<CachedResponse<T> | null> {
  try {
    // Try Redis first if available
    if (process.env.REDIS_URL) {
      try {
        const getRedisClient = (await import("../redis")).default;
        const redis = getRedisClient();
        const cached = await redis.get(key);

        if (cached) {
          const parsed = JSON.parse(cached as string) as CachedResponse<T>;
          
          // Check if expired
          if (parsed.expiresAt < Date.now()) {
            await redis.del(key);
            return null;
          }

          return parsed;
        }
      } catch (redisError) {
        console.warn("Redis cache read failed, falling back to memory cache:", redisError);
      }
    }

    // Fallback to in-memory cache
    const memData = memoryCache.get<CachedResponse<T>>(key);
    return memData;
  } catch (error) {
    console.error("Cache read error:", error);
    return null;
  }
}

/**
 * Set cached data in Redis or in-memory cache
 *
 * @param key - Cache key
 * @param data - Data to cache
 * @param options - Cache options (TTL, etc.)
 */
export async function setCached<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = 900 } = options; // Default 15 minutes

  const cacheEntry: CachedResponse<T> = {
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  };

  try {
    // Try Redis first if available
    if (process.env.REDIS_URL) {
      try {
        const getRedisClient = (await import("../redis")).default;
        const redis = getRedisClient();
        await redis.setex(key, ttl, JSON.stringify(cacheEntry));
        return;
      } catch (redisError) {
        console.warn("Redis cache write failed, falling back to memory cache:", redisError);
      }
    }

    // Fallback to in-memory cache
    memoryCache.set(key, cacheEntry, ttl);
  } catch (error) {
    console.error("Cache write error:", error);
    // Don't throw - caching is not critical
  }
}

/**
 * Delete cached data
 *
 * @param key - Cache key
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    // Try Redis first if available
    if (process.env.REDIS_URL) {
      try {
        const getRedisClient = (await import("../redis")).default;
        const redis = getRedisClient();
        await redis.del(key);
      } catch (redisError) {
        console.warn("Redis cache delete failed:", redisError);
      }
    }

    // Also delete from memory cache
    memoryCache.delete(key);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}

/**
 * Wrapper for caching API calls
 *
 * @param cacheKey - Cache key
 * @param fetcher - Async function that fetches the data
 * @param options - Cache options
 * @returns Fetched or cached data
 */
export async function withCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<{ data: T; fromCache: boolean }> {
  // Try to get from cache first
  const cached = await getCached<T>(cacheKey);

  if (cached) {
    console.log(`Cache HIT: ${cacheKey}`);
    return { data: cached.data, fromCache: true };
  }

  console.log(`Cache MISS: ${cacheKey}`);

  // Fetch fresh data
  const data = await fetcher();

  // Cache it for next time (don't await - fire and forget)
  setCached(cacheKey, data, options).catch((err) =>
    console.error("Background cache set failed:", err)
  );

  return { data, fromCache: false };
}

/**
 * Cache TTL recommendations based on search type
 */
export const CACHE_TTL = {
  EXACT_SEARCH: 900, // 15 minutes - exact username searches are stable
  FUZZY_SEARCH: 300, // 5 minutes - partial matches can change
  USER_PROFILE: 1800, // 30 minutes - user profiles change infrequently
  VERIFICATION_STATUS: 600, // 10 minutes - balance between freshness and performance
} as const;

/**
 * Determine if a search is exact or fuzzy
 *
 * @param keyword - Search keyword
 * @returns true if exact search (likely username), false if fuzzy
 */
export function isExactSearch(keyword: string): boolean {
  // Heuristic: if keyword looks like a complete username (alphanumeric, no spaces)
  // it's probably an exact search
  return /^[a-zA-Z0-9_]{3,20}$/.test(keyword.trim());
}
