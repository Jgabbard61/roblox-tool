
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import Stripe from 'stripe';
import { STRIPE_API_VERSION, getWebhookSecret, getStripeSecretKey } from '@/app/lib/constants/stripe';

// Initialize Stripe with validated credentials
const stripe = new Stripe(getStripeSecretKey(), {
  apiVersion: STRIPE_API_VERSION,
});

// Get webhook secret with validation (will throw if not set)
const webhookSecret = getWebhookSecret();

/**
 * POST /api/credits/webhook
 * Handles Stripe webhook events for credit purchases
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;

      const customerId = parseInt(checkoutSession.metadata?.customer_id || '0', 10);
      const packageId = parseInt(checkoutSession.metadata?.package_id || '0', 10);
      const credits = parseInt(checkoutSession.metadata?.credits || '0', 10);
      const userId = parseInt(checkoutSession.metadata?.user_id || '0', 10);
      const paymentIntentId = checkoutSession.payment_intent as string;
      const amountPaid = checkoutSession.amount_total || 0;

      if (!customerId || !packageId || !credits) {
        console.error('Invalid metadata in checkout session:', checkoutSession.metadata);
        return NextResponse.json(
          { error: 'Invalid session metadata' },
          { status: 400 }
        );
      }

      try {
        // Begin transaction
        await query('BEGIN', []);

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

        // Record the transaction
        await query(
          `INSERT INTO credit_transactions 
           (customer_id, user_id, transaction_type, amount, balance_after, 
            credit_package_id, stripe_payment_intent_id, payment_amount_cents, description)
           VALUES ($1, $2, 'purchase', $3, $4, $5, $6, $7, $8)`,
          [
            customerId,
            userId || null,
            credits,
            newBalance,
            packageId,
            paymentIntentId,
            amountPaid,
            `Purchased ${credits} credits via Stripe`,
          ]
        );

        // Commit transaction
        await query('COMMIT', []);

        console.log(`Successfully added ${credits} credits to customer ${customerId}`);
      } catch (error) {
        // Rollback on error
        await query('ROLLBACK', []);
        console.error('Error processing credit purchase:', error);
        throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
