import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, deductCredits } from '@/app/lib/api-auth';
import { withCache, generateCacheKey, CACHE_TTL } from '@/app/lib/utils/cache';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/verify/username
 * Verifies a Roblox username
 * 
 * Request body:
 * {
 *   "username": "JohnDoe",
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
 *     "verified": true,
 *     "user": {
 *       "id": 123456,
 *       "username": "JohnDoe",
 *       "displayName": "John Doe",
 *       "hasVerifiedBadge": false,
 *       "banned": false,
 *       "created": "2020-01-01T00:00:00.000Z"
 *     },
 *     "creditsUsed": 1
 *   }
 * }
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      // Parse request body
      const body = await request.json();
      const { username, includeBanned = false } = body;

      // Validate input
      if (!username || typeof username !== 'string') {
        return NextResponse.json(
          { error: 'username is required and must be a string' },
          { status: 400 }
        );
      }

      const trimmedUsername = username.trim();
      if (trimmedUsername.length === 0) {
        return NextResponse.json(
          { error: 'username cannot be empty' },
          { status: 400 }
        );
      }

      // Check if customer has enough credits (1 credit per search)
      if (context.customer.credits < 1) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.' },
          { status: 402 }
        );
      }

      // Try to get from cache first
      const cacheKey = generateCacheKey(
        { username: trimmedUsername.toLowerCase(), includeBanned },
        'api:verify:username'
      );

      const { data: cachedData, fromCache } = await withCache(
        cacheKey,
        async () => {
          // Search Roblox API
          const searchResult = await searchRobloxUser(trimmedUsername, includeBanned);
          return searchResult;
        },
        { ttl: CACHE_TTL.EXACT_SEARCH }
      );

      // Only deduct credits if it's not from cache
      let creditsUsed = 0;
      if (!fromCache) {
        await deductCredits(
          context.customer.id,
          1,
          `Username verification: ${trimmedUsername}`
        );
        creditsUsed = 1;

        // Log the search
        await query(
          `INSERT INTO search_history 
           (search_query, result_found, customer_id, search_mode, user_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            trimmedUsername,
            cachedData.verified,
            context.customer.id,
            'exact',
            JSON.stringify(cachedData.user),
          ]
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...cachedData,
          creditsUsed,
          fromCache,
        },
      });
    } catch (error) {
      console.error('Username verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify username',
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

/**
 * GET /api/v1/verify/username?username=JohnDoe
 * Alternative GET endpoint for username verification
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const { searchParams } = new URL(request.url);
      const username = searchParams.get('username');
      const includeBanned = searchParams.get('includeBanned') === 'true';

      if (!username) {
        return NextResponse.json(
          { error: 'username query parameter is required' },
          { status: 400 }
        );
      }

      // Check credits
      if (context.customer.credits < 1) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please purchase more credits.' },
          { status: 402 }
        );
      }

      // Use cache
      const cacheKey = generateCacheKey(
        { username: username.toLowerCase(), includeBanned },
        'api:verify:username'
      );

      const { data: cachedData, fromCache } = await withCache(
        cacheKey,
        async () => {
          return await searchRobloxUser(username, includeBanned);
        },
        { ttl: CACHE_TTL.EXACT_SEARCH }
      );

      // Deduct credits if not from cache
      let creditsUsed = 0;
      if (!fromCache) {
        await deductCredits(
          context.customer.id,
          1,
          `Username verification: ${username}`
        );
        creditsUsed = 1;

        // Log the search
        await query(
          `INSERT INTO search_history 
           (search_query, result_found, customer_id, search_mode, user_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            username,
            cachedData.verified,
            context.customer.id,
            'exact',
            JSON.stringify(cachedData.user),
          ]
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...cachedData,
          creditsUsed,
          fromCache,
        },
      });
    } catch (error) {
      console.error('Username verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify username',
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
