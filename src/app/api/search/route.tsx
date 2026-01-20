// app/api/search/route.tsx - Public Free Tool Version
import { NextResponse, NextRequest } from "next/server";
import levenshtein from 'fast-levenshtein';
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
import { checkIPRateLimit, getClientIP } from "@/app/lib/utils/ip-rate-limit";

// ============================================================================
// SERVER-SIDE RANKING ALGORITHM (Protected - Not Exposed to Client)
// ============================================================================

interface ScoredCandidate {
  user: RobloxUser;
  confidence: number;
  signals: {
    nameSimilarity: number;
    accountSignals: number;
    keywordHits: number;
    groupOverlap: number;
    profileCompleteness: number;
  };
  breakdown: string[];
}

const RANKING_WEIGHTS = {
  nameSimilarity: 0.40,
  accountSignals: 0.25,
  keywordHits: 0.15,
  groupOverlap: 0.10,
  profileCompleteness: 0.10,
};

function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}

function jaroWinkler(s1: string, s2: string): number {
  // Handle empty strings
  if (!s1 || !s2) return 0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const matchDistance = Math.floor(longer.length / 2) - 1;
  const longerMatches = new Array(longer.length).fill(false);
  const shorterMatches = new Array(shorter.length).fill(false);

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, longer.length);

    for (let j = start; j < end; j++) {
      if (longerMatches[j] || shorter[i] !== longer[j]) continue;
      shorterMatches[i] = true;
      longerMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (!shorterMatches[i]) continue;
    while (!longerMatches[k]) k++;
    if (shorter[i] !== longer[k]) transpositions++;
    k++;
  }

  const jaro = (matches / shorter.length + matches / longer.length + (matches - transpositions / 2) / matches) / 3;

  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, shorter.length); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }

  return jaro + prefixLength * 0.1 * (1 - jaro);
}

function calculateNameSimilarity(query: string, candidate: RobloxUser): number {
  if (!query) return 0;

  const normalizedQuery = normalizeString(query);
  const normalizedUsername = normalizeString(candidate.name);
  const normalizedDisplay = normalizeString(candidate.displayName);

  // If both username and display name are empty, return 0
  if (!normalizedUsername && !normalizedDisplay) return 0;

  if (normalizedDisplay && normalizedDisplay === normalizedQuery) return 1.0;
  if (normalizedUsername && normalizedUsername === normalizedQuery) return 0.95;
  if (normalizedDisplay && normalizedDisplay.startsWith(normalizedQuery)) return 0.85;
  if (normalizedUsername && normalizedUsername.startsWith(normalizedQuery)) return 0.80;
  if (normalizedDisplay && normalizedDisplay.includes(normalizedQuery)) return 0.70;
  if (normalizedUsername && normalizedUsername.includes(normalizedQuery)) return 0.65;

  const displaySimilarity = normalizedDisplay ? jaroWinkler(normalizedQuery, normalizedDisplay) : 0;
  const usernameSimilarity = normalizedUsername ? jaroWinkler(normalizedQuery, normalizedUsername) : 0;
  const maxSimilarity = Math.max(displaySimilarity, usernameSimilarity);

  const displayDistance = normalizedDisplay ? levenshtein.get(normalizedQuery, normalizedDisplay) : 999;
  const usernameDistance = normalizedUsername ? levenshtein.get(normalizedQuery, normalizedUsername) : 999;
  const minDistance = Math.min(displayDistance, usernameDistance);

  if (minDistance <= 2) return Math.max(maxSimilarity, 0.75);
  if (minDistance <= 3) return Math.max(maxSimilarity, 0.60);

  return maxSimilarity;
}

function calculateAccountSignals(candidate: RobloxUser): number {
  let score = 0;
  if (candidate.hasVerifiedBadge) score += 0.4;

  if (candidate.created) {
    const ageInDays = (Date.now() - new Date(candidate.created).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365 * 3) score += 0.3;
    else if (ageInDays > 365) score += 0.2;
    else if (ageInDays > 90) score += 0.1;
  } else {
    score += 0.15;
  }

  if (candidate.description && candidate.description.length > 10) score += 0.3;
  else if (candidate.description) score += 0.15;

  return Math.min(score, 1.0);
}

