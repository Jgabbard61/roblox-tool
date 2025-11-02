
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/credits/balance
 * Fetches the current credit balance for the authenticated user's customer
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = session.user.customerId;

    // Fetch or create customer credits record
    await query(
      `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (customer_id) DO NOTHING`,
      [customerId]
    );

    const result = await query(
      `SELECT balance, total_purchased, total_used, created_at, updated_at
       FROM customer_credits
       WHERE customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch credit balance' },
        { status: 500 }
      );
    }

    const creditInfo = result.rows[0];

    return NextResponse.json({
      success: true,
      balance: creditInfo.balance,
      totalPurchased: creditInfo.total_purchased,
      totalUsed: creditInfo.total_used,
      createdAt: creditInfo.created_at,
      updatedAt: creditInfo.updated_at,
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 }
    );
  }
}
