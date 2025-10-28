/**
 * GET /api/credits/transactions
 * 
 * Returns transaction history for the authenticated user's customer
 * 
 * Query parameters:
 * - limit: Maximum number of transactions to return (default: 50)
 * - offset: Number of transactions to skip (default: 0)
 * 
 * Requires:
 * - Authentication (JWT token)
 * - User must belong to a customer (customer_id not null)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactionHistory } from '@/app/lib/credits';

export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const customerId = request.headers.get('X-Customer-Id');
    
    // Validate customer ID
    if (!customerId || customerId === 'null') {
      return NextResponse.json(
        { error: 'Customer ID required. Super admins cannot use credits.' },
        { status: 400 }
      );
    }

    const customerIdInt = parseInt(customerId);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be non-negative' },
        { status: 400 }
      );
    }

    // Get transaction history
    const transactions = await getTransactionHistory(customerIdInt, limit, offset);

    return NextResponse.json({
      transactions,
      limit,
      offset,
      count: transactions.length,
    });
  } catch (error) {
    console.error('[Credits Transactions Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction history' },
      { status: 500 }
    );
  }
}
