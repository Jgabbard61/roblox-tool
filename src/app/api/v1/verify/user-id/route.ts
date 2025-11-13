
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, deductCredits } from '@/app/lib/api-auth';
import { withCache, generateCacheKey, CACHE_TTL } from '@/app/lib/utils/cache';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/verify/user-id
 * Verifies a Roblox user by user ID
 * 
 * Request body:
 * {
 *   "userId": 123456,
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
      const { userId, includeBanned = false } = body;

      // Validate input
      if (!userId || typeof userId !== 'number') {
        return NextResponse.json(
          { error: 'userId is required and must be a number' },
          { status: 400 }
        );
      }

      if (userId < 1) {
        return NextResponse.json(
          { error: 'userId must be a positive integer' },
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
        { userId, includeBanned },
        'api:verify:userid'
      );

      const { data: cachedData, fromCache } = await withCache(
        cacheKey,
        async () => {
          // Fetch user from Roblox API
          const userResult = await fetchRobloxUserById(userId, includeBanned);
          return userResult;
        },
        { ttl: CACHE_TTL.EXACT_SEARCH }
      );

      // Always deduct credits regardless of cache status
      await deductCredits(
        context.customer.id,
        1,
        `User ID verification: ${userId}${fromCache ? ' (cached)' : ''}`
      );
      const creditsUsed = 1;

      // Log the search only if it's not from cache
      if (!fromCache) {
        await query(
          `INSERT INTO search_history 
           (search_query, result_found, customer_id, search_mode, user_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `id:${userId}`,
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
      console.error('User ID verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify user ID',
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
 * Fetches a Roblox user by user ID
 */
async function fetchRobloxUserById(
  userId: number,
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
    // Call Roblox API to get user by ID
    const userResponse = await fetch(
      `https://users.roblox.com/v1/users/${userId}`
    );

    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        return {
          verified: false,
          user: null,
        };
      }
      throw new Error(`Roblox API error: ${userResponse.statusText}`);
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
    console.error('Roblox API fetch user error:', error);
    throw new Error('Failed to fetch Roblox user');
  }
}

/**
 * GET /api/v1/verify/user-id?userId=123456
 * Alternative GET endpoint for user ID verification
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const { searchParams } = new URL(request.url);
      const userIdParam = searchParams.get('userId');
      const includeBanned = searchParams.get('includeBanned') === 'true';

      if (!userIdParam) {
        return NextResponse.json(
          { error: 'userId query parameter is required' },
          { status: 400 }
        );
      }

      const userId = parseInt(userIdParam);
      if (isNaN(userId) || userId < 1) {
        return NextResponse.json(
          { error: 'userId must be a positive integer' },
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
        { userId, includeBanned },
        'api:verify:userid'
      );

      const { data: cachedData, fromCache } = await withCache(
        cacheKey,
        async () => {
          return await fetchRobloxUserById(userId, includeBanned);
        },
        { ttl: CACHE_TTL.EXACT_SEARCH }
      );

      // Always deduct credits regardless of cache status
      await deductCredits(
        context.customer.id,
        1,
        `User ID verification: ${userId}${fromCache ? ' (cached)' : ''}`
      );
      const creditsUsed = 1;

      // Log the search only if it's not from cache
      if (!fromCache) {
        await query(
          `INSERT INTO search_history 
           (search_query, result_found, customer_id, search_mode, user_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `id:${userId}`,
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
      console.error('User ID verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify user ID',
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
