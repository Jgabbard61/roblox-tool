/**
 * GET /api/credits/balance
 * 
 * Returns the current credit balance for the authenticated user's customer
 * 
 * Requires:
 * - Authentication (JWT token)
 * - User must belong to a customer (customer_id not null)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCustomerCredits } from '@/app/lib/credits';

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

    // Get credit balance
    const credits = await getCustomerCredits(customerIdInt);

    if (!credits) {
      // Return zero balance if no credit account exists
      return NextResponse.json({
        balance: 0,
        total_purchased: 0,
        total_used: 0,
        last_purchase_at: null,
      });
    }

    return NextResponse.json({
      balance: credits.balance,
      total_purchased: credits.total_purchased,
      total_used: credits.total_used,
      last_purchase_at: credits.last_purchase_at,
    });
  } catch (error) {
    console.error('[Credits Balance Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 }
    );
  }
}
