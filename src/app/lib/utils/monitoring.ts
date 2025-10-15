/**
 * Monitoring and Logging Utilities
 */
export interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  cacheHit: boolean;
  rateLimited: boolean;
  error: boolean;
  timestamp: number;
}

export interface SlaMetrics {
  uptime: number; // Percentage
  p95ResponseTime: number; // Milliseconds
  errorRate: number; // Percentage
  cacheHitRate: number; // Percentage
  rateLimitRecoveryTime: number; // Seconds
}

class MetricsCollector {
  private metrics: ApiMetrics[] = [];
  private maxMetrics = 1000;

  log(metric: ApiMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[METRIC] ${metric.endpoint}: ${metric.statusCode} (${metric.responseTimeMs}ms)${
          metric.cacheHit ? " [CACHED]" : ""
        }`
      );
    }
  }

  getMetrics(): ApiMetrics[] {
    return [...this.metrics];
  }

  getSummary() {
    const totalRequests = this.metrics.length;
    const cacheHits = this.metrics.filter((m) => m.cacheHit).length;
    const rateLimited = this.metrics.filter((m) => m.rateLimited).length;
    const errors = this.metrics.filter((m) => m.error).length;
    const avgResponseTime =
      this.metrics.reduce((sum, m) => sum + m.responseTimeMs, 0) /
        totalRequests || 0;

    return {
      totalRequests,
      cacheHits,
      cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      rateLimited,
      rateLimitRate:
        totalRequests > 0 ? (rateLimited / totalRequests) * 100 : 0,
      errors,
      errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
      avgResponseTime,
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Wrapper to automatically collect metrics
 */
export function withMetrics(
  endpoint: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const start = Date.now();

  return handler()
    .then((response) => {
      const responseTimeMs = Date.now() - start;

      metricsCollector.log({
        endpoint,
        method: "GET",
        statusCode: response.status,
        responseTimeMs,
        cacheHit: false, // Set this based on your cache implementation
        rateLimited: response.status === 429,
        error: response.status >= 400,
        timestamp: Date.now(),
      });

      return response;
    })
    .catch((error) => {
      const responseTimeMs = Date.now() - start;

      metricsCollector.log({
        endpoint,
        method: "GET",
        statusCode: 500,
        responseTimeMs,
        cacheHit: false,
        rateLimited: false,
        error: true,
        timestamp: Date.now(),
      });

      throw error;
    });
}

/**
 * Calculate SLA metrics from API metrics
 * Implementation of Section 7.3
 */
export function calculateSla(metrics: ApiMetrics[]): SlaMetrics {
  const totalRequests = metrics.length;

  if (totalRequests === 0) {
    return {
      uptime: 100,
      p95ResponseTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      rateLimitRecoveryTime: 0,
    };
  }

  // Calculate uptime (non-error requests)
  const successfulRequests = metrics.filter((m) => !m.error).length;
  const uptime = (successfulRequests / totalRequests) * 100;

  // Calculate p95 response time
  const sortedTimes = metrics
    .map((m) => m.responseTimeMs)
    .sort((a, b) => a - b);
  const p95Index = Math.floor(sortedTimes.length * 0.95);
  const p95ResponseTime = sortedTimes[p95Index] || 0;

  // Calculate error rate
  const errors = metrics.filter((m) => m.error && !m.rateLimited).length;
  const errorRate = (errors / totalRequests) * 100;

  // Calculate cache hit rate
  const cacheHits = metrics.filter((m) => m.cacheHit).length;
  const cacheHitRate = (cacheHits / totalRequests) * 100;

  // Calculate average rate limit recovery time
  // This would need additional tracking of recovery times
  const rateLimitRecoveryTime = 0;

  return {
    uptime,
    p95ResponseTime,
    errorRate,
    cacheHitRate,
    rateLimitRecoveryTime,
  };
}