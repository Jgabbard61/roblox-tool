import { NextResponse, NextRequest } from 'next/server';
import { logSearch } from '@/app/lib/db';
import { 
  checkSufficientCredits, 
  deductCredits, 
  getCustomerCredits 
} from '@/app/lib/credits';

export async function POST(request: NextRequest) {
  const start = Date.now();
  
  // Get user info from headers (set by middleware)
  const userId = request.headers.get('X-User-Id');
  const customerId = request.headers.get('X-Customer-Id');

  const body = await request.json();
  const { username, includeBanned } = body;

  // ============================================
  // CREDIT CHECK (for non-SUPER_ADMIN users)
  // ============================================
  if (customerId && customerId !== 'null') {
    const customerIdInt = parseInt(customerId);
    
    // Check if customer has sufficient credits (≥1)
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
        },
        { status: 402 } // 402 Payment Required
      );
    }
  }

  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: !includeBanned }),
    });
    const data = await response.json();
    
    // Log exact search to database and handle credit deduction
    if (userId) {
      const responseTime = Date.now() - start;
      const firstResult = data.data && data.data.length > 0 ? data.data[0] : null;
      
      const searchLogPromise = logSearch({
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
        return null;
      });

      // ============================================
      // CREDIT DEDUCTION (Exact search: Only if results found)
      // ============================================
      if (customerId && customerId !== 'null') {
        const customerIdInt = parseInt(customerId);
        const userIdInt = parseInt(userId);
        
        // Exact search: Only deduct if results found (valid user ID > 0)
        if (firstResult && firstResult.id && firstResult.id > 0) {
          searchLogPromise.then(searchLog => {
            const searchHistoryId = searchLog ? parseInt(searchLog as unknown as string) : undefined;
            
            deductCredits({
              customerId: customerIdInt,
              userId: userIdInt,
              amount: 1,
              searchHistoryId,
              description: `Exact search for "${username}" (results found)`,
            }).catch(err => {
              console.error('Failed to deduct credits:', err);
            });
          });
        } else {
          console.log(`[Credits] No deduction for exact search with no results: "${username}"`);
        }
      }
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

  // ============================================
  // CREDIT CHECK (for non-SUPER_ADMIN users)
  // ============================================
  if (customerId && customerId !== 'null') {
    const customerIdInt = parseInt(customerId);
    
    // Check if customer has sufficient credits (≥1)
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
        },
        { status: 402 } // 402 Payment Required
      );
    }
  }

  try {
    const response = await fetch(`https://users.roblox.com/v1/users/${userIdParam}`);
    const data = await response.json();
    
    // Log exact search by userId to database and handle credit deduction
    if (userId) {
      const responseTime = Date.now() - start;
      
      const searchLogPromise = logSearch({
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
        return null;
      });

      // ============================================
      // CREDIT DEDUCTION (Exact search: Only if results found)
      // ============================================
      if (customerId && customerId !== 'null') {
        const customerIdInt = parseInt(customerId);
        const userIdInt = parseInt(userId);
        
        // Exact search: Only deduct if results found (valid user ID > 0)
        if (data.id && data.id > 0) {
          searchLogPromise.then(searchLog => {
            const searchHistoryId = searchLog ? parseInt(searchLog as unknown as string) : undefined;
            
            deductCredits({
              customerId: customerIdInt,
              userId: userIdInt,
              amount: 1,
              searchHistoryId,
              description: `Exact search for user ID "${userIdParam}" (results found)`,
            }).catch(err => {
              console.error('Failed to deduct credits:', err);
            });
          });
        } else {
          console.log(`[Credits] No deduction for exact search with no results: ID "${userIdParam}"`);
        }
      }
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Roblox API error:', error);
    return NextResponse.json({ error: 'Failed to fetch from Roblox' }, { status: 500 });
  }
}