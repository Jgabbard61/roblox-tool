// FILE: src/app/api/friends/[userId]/route.ts
// Friends list API endpoint - fetches friends data with pagination support

import { NextResponse } from 'next/server';

interface RobloxFriend {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  isOnline?: boolean;
  presenceType?: number;
}

interface FriendWithAvatar extends RobloxFriend {
  avatarUrl: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Fetch friends list from Roblox API
    const friendsResponse = await fetch(
      `https://friends.roblox.com/v1/users/${userId}/friends`
    );

    if (!friendsResponse.ok) {
      if (friendsResponse.status === 400) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
      }
      throw new Error('Failed to fetch friends list');
    }

    const friendsData = await friendsResponse.json();
    const friends: RobloxFriend[] = friendsData.data || [];

    // Debug: Log first friend to check data structure
    if (friends.length > 0) {
      console.log('Sample friend data:', JSON.stringify(friends[0], null, 2));
    }

    // If there are no friends, return empty list
    if (friends.length === 0) {
      return NextResponse.json({
        friends: [],
        count: 0
      });
    }

    // Fetch online presence for friends (in batches of 50 due to API limits)
    const presenceData: Record<string, { userPresenceType: number; lastOnline: string }> = {};
    
    try {
      // Split friends into batches of 50
      const batchSize = 50;
      for (let i = 0; i < friends.length; i += batchSize) {
        const batch = friends.slice(i, i + batchSize);
        
        const presenceResponse = await fetch(
          'https://presence.roblox.com/v1/presence/users',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userIds: batch.map(f => f.id)
            })
          }
        );

        if (presenceResponse.ok) {
          const presenceJson = await presenceResponse.json();
          presenceJson.userPresences?.forEach((presence: { userId: string; userPresenceType: number; lastOnline: string }) => {
            presenceData[presence.userId] = {
              userPresenceType: presence.userPresenceType,
              lastOnline: presence.lastOnline
            };
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch presence data:', error);
      // Continue without presence data
    }

    // Add avatar URLs and presence data
    const friendsWithDetails: FriendWithAvatar[] = friends.map(friend => ({
      id: friend.id,
      name: friend.name || '', // Ensure name is never undefined
      displayName: friend.displayName || friend.name || 'Unknown',
      hasVerifiedBadge: friend.hasVerifiedBadge || false,
      avatarUrl: `/api/thumbnail?userId=${friend.id}`,
      isOnline: presenceData[friend.id]?.userPresenceType === 2 || presenceData[friend.id]?.userPresenceType === 3,
      presenceType: presenceData[friend.id]?.userPresenceType || 0
    }));

    // Sort friends: online first, then by display name
    friendsWithDetails.sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({
      friends: friendsWithDetails,
      count: friendsWithDetails.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache
      },
    });

  } catch (error) {
    console.error('Friends API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch friends list',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
