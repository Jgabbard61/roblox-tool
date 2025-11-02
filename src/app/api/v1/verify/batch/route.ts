
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, deductCredits } from '@/app/lib/api-auth';
import { withCache, generateCacheKey, CACHE_TTL } from '@/app/lib/utils/cache';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/verify/batch
 * Verifies multiple Roblox usernames at once (up to 100)
 * 
 * Request body:
 * {
 *   "usernames": ["JohnDoe", "JaneDoe", ...],
 *   "includeBanned": false // Optional: include banned/unavailable accounts
 * }
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       {
 *         "username": "JohnDoe",
 *         "verified": true,
 *         "user": { ... }
 *       },
 *       ...
 *     ],
 *     "totalRequested": 10,
 *     "totalVerified": 8,
 *     "totalFailed": 2,
 *     "creditsUsed": 10
 *   }
 * }
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      // Parse request body
      const body = await request.json();
      const { usernames, includeBanned = false } = body;

      // Validate input
      if (!Array.isArray(usernames)) {
        return NextResponse.json(
          { error: 'usernames must be an array' },
          { status: 400 }
        );
      }

      if (usernames.length === 0) {
        return NextResponse.json(
          { error: 'usernames array cannot be empty' },
          { status: 400 }
        );
      }

      if (usernames.length > 100) {
        return NextResponse.json(
          { error: 'Maximum 100 usernames allowed per batch request' },
          { status: 400 }
        );
      }

      // Validate all usernames are strings
      if (!usernames.every((u) => typeof u === 'string')) {
        return NextResponse.json(
          { error: 'All usernames must be strings' },
          { status: 400 }
        );
      }

      // Check if customer has enough credits (1 credit per username)
      const requiredCredits = usernames.length;
      if (context.customer.credits < requiredCredits) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            required: requiredCredits,
            available: context.customer.credits,
          },
          { status: 402 }
        );
      }

      // Process batch verification
      const results = [];
      let totalVerified = 0;
      let totalFailed = 0;
      let totalFromCache = 0;

      for (const username of usernames) {
        try {
          const trimmedUsername = username.trim();
          if (trimmedUsername.length === 0) {
            results.push({
              username: username,
              verified: false,
              error: 'Username cannot be empty',
              user: null,
            });
            totalFailed++;
            continue;
          }

          // Try to get from cache first
          const cacheKey = generateCacheKey(
            { username: trimmedUsername.toLowerCase(), includeBanned },
            'api:verify:username'
          );

          const { data: cachedData, fromCache } = await withCache(
            cacheKey,
            async () => {
              return await searchRobloxUser(trimmedUsername, includeBanned);
            },
            { ttl: CACHE_TTL.EXACT_SEARCH }
          );

          if (fromCache) {
            totalFromCache++;
          }

          results.push({
            username: trimmedUsername,
            ...cachedData,
          });

          if (cachedData.verified) {
            totalVerified++;
          } else {
            totalFailed++;
          }
        } catch (error) {
          results.push({
            username: username,
            verified: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            user: null,
          });
          totalFailed++;
        }
      }

      // Deduct credits for non-cached results
      const creditsToDeduct = usernames.length - totalFromCache;
      let creditsUsed = 0;
      
      if (creditsToDeduct > 0) {
        await deductCredits(
          context.customer.id,
          creditsToDeduct,
          `Batch verification: ${creditsToDeduct} usernames`
        );
        creditsUsed = creditsToDeduct;

        // Log batch search
        await query(
          `INSERT INTO search_history 
           (search_query, result_found, customer_id, search_mode, user_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `batch:${usernames.length}`,
            totalVerified > 0,
            context.customer.id,
            'batch',
            JSON.stringify({ totalRequested: usernames.length, totalVerified }),
          ]
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          results,
          totalRequested: usernames.length,
          totalVerified,
          totalFailed,
          creditsUsed,
          cachedResults: totalFromCache,
        },
      });
    } catch (error) {
      console.error('Batch verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify batch',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    requiredScope: 'verify:read',
  }
);

/**
 * Searches for a Roblox user by username
 */
async function searchRobloxUser(
  username: string,
  includeBanned: boolean
): Promise<{
  verified: boolean;
  user: {
    id: number;
    username: string;
    displayName: string;
    hasVerifiedBadge: boolean;
    banned: boolean;
    created: string;
  } | null;
}> {
  try {
    // Call Roblox API to search for user
    const searchResponse = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
    );

    if (!searchResponse.ok) {
      throw new Error(`Roblox API error: ${searchResponse.statusText}`);
    }

    interface RobloxUser {
      name: string;
      id: number;
      displayName: string;
    }

    interface RobloxSearchResponse {
      data?: RobloxUser[];
    }

    const searchData: RobloxSearchResponse = await searchResponse.json();

    // Find exact match (case-insensitive)
    const exactMatch = searchData.data?.find(
      (user: RobloxUser) => user.name.toLowerCase() === username.toLowerCase()
    );

    if (!exactMatch) {
      return {
        verified: false,
        user: null,
      };
    }

    // Get detailed user information
    const userResponse = await fetch(
      `https://users.roblox.com/v1/users/${exactMatch.id}`
    );

    if (!userResponse.ok) {
      // If we can't get details, return basic info
      return {
        verified: true,
        user: {
          id: exactMatch.id,
          username: exactMatch.name,
          displayName: exactMatch.displayName || exactMatch.name,
          hasVerifiedBadge: exactMatch.hasVerifiedBadge || false,
          banned: false,
          created: exactMatch.created || new Date().toISOString(),
        },
      };
    }

    const userData = await userResponse.json();

    // Check if user is banned
    const isBanned = userData.isBanned || false;

    // Filter out banned users if requested
    if (isBanned && !includeBanned) {
      return {
        verified: false,
        user: null,
      };
    }

    return {
      verified: true,
      user: {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName || userData.name,
        hasVerifiedBadge: userData.hasVerifiedBadge || false,
        banned: isBanned,
        created: userData.created,
      },
    };
  } catch (error) {
    console.error('Roblox API search error:', error);
    throw new Error('Failed to search Roblox user');
  }
}
