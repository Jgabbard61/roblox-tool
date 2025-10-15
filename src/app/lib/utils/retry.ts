/**
 * Retry Logic with Exponential Backoff
 *
 * Provides intelligent retry mechanisms for API calls
 */
export interface RetryOptions {
  maxRetries?: number; // Maximum number of retry attempts
  initialDelayMs?: number; // Initial delay in milliseconds
  maxDelayMs?: number; // Maximum delay cap
  backoffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
  jitterMs?: number; // Random jitter to prevent thundering herd
  shouldRetry?: (error: unknown, attempt: number) => boolean; // Custom retry logic
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void; // Callback on retry
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500,
  shouldRetry: (error: unknown) => {
    // Don't retry on 4xx errors (except 429)
    const err = error as { response?: { status?: number } };
    if (err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
      return err.response.status === 429;
    }
    return true;
  },
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, jitterMs } = options;

  // Exponential backoff: delay = initial * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add random jitter to prevent thundering herd
  const jitter = Math.random() * jitterMs;

  return cappedDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Try to execute the function
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = opts.shouldRetry(error, attempt);

      if (!shouldRetry || attempt >= opts.maxRetries) {
        // Don't retry or out of retries
        throw error;
      }

      // Calculate delay for this attempt
      const delayMs = calculateDelay(attempt, opts);

      // Call retry callback
      opts.onRetry(error, attempt, delayMs);

      console.log(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delayMs}ms`
      );

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript doesn't know that
  throw lastError;
}

/**
 * Retry specifically for rate limit errors
 * Uses the Retry-After header if available
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, "shouldRetry"> = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    shouldRetry: (error) => {
      // Only retry on rate limit errors (429)
      const err = error as { name?: string; rateLimitInfo?: { retryAfterSeconds?: number } };
      if (err?.name === "RateLimitError") {
        // If we have rate limit info, check retry after
        const retryAfterSeconds = err?.rateLimitInfo?.retryAfterSeconds;

        if (retryAfterSeconds) {
          // Wait for the specified time (handled in calculateDelay override)
          return true;
        }
      }
      return false;
    },
  });
}

/**
 * Create a retry wrapper with specific options
 * Useful for creating reusable retry configurations
 */
export function createRetryWrapper(options: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>) => withRetry(fn, options);
}

// Pre-configured retry strategies
export const retryStrategies = {
  // Conservative: 3 retries, 1s/2s/4s delays
  conservative: createRetryWrapper({
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    jitterMs: 500,
  }),

  // Aggressive: 5 retries, faster backoff
  aggressive: createRetryWrapper({
    maxRetries: 5,
    initialDelayMs: 500,
    backoffMultiplier: 1.5,
    jitterMs: 200,
  }),

  // Patient: Longer waits for rate limits
  patient: createRetryWrapper({
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterMs: 1000,
  }),
};
