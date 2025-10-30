// app/api/search/route.tsx - Production Ready with All Protections + Credit System
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
import { 
  checkSufficientCredits, 
  deductCredits, 
  getCustomerCredits,
  recordFreeSearch
} from "@/app/lib/credits";
import { getSearchCache, setSearchCache } from "@/app/lib/search-cache";

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
    const searchMode = (searchParams.get("searchMode") || "smart") as 'smart' | 'displayName'; // Get search mode from query param

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

    // ============================================
    // DUPLICATE SEARCH DETECTION (for non-SUPER_ADMIN users)
    // ============================================
    let cachedResult = null;
    
    if (customerId && customerId !== 'null') {
      const customerIdInt = parseInt(customerId);
      
      // Determine if this is a smart or exact search
      const cacheSearchType = (searchMode === 'smart' || searchMode === 'displayName') ? 'smart' : 'exact';
      
      // Check if this exact search has been performed before
      cachedResult = await getSearchCache(customerIdInt, keyword, cacheSearchType);
      
      if (cachedResult) {
        console.log(`[Duplicate Search Detected] Customer ${customerIdInt} searched for "${keyword}" (${cacheSearchType}) - returning cached result (no credit charge)`);
        
        // Return cached result immediately without charging credits
        const cachedData = typeof cachedResult.result_data === 'string' 
          ? JSON.parse(cachedResult.result_data) 
          : cachedResult.result_data;
        
        // Log this duplicate search in search history (but NOT in transactions)
        if (userId) {
          const firstResult = cachedData.users && cachedData.users.length > 0 ? cachedData.users[0] : null;
          
          const searchLog = await logSearch({
            userId: parseInt(userId),
            customerId: customerIdInt,
            searchType: /^\d+$/.test(keyword) ? 'userId' : 'username',
            searchMode,
            searchQuery: keyword,
            robloxUsername: firstResult?.name,
            robloxUserId: firstResult?.id,
            robloxDisplayName: firstResult?.displayName,
            hasVerifiedBadge: firstResult?.hasVerifiedBadge,
            resultData: cachedData,
            resultCount: cachedResult.result_count,
            resultStatus: cachedResult.result_status,
            responseTimeMs: 0, // Instant from cache
          }).catch(err => {
            console.error('Failed to log duplicate search:', err);
            return null;
          });
          
          // Record free search transaction (0 credits)
          if (searchLog) {
            const searchHistoryId = searchLog ? parseInt(searchLog as unknown as string) : undefined;
            
            await recordFreeSearch({
              customerId: customerIdInt,
              userId: parseInt(userId),
              searchHistoryId,
              description: `Duplicate ${cacheSearchType} search for "${keyword}" (cached result, no charge)`,
            }).catch(err => {
              console.error('Failed to record free search transaction:', err);
            });
          }
        }
        
        return NextResponse.json({
          ...cachedData,
          fromCache: true,
          isDuplicate: true,
          cacheTtl: CACHE_TTL.DUPLICATE_SEARCH,
        });
      }
      
      // Not a duplicate - check if customer has sufficient credits
      const hasSufficientCredits = await checkSufficientCredits(customerIdInt, 1);
      
      if (!hasSufficientCredits) {
        // Get current balance for error message
        const credits = await getCustomerCredits(customerIdInt);
        const currentBalance = credits?.balance || 0;
        
        return NextResponse.json(
          { 
            error: "insufficient_credits",
            message: `Insufficient credits. You have ${currentBalance} credits. Please purchase more credits to continue.`,
            currentBalance,
          } as ErrorResponse,
          { status: 402 } // 402 Payment Required
        );
      }
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

    // Log search to database and handle credit deduction
    if (userId) {
      const responseTime = Date.now() - start;
      
      // Determine search type (simple heuristic)
      const searchType = /^\d+$/.test(keyword) ? 'userId' : 'username';
      
      // Get first result if exists
      const firstResult = users.length > 0 ? users[0] : null;
      
      // Log search first (get search history ID)
      const searchLogPromise = logSearch({
        userId: parseInt(userId),
        customerId: customerId && customerId !== 'null' ? parseInt(customerId) : null,
        searchType,
        searchMode, // Pass the search mode (smart or displayName)
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
        return null;
      });

      // ============================================
      // CREDIT DEDUCTION AND CACHING (for non-SUPER_ADMIN users)
      // ============================================
      if (customerId && customerId !== 'null') {
        const customerIdInt = parseInt(customerId);
        const userIdInt = parseInt(userId);
        
        // Determine if we should deduct credits
        let shouldDeductCredits = false;
        let deductionReason = '';
        const cacheSearchType = (searchMode === 'smart' || searchMode === 'displayName') ? 'smart' : 'exact';
        
        if (searchMode === 'smart' || searchMode === 'displayName') {
          // Smart Match and Display Name: ALWAYS deduct 1 credit
          shouldDeductCredits = true;
          deductionReason = `${searchMode === 'smart' ? 'Smart' : 'Display Name'} search for "${keyword}"`;
        } else {
          // Exact Match: Only deduct if results found
          if (users.length > 0) {
            shouldDeductCredits = true;
            deductionReason = `Exact search for "${keyword}" (results found)`;
          }
          // If no results, it's FREE (shouldDeductCredits = false)
        }

        // Cache the search result (for future duplicate detection)
        setSearchCache({
          customerId: customerIdInt,
          searchTerm: keyword,
          searchType: cacheSearchType,
          resultData: { users, searchResults },
          resultCount: users.length,
          resultStatus: users.length > 0 ? 'success' : 'no_results',
        }).catch(err => {
          console.error('Failed to cache search result:', err);
        });

        // Handle credit transaction (async, don't wait)
        searchLogPromise.then(searchLog => {
          const searchHistoryId = searchLog ? parseInt(searchLog as unknown as string) : undefined;
          
          if (shouldDeductCredits) {
            // Deduct credits for this search
            deductCredits({
              customerId: customerIdInt,
              userId: userIdInt,
              amount: 1,
              searchHistoryId,
              description: deductionReason,
            }).catch(err => {
              console.error('Failed to deduct credits:', err);
              // Don't fail the request if credit deduction fails
              // This is a critical error that should be monitored
            });
          } else {
            // Record a free search (0 credits) for exact searches with no results
            console.log(`[Credits] No deduction for exact search with no results: "${keyword}"`);
            recordFreeSearch({
              customerId: customerIdInt,
              userId: userIdInt,
              searchHistoryId,
              description: `Exact search for "${keyword}" (no results, no charge)`,
            }).catch(err => {
              console.error('Failed to record free search transaction:', err);
            });
          }
        });
      }
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