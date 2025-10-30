
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/credits/transactions
 * Fetches the credit transaction history for the authenticated user's customer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = session.user.customerId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch transaction history
    const result = await query(
      `SELECT 
        ct.id,
        ct.transaction_type,
        ct.amount,
        ct.balance_before,
        ct.balance_after,
        ct.description,
        ct.stripe_payment_intent_id,
        ct.created_at,
        u.username as user_username
      FROM credit_transactions ct
      LEFT JOIN users u ON ct.user_id = u.id
      WHERE ct.customer_id = $1
      ORDER BY ct.created_at DESC
      LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM credit_transactions
       WHERE customer_id = $1`,
      [customerId]
    );

    return NextResponse.json({
      success: true,
      transactions: result.rows,
      total: parseInt(countResult.rows[0]?.total || '0', 10),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction history' },
      { status: 500 }
    );
  }
}
