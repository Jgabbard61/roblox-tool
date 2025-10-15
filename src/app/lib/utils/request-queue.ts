/**
 * Request Queue Manager
 *
 * Manages concurrent requests to prevent rate limiting
 * Implements a sliding window rate limiter
 */
interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority?: number;
}

export interface QueueOptions {
  maxConcurrent?: number; // Max concurrent requests
  maxPerSecond?: number; // Max requests per second
  maxPerMinute?: number; // Max requests per minute
}

export class RequestQueue {
  private queue: QueuedRequest<unknown>[] = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  private options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      maxPerSecond: options.maxPerSecond ?? 10,
      maxPerMinute: options.maxPerMinute ?? 100,
    };
  }

  /**
   * Check if we can make a request now based on rate limits
   */
  private canMakeRequest(): boolean {
    const now = Date.now();

    // Check concurrent limit
    if (this.activeRequests >= this.options.maxConcurrent) {
      return false;
    }

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < 60000 // Keep last minute
    );

    // Check per-second limit
    const lastSecond = this.requestTimestamps.filter((ts) => now - ts < 1000);
    if (lastSecond.length >= this.options.maxPerSecond) {
      return false;
    }

    // Check per-minute limit
    if (this.requestTimestamps.length >= this.options.maxPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Process the next request in the queue
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || !this.canMakeRequest()) {
      return;
    }

    // Sort by priority (higher first)
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;
    this.requestTimestamps.push(Date.now());

    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request after a small delay
      setTimeout(() => this.processNext(), 100);
    }
  }

  /**
   * Enqueue a request
   *
   * @param fn - Async function to execute
   * @param priority - Optional priority (higher = executed first)
   * @returns Promise that resolves with the function result
   */
  async enqueue<T>(fn: () => Promise<T>, priority?: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ 
        fn, 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        priority 
      });
      this.processNext();
    });
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      requestsLastSecond: this.requestTimestamps.filter(
        (ts) => Date.now() - ts < 1000
      ).length,
      requestsLastMinute: this.requestTimestamps.length,
    };
  }
}

// Global queue instance for Roblox API
export const robloxApiQueue = new RequestQueue({
  maxConcurrent: 2, // Conservative to avoid rate limits
  maxPerSecond: 5,
  maxPerMinute: 60,
});

/**
 * Wrapper to automatically enqueue requests
 */
export async function queuedFetch(
  url: string | URL,
  options?: RequestInit,
  priority?: number
): Promise<Response> {
  return robloxApiQueue.enqueue(() => fetch(url, options), priority);
}
