/**
 * IP-based Rate Limiting for Public Tool
 * 25 searches per hour per IP address
 */

interface IPRateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for IP rate limits (use Redis in production for distributed systems)
const ipLimits = new Map<string, IPRateLimitRecord>();

const RATE_LIMIT = 25; // searches per hour
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if an IP address is within rate limits
 */
export function checkIPRateLimit(ipAddress: string): {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  message?: string;
} {
  const now = Date.now();
  const record = ipLimits.get(ipAddress);

  // Clean up old records periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupExpiredRecords(now);
  }

  if (!record || record.resetTime < now) {
    // No record or expired - create new one
    ipLimits.set(ipAddress, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT - 1,
      resetTime: new Date(now + WINDOW_MS),
    };
  }

  // Check if already at limit BEFORE incrementing
  if (record.count >= RATE_LIMIT) {
    // Rate limit exceeded - don't increment further
    const resetTime = new Date(record.resetTime);
    const minutesRemaining = Math.ceil((record.resetTime - now) / (60 * 1000));

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      message: `You have exceeded the search limit of ${RATE_LIMIT} searches per hour. Please come back in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} to search more or contact Support@Verifylens.com for assistance.`,
    };
  }

  // Increment count only if under limit
  record.count++;

  return {
    allowed: true,
    remaining: RATE_LIMIT - record.count,
    resetTime: new Date(record.resetTime),
  };
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Check Vercel/proxy headers first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address (won't work with proxies)
  return 'unknown';
}

/**
 * Clean up expired rate limit records
 */
function cleanupExpiredRecords(now: number) {
  for (const [ip, record] of ipLimits.entries()) {
    if (record.resetTime < now) {
      ipLimits.delete(ip);
    }
  }
}

/**
 * Get current rate limit status for an IP (for display purposes)
 */
export function getIPRateLimitStatus(ipAddress: string): {
  count: number;
  remaining: number;
  resetTime: Date | null;
} {
  const record = ipLimits.get(ipAddress);
  const now = Date.now();

  if (!record || record.resetTime < now) {
    return {
      count: 0,
      remaining: RATE_LIMIT,
      resetTime: null,
    };
  }

  return {
    count: record.count,
    remaining: Math.max(0, RATE_LIMIT - record.count),
    resetTime: new Date(record.resetTime),
  };
}
