import { NextResponse, NextRequest } from 'next/server';
import { logSearch } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  const start = Date.now();
  
  // Get user info from headers (set by middleware)
  const userId = request.headers.get('X-User-Id');
  const customerId = request.headers.get('X-Customer-Id');

  const body = await request.json();
  const { username, includeBanned } = body;

  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: !includeBanned }),
    });
    const data = await response.json();
    
    // Log exact search to database (async, don't wait)
    if (userId) {
      const responseTime = Date.now() - start;
      const firstResult = data.data && data.data.length > 0 ? data.data[0] : null;
      
      logSearch({
        userId: parseInt(userId),
        customerId: customerId && customerId !== 'null' ? parseInt(customerId) : null,
        searchType: 'username',
        searchMode: 'exact', // This is an exact search
        searchQuery: username,
        robloxUsername: firstResult?.name,
        robloxUserId: firstResult?.id,
        robloxDisplayName: firstResult?.displayName,
        hasVerifiedBadge: firstResult?.hasVerifiedBadge,
        resultData: data,
        resultCount: data.data?.length || 0,
        resultStatus: firstResult ? 'success' : 'no_results',
        responseTimeMs: responseTime,
      }).catch(err => {
        console.error('Failed to log search:', err);
        // Don't fail the request if logging fails
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Roblox API error:', error);
    return NextResponse.json({ error: 'Failed to fetch from Roblox' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  
  // Get user info from headers (set by middleware)
  const userId = request.headers.get('X-User-Id');
  const customerId = request.headers.get('X-Customer-Id');

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('userId');

  if (!userIdParam) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://users.roblox.com/v1/users/${userIdParam}`);
    const data = await response.json();
    
    // Log exact search by userId to database (async, don't wait)
    if (userId) {
      const responseTime = Date.now() - start;
      
      logSearch({
        userId: parseInt(userId),
        customerId: customerId && customerId !== 'null' ? parseInt(customerId) : null,
        searchType: 'userId',
        searchMode: 'exact', // This is an exact search
        searchQuery: userIdParam,
        robloxUsername: data.name,
        robloxUserId: data.id,
        robloxDisplayName: data.displayName,
        hasVerifiedBadge: data.hasVerifiedBadge,
        resultData: data,
        resultCount: data.id ? 1 : 0,
        resultStatus: data.id ? 'success' : 'no_results',
        responseTimeMs: responseTime,
      }).catch(err => {
        console.error('Failed to log search:', err);
        // Don't fail the request if logging fails
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Roblox API error:', error);
    return NextResponse.json({ error: 'Failed to fetch from Roblox' }, { status: 500 });
  }
}