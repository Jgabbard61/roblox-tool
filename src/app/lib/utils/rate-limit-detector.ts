/**
 * Rate Limit Detection Utility
 *
 * Provides comprehensive detection and parsing of rate limit responses
 * from Roblox API and other external services.
 */
export interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfterSeconds: number | null;
  retryAfterDate: Date | null;
  limitRemaining: number | null;
  limitTotal: number | null;
  limitResetDate: Date | null;
  errorMessage: string | null;
}

export interface RateLimitDetectionOptions {
  defaultRetryAfter?: number; // Default seconds to wait if not specified
  parseHeaders?: boolean; // Whether to attempt parsing X-RateLimit-* headers
}

/**
 * Detects if a Response indicates rate limiting and extracts relevant information
 *
 * @param response - The fetch Response object
 * @param options - Detection options
 * @returns RateLimitInfo object with detected information
 */
export function detectRateLimit(
  response: Response,
  options: RateLimitDetectionOptions = {}
): RateLimitInfo {
  const {
    defaultRetryAfter = 60, // Default to 60 seconds if not specified
    parseHeaders = true,
  } = options;

  const result: RateLimitInfo = {
    isRateLimited: false,
    retryAfterSeconds: null,
    retryAfterDate: null,
    limitRemaining: null,
    limitTotal: null,
    limitResetDate: null,
    errorMessage: null,
  };

  // Check for 429 status code (primary detection method)
  if (response.status === 429) {
    result.isRateLimited = true;
    result.errorMessage = "Rate limit exceeded";

    // Attempt to parse Retry-After header
    const retryAfterHeader = response.headers.get("Retry-After");
    if (retryAfterHeader) {
      // Retry-After can be either a number of seconds or an HTTP date
      const retryAfterNumber = parseInt(retryAfterHeader, 10);

      if (!isNaN(retryAfterNumber)) {
        // It's a number of seconds
        result.retryAfterSeconds = retryAfterNumber;
        result.retryAfterDate = new Date(Date.now() + retryAfterNumber * 1000);
      } else {
        // It might be an HTTP date
        const retryAfterDate = new Date(retryAfterHeader);
        if (!isNaN(retryAfterDate.getTime())) {
          result.retryAfterDate = retryAfterDate;
          result.retryAfterSeconds = Math.ceil(
            (retryAfterDate.getTime() - Date.now()) / 1000
          );
        }
      }
    }

    // If no Retry-After header, use default
    if (result.retryAfterSeconds === null) {
      result.retryAfterSeconds = defaultRetryAfter;
      result.retryAfterDate = new Date(Date.now() + defaultRetryAfter * 1000);
    }
  }

  // Parse X-RateLimit-* headers if enabled (note: unreliable for Roblox)
  if (parseHeaders) {
    const limitRemaining = response.headers.get("X-RateLimit-Remaining");
    const limitTotal = response.headers.get("X-RateLimit-Limit");
    const limitReset = response.headers.get("X-RateLimit-Reset");

    if (limitRemaining !== null) {
      result.limitRemaining = parseInt(limitRemaining, 10);
    }
    if (limitTotal !== null) {
      result.limitTotal = parseInt(limitTotal, 10);
    }
    if (limitReset !== null) {
      // Could be Unix timestamp or HTTP date
      const resetTimestamp = parseInt(limitReset, 10);
      if (!isNaN(resetTimestamp)) {
        result.limitResetDate = new Date(resetTimestamp * 1000);
      }
    }

    // If we're close to rate limit but not yet 429, flag as rate limited
    if (
      result.limitRemaining !== null &&
      result.limitRemaining === 0 &&
      !result.isRateLimited
    ) {
      result.isRateLimited = true;
      result.errorMessage = "Rate limit reached";

      // Use reset date or default wait time
      if (result.limitResetDate) {
        result.retryAfterSeconds = Math.ceil(
          (result.limitResetDate.getTime() - Date.now()) / 1000
        );
        result.retryAfterDate = result.limitResetDate;
      } else {
        result.retryAfterSeconds = defaultRetryAfter;
        result.retryAfterDate = new Date(Date.now() + defaultRetryAfter * 1000);
      }
    }
  }

  return result;
}

/**
 * Custom error class for rate limit errors
 */
export class RateLimitError extends Error {
  constructor(
    public rateLimitInfo: RateLimitInfo,
    message?: string
  ) {
    super(
      message ||
        `Rate limited. Retry after ${rateLimitInfo.retryAfterSeconds} seconds.`
    );
    this.name = "RateLimitError";

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}

/**
 * Wraps a fetch call with rate limit detection
 * Throws RateLimitError if rate limited
 *
 * @param url - URL to fetch
 * @param options - fetch options
 * @param rateLimitOptions - rate limit detection options
 * @returns The successful response
 * @throws RateLimitError if rate limited
 */
export async function fetchWithRateLimitDetection(
  url: string | URL,
  options?: RequestInit,
  rateLimitOptions?: RateLimitDetectionOptions
): Promise<Response> {
  const response = await fetch(url, options);

  const rateLimitInfo = detectRateLimit(response, rateLimitOptions);

  if (rateLimitInfo.isRateLimited) {
    throw new RateLimitError(rateLimitInfo);
  }

  return response;
}

/**
 * Helper to format remaining time for user display
 *
 * @param seconds - Number of seconds
 * @returns Human-readable string (e.g. "2 minutes", "45 seconds")
 */
export function formatRetryAfterTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

/**
 * Check if a rate limit wait period has expired
 * @param rateLimitInfo - The rate limit info from a previous detection
 * @returns true if enough time has passed to retry
 */
export function canRetryNow(rateLimitInfo: RateLimitInfo): boolean {
  if (!rateLimitInfo.retryAfterDate) {
    return true;
  }
  return Date.now() >= rateLimitInfo.retryAfterDate.getTime();
}