function calculateProfileCompleteness(candidate: RobloxUser): number {
  let score = 0;
  if (candidate.displayName && candidate.displayName !== candidate.name) score += 0.3;
  if (candidate.description) {
    if (candidate.description.length > 50) score += 0.4;
    else if (candidate.description.length > 10) score += 0.3;
    else score += 0.1;
  }
  if (candidate.hasVerifiedBadge) score += 0.3;
  return Math.min(score, 1.0);
}

function rankCandidates(query: string, candidates: RobloxUser[]): ScoredCandidate[] {
  const scored = candidates.map(candidate => {
    const signals = {
      nameSimilarity: calculateNameSimilarity(query, candidate),
      accountSignals: calculateAccountSignals(candidate),
      keywordHits: 0.5,
      groupOverlap: 0.5,
      profileCompleteness: calculateProfileCompleteness(candidate),
    };

    const confidence = Math.round(
      (signals.nameSimilarity * RANKING_WEIGHTS.nameSimilarity +
       signals.accountSignals * RANKING_WEIGHTS.accountSignals +
       signals.keywordHits * RANKING_WEIGHTS.keywordHits +
       signals.groupOverlap * RANKING_WEIGHTS.groupOverlap +
       signals.profileCompleteness * RANKING_WEIGHTS.profileCompleteness) * 100
    );

    const breakdown: string[] = [];
    if (signals.nameSimilarity >= 0.9) breakdown.push('Exact name match');
    else if (signals.nameSimilarity >= 0.8) breakdown.push('Strong name similarity');
    else if (signals.nameSimilarity >= 0.6) breakdown.push('Moderate name similarity');

    if (candidate.hasVerifiedBadge) breakdown.push('Verified badge');
    if (signals.accountSignals >= 0.7) breakdown.push('Established account');
    if (signals.profileCompleteness >= 0.7) breakdown.push('Complete profile');

    return { user: candidate, confidence, signals, breakdown };
  });

  return scored.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================

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

  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Check IP-based rate limit (25 per hour)
    const rateLimitCheck = checkIPRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: rateLimitCheck.message,
          remaining: 0,
          resetTime: rateLimitCheck.resetTime.toISOString(),
        } as ErrorResponse,
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");
    const limit = searchParams.get("limit") || "10";
    const cursor = searchParams.get("cursor");
    const searchMode = (searchParams.get("searchMode") || "smart") as 'smart' | 'displayName';

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

    // Apply server-side ranking for smart mode
    let responseData;
    if (searchMode === 'smart') {
      const rankedResults = rankCandidates(keyword, users);
      responseData = {
        previousPageCursor: searchResults.previousPageCursor,
        nextPageCursor: searchResults.nextPageCursor,
        data: rankedResults,
        fromCache,
        cacheTtl: ttl,
        searchesRemaining: rateLimitCheck.remaining,
      };
    } else {
      responseData = {
        previousPageCursor: searchResults.previousPageCursor,
        nextPageCursor: searchResults.nextPageCursor,
        data: users,
        fromCache,
        cacheTtl: ttl,
        searchesRemaining: rateLimitCheck.remaining,
      };
    }

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
    const responseTime = Date.now() - start;
    const searchType = /^\d+$/.test(keyword) ? 'userId' : 'username';
    const firstResult = users.length > 0 ? users[0] : null;

    logSearch({
      userId: null, // No user ID for public searches
      customerId: null, // No customer ID for public searches
      ipAddress: clientIP, // Log IP address
      searchType,
      searchMode,
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
    });

    return NextResponse.json(responseData);
  } catch (error) {
    // Handle rate limit errors
    if (error instanceof RateLimitError) {
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
