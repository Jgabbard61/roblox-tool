// app/api/search/route.tsx - Production Ready with All Protections
import { NextResponse, NextRequest } from "next/server";
import {
  fetchWithRateLimitDetection,
  RateLimitError,
} from "@/app/lib/utils/rate-limit-detector";
import {
  generateCacheKey,
  withCache,
  CACHE_TTL,
  isExactSearch,
} from "@/app/lib/utils/cache";
import { withRetry } from "@/app/lib/utils/retry";
import { robloxApiQueue } from "@/app/lib/utils/request-queue";
import { robloxApiCircuitBreaker } from "@/app/lib/utils/circuit-breaker";
import { metricsCollector } from "@/app/lib/utils/monitoring";
import { logSearch } from "@/app/lib/db";

// Define TypeScript interfaces for Roblox API responses
interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  previousUsernames?: string[];
  description?: string;
  created?: string;
  isBanned?: boolean;
}

interface RobloxSearchResponse {
  previousPageCursor?: string | null;
  nextPageCursor?: string | null;
  data: RobloxUser[];
}

interface ErrorResponse {
  error: string;
  message?: string;
  retryAfter?: number;
  retryAfterDate?: string;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const start = Date.now();
  let fromCache = false;

  // Get user info from headers (set by middleware)
  const userId = request.headers.get('X-User-Id');
  const customerId = request.headers.get('X-Customer-Id');

  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");
    const limit = searchParams.get("limit") || "10";
    const cursor = searchParams.get("cursor");

    // Validation
    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword parameter is required" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (keyword.length < 3) {
      return NextResponse.json(
        { error: "Keyword must be at least 3 characters" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(
      {
        type: "user_search",
        keyword: keyword.toLowerCase().trim(),
        limit,
        cursor: cursor || "none",
      },
      "roblox"
    );

    // Determine TTL based on search type
    const ttl = isExactSearch(keyword)
      ? CACHE_TTL.EXACT_SEARCH
      : CACHE_TTL.FUZZY_SEARCH;

    // Fetch with all protections: cache, queue, circuit breaker, retry
    const result = await withCache(
      cacheKey,
      async () => {
        // Use circuit breaker
        return await robloxApiCircuitBreaker.execute(async () => {
          // Use request queue
          return await robloxApiQueue.enqueue(async () => {
            // Use retry logic
            return await withRetry(
              async () => {
                // Build the API URL
                let apiUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(
                  keyword
                )}&limit=${limit}`;
                if (cursor) {
                  apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
                }

                const response = await fetchWithRateLimitDetection(
                  apiUrl,
                  {
                    method: "GET",
                    headers: {
                      "Content-Type": "application/json",
                      "User-Agent": "RobloxVerifier/1.0",
                    },
                  },
                  {
                    defaultRetryAfter: 60,
                    parseHeaders: true,
                  }
                );

                if (!response.ok) {
                  throw new Error(
                    `Roblox API returned ${response.status}: ${response.statusText}`
                  );
                }

                const data = (await response.json()) as RobloxSearchResponse;

                // Validate that we have the expected data structure
                if (!data.data || !Array.isArray(data.data)) {
                  throw new Error("Invalid response from Roblox API");
                }

                return data;
              },
              {
                maxRetries: 2,
                initialDelayMs: 1000,
                backoffMultiplier: 2,
                onRetry: (error, attempt, delayMs) => {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.log(
                    `Retrying search for "${keyword}" (attempt ${
                      attempt + 1
                    }, delay ${delayMs}ms): ${errorMessage}`
                  );
                },
              }
            );
          }, 5); // Priority 5 for user searches
        });
      },
      { ttl }
    );

    fromCache = result.fromCache;
    const searchResults = result.data;

    // Map the data to ensure all users have the expected structure
    const users: RobloxUser[] = searchResults.data.map((user) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      hasVerifiedBadge: user.hasVerifiedBadge || false,
      previousUsernames: user.previousUsernames || [],
      description: user.description,
      created: user.created,
      isBanned: user.isBanned,
    }));

    const responseData = {
      previousPageCursor: searchResults.previousPageCursor,
      nextPageCursor: searchResults.nextPageCursor,
      data: users,
      fromCache,
      cacheTtl: ttl,
    };

    // Log metrics
    metricsCollector.log({
      endpoint: "/api/search",
      method: "GET",
      statusCode: 200,
      responseTimeMs: Date.now() - start,
      cacheHit: fromCache,
      rateLimited: false,
      error: false,
      timestamp: Date.now(),
    });

    // Log search to database (async, don't wait)
    if (userId) {
      const responseTime = Date.now() - start;
      
      // Determine search type (simple heuristic)
      const searchType = /^\d+$/.test(keyword) ? 'userId' : 'username';
      
      // Get first result if exists
      const firstResult = users.length > 0 ? users[0] : null;
      
      logSearch({
        userId: parseInt(userId),
        customerId: customerId && customerId !== 'null' ? parseInt(customerId) : null,
        searchType,
        searchQuery: keyword,
        robloxUsername: firstResult?.name,
        robloxUserId: firstResult?.id,
        robloxDisplayName: firstResult?.displayName,
        hasVerifiedBadge: firstResult?.hasVerifiedBadge,
        resultData: { users, searchResults },
        resultCount: users.length,
        resultStatus: users.length > 0 ? 'success' : 'no_results',
        responseTimeMs: responseTime,
      }).catch(err => {
        console.error('Failed to log search:', err);
        // Don't fail the request if logging fails
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    // Handle rate limit errors
    if (error instanceof RateLimitError) {
      // Log metrics
      metricsCollector.log({
        endpoint: "/api/search",
        method: "GET",
        statusCode: 429,
        responseTimeMs: Date.now() - start,
        cacheHit: false,
        rateLimited: true,
        error: true,
        timestamp: Date.now(),
      });

      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many requests. Please wait before trying again.",
          retryAfter: error.rateLimitInfo.retryAfterSeconds,
          retryAfterDate: error.rateLimitInfo.retryAfterDate?.toISOString(),
        } as ErrorResponse,
        { status: 429 }
      );
    }

    // Handle circuit breaker errors
    if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
      // Log metrics
      metricsCollector.log({
        endpoint: "/api/search",
        method: "GET",
        statusCode: 503,
        responseTimeMs: Date.now() - start,
        cacheHit: false,
        rateLimited: false,
        error: true,
        timestamp: Date.now(),
      });

      return NextResponse.json(
        {
          error: "service_unavailable",
          message: "Service temporarily unavailable. Please try again later.",
        } as ErrorResponse,
        { status: 503 }
      );
    }

    // Handle other errors
    console.error("Search API error:", error);
    
    // Log metrics
    metricsCollector.log({
      endpoint: "/api/search",
      method: "GET",
      statusCode: 500,
      responseTimeMs: Date.now() - start,
      cacheHit: false,
      rateLimited: false,
      error: true,
      timestamp: Date.now(),
    });

    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "An error occurred while searching for users",
      } as ErrorResponse,
      { status: 500 }
    );
  }
}