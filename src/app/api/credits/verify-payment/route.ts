
/**
 * GET /api/credits/verify-payment?session_id=xxx
 * 
 * Verifies a Stripe checkout session and manually processes credit addition
 * if webhook hasn't fired yet (common in test/sandbox mode)
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/app/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed', status: session.payment_status },
        { status: 400 }
      );
    }

    const customerId = parseInt(session.metadata?.customer_id || '0', 10);
    const packageId = parseInt(session.metadata?.package_id || '0', 10);
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const userId = parseInt(session.metadata?.user_id || '0', 10);
    const paymentIntentId = session.payment_intent as string;
    const amountPaid = session.amount_total || 0;

    if (!customerId || !packageId || !credits) {
      return NextResponse.json(
        { error: 'Invalid session metadata' },
        { status: 400 }
      );
    }

    // Check if this payment has already been processed
    const existingTransaction = await query(
      'SELECT id FROM credit_transactions WHERE stripe_payment_intent_id = $1',
      [paymentIntentId]
    );

    if (existingTransaction.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        alreadyProcessed: true,
      });
    }

    // Process the payment manually
    try {
      // Begin transaction
      await query('BEGIN', []);

      // Get current balance
      const currentBalanceResult = await query(
        'SELECT balance FROM customer_credits WHERE customer_id = $1',
        [customerId]
      );

      const balanceBefore = currentBalanceResult.rows.length > 0 
        ? currentBalanceResult.rows[0].balance 
        : 0;

      // Update or create customer credits
      const updateResult = await query(
        `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
         VALUES ($1, $2, $2, 0)
         ON CONFLICT (customer_id) 
         DO UPDATE SET 
           balance = customer_credits.balance + $2,
           total_purchased = customer_credits.total_purchased + $2,
           updated_at = CURRENT_TIMESTAMP
         RETURNING balance`,
        [customerId, credits]
      );

      const newBalance = updateResult.rows[0].balance;

      // Record the transaction (matching actual schema)
      await query(
        `INSERT INTO credit_transactions 
         (customer_id, user_id, transaction_type, amount, balance_before, balance_after, 
          stripe_payment_intent_id, description)
         VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7)`,
        [
          customerId,
          userId || customerId, // Use customerId as fallback since user_id is NOT NULL
          credits,
          balanceBefore,
          newBalance,
          paymentIntentId,
          `Purchased ${credits} credits (Package ID: ${packageId}, Amount: $${(amountPaid / 100).toFixed(2)})`,
        ]
      );

      // Commit transaction
      await query('COMMIT', []);

      console.log(`[Manual Payment Processing] Successfully added ${credits} credits to customer ${customerId}`);

      return NextResponse.json({
        success: true,
        message: 'Credits added successfully',
        creditsAdded: credits,
        newBalance: newBalance,
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK', []);
      console.error('[Manual Payment Processing] Error:', error);
      throw error;
    }
  } catch (error) {
    console.error('[Verify Payment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
