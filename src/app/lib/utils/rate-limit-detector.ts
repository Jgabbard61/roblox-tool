export interface RateLimitStatus {
  isRateLimited: boolean;
  retryAfter?: number;
  remainingRequests?: number;
  resetTime?: Date;
}

export function detectRateLimit(response: Response): RateLimitStatus {
  const status: RateLimitStatus = {
    isRateLimited: false,
  };

  // Check for common rate limit status codes
  if (response.status === 429 || response.status === 503) {
    status.isRateLimited = true;

    // Parse retry-after header
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const retrySeconds = parseInt(retryAfter, 10);
      if (!isNaN(retrySeconds)) {
        status.retryAfter = retrySeconds;
        status.resetTime = new Date(Date.now() + retrySeconds * 1000);
      }
    }
  }

  // ... additional header parsing logic
  return status;
}