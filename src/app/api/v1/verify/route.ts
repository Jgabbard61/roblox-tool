import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, deductCredits, ApiAuthContext } from '@/app/lib/api-auth';
import { withCache, generateCacheKey, CACHE_TTL } from '@/app/lib/utils/cache';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/verify
 * General verification endpoint that accepts username, userId, or batch requests
 * 
 * Request body:
 * {
 *   "username": "JohnDoe", // For username verification
 *   OR
 *   "userId": 123456, // For user ID verification
 *   OR
 *   "usernames": ["John", "Jane"], // For batch verification
 *   
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
      const { username, userId, usernames, includeBanned = false } = body;

      // Determine verification type
      if (username) {
        // Single username verification
        return await verifyUsername(username, includeBanned, context);
      } else if (userId) {
        // Single user ID verification
        return await verifyUserId(userId, includeBanned, context);
      } else if (usernames && Array.isArray(usernames)) {
        // Batch verification
        return await verifyBatch(usernames, includeBanned, context);
      } else {
        return NextResponse.json(
          { 
            error: 'Either username, userId, or usernames array is required',
            details: 'Provide one of: username (string), userId (number), or usernames (array)'
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify',
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
 * Verify a single username
 */
async function verifyUsername(
  username: string,
  includeBanned: boolean,
  context: ApiAuthContext
) {
  // Validate input
  if (typeof username !== 'string' || username.trim().length === 0) {
    return NextResponse.json(
      { error: 'username must be a non-empty string' },
      { status: 400 }
    );
  }

  const trimmedUsername = username.trim();

  // Check if customer has enough credits
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
      return await searchRobloxUser(trimmedUsername, includeBanned);
    },
    { ttl: CACHE_TTL.EXACT_SEARCH }
  );

  // Always deduct credits regardless of cache status
  await deductCredits(
    context.customer.id,
    1,
    `Username verification: ${trimmedUsername}${fromCache ? ' (cached)' : ''}`
  );
  const creditsUsed = 1;

  // Log the search only if it's not from cache
  if (!fromCache) {
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
}

/**
 * Verify a single user ID
 */
async function verifyUserId(
  userId: number,
  includeBanned: boolean,
  context: ApiAuthContext
) {
  // Validate input
  if (typeof userId !== 'number' || userId <= 0) {
    return NextResponse.json(
      { error: 'userId must be a positive number' },
      { status: 400 }
    );
  }

  // Check if customer has enough credits
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
        userId.toString(),
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
}

/**
 * Verify multiple usernames in batch
 */
async function verifyBatch(
  usernames: string[],
  includeBanned: boolean,
  context: ApiAuthContext
) {
  // Validate input
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return NextResponse.json(
      { error: 'usernames must be a non-empty array' },
      { status: 400 }
    );
  }

  if (usernames.length > 100) {
    return NextResponse.json(
      { error: 'Maximum 100 usernames per batch request' },
      { status: 400 }
    );
  }

  // Check if customer has enough credits
  const creditsNeeded = usernames.length;
  if (context.customer.credits < creditsNeeded) {
    return NextResponse.json(
      { 
        error: 'Insufficient credits',
        details: `Need ${creditsNeeded} credits, have ${context.customer.credits}`,
      },
      { status: 402 }
    );
  }

  // Process each username
  const results = [];
  let totalCreditsUsed = 0;

  for (const username of usernames) {
    if (typeof username !== 'string' || username.trim().length === 0) {
      results.push({
        username,
        success: false,
        error: 'Invalid username',
      });
      continue;
    }

    const trimmedUsername = username.trim();
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

    // Always count credits regardless of cache status
    totalCreditsUsed += 1;

    // Log the search only if it's not from cache
    if (!fromCache) {
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

    results.push({
      username: trimmedUsername,
      success: true,
      ...cachedData,
      fromCache,
    });
  }

  // Deduct credits for all requests (both cached and non-cached)
  if (totalCreditsUsed > 0) {
    await deductCredits(
      context.customer.id,
      totalCreditsUsed,
      `Batch verification: ${usernames.length} usernames`
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      results,
      totalCreditsUsed,
      processed: usernames.length,
    },
  });
}

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
      hasVerifiedBadge?: boolean;
      created?: string;
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
 * Fetches a Roblox user by ID
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
    // Get user information by ID
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
    console.error('Roblox API user ID fetch error:', error);
    throw new Error('Failed to fetch Roblox user by ID');
  }
}
