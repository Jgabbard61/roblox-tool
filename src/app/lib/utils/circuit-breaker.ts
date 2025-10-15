/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by stopping requests when failure rate is high
 */

enum CircuitState {
  CLOSED, // Normal operation
  OPEN, // Blocking requests
  HALF_OPEN, // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  successThreshold?: number; // Successes needed to close circuit from half-open
  timeout?: number; // Time in ms before attempting to close circuit
  monitoringPeriod?: number; // Time window for counting failures
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private failureTimestamps: number[] = [];
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod ?? 120000, // 2 minutes
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime >= this.options.timeout
      ) {
        console.log("Circuit breaker: transitioning to HALF_OPEN");
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Service temporarily unavailable. Try again in ${
            this.options.timeout / 1000
          } seconds.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;

      if (this.successes >= this.options.successThreshold) {
        console.log("Circuit breaker: transitioning to CLOSED");
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(Date.now());

    // Clean old timestamps
    const cutoff = Date.now() - this.options.monitoringPeriod;
    this.failureTimestamps = this.failureTimestamps.filter((ts) => ts > cutoff);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during test period, reopen circuit
      console.log(
        "Circuit breaker: transitioning to OPEN (half-open test failed)"
      );
      this.state = CircuitState.OPEN;
      this.successes = 0;
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureTimestamps.length >= this.options.failureThreshold
    ) {
      // Too many failures, open circuit
      console.log(
        "Circuit breaker: transitioning to OPEN (threshold exceeded)"
      );
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): { state: string; failures: number; successes: number } {
    return {
      state: CircuitState[this.state],
      failures: this.failureTimestamps.length,
      successes: this.successes,
    };
  }

  /**
   * Manually reset the circuit
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.failureTimestamps = [];
  }
}

// Global circuit breaker for Roblox API
export const robloxApiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  monitoringPeriod: 120000,
});
