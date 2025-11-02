
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/api-auth';
import { query } from '@/app/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

/**
 * POST /api/v1/credits/purchase
 * Initiates a credit purchase using Stripe
 * 
 * Request body:
 * {
 *   "packageId": 1, // Credit package ID from credit_packages table
 *   "returnUrl": "https://example.com/success", // Optional: URL to redirect after payment
 *   "cancelUrl": "https://example.com/cancel" // Optional: URL to redirect on cancel
 * }
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "sessionId": "cs_test_...",
 *     "sessionUrl": "https://checkout.stripe.com/...",
 *     "packageDetails": {
 *       "name": "Starter Pack",
 *       "credits": 10,
 *       "price": 1000
 *     }
 *   }
 * }
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const body = await request.json();
      const {
        packageId,
        returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      } = body;

      // Validate input
      if (!packageId || typeof packageId !== 'number') {
        return NextResponse.json(
          { error: 'packageId is required and must be a number' },
          { status: 400 }
        );
      }

      // Get credit package details
      const packageResult = await query(
        `SELECT * FROM credit_packages WHERE id = $1 AND is_active = true`,
        [packageId]
      );

      if (packageResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid or inactive credit package' },
          { status: 404 }
        );
      }

      const creditPackage = packageResult.rows[0];

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: creditPackage.name,
                description: `${creditPackage.credits} credits for VerifyLens - Roblox User Verification Tool`,
              },
              unit_amount: creditPackage.price_cents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: context.customer.id.toString(),
        metadata: {
          customerId: context.customer.id.toString(),
          packageId: packageId.toString(),
          credits: creditPackage.credits.toString(),
          apiKeyId: context.apiKey.id.toString(),
        },
        customer_email: context.customer.name, // Assuming name contains email or we can fetch it
      });

      // Log the purchase intent
      await query(
        `INSERT INTO stripe_payments 
         (customer_id, stripe_session_id, package_id, amount_cents, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [
          context.customer.id,
          session.id,
          packageId,
          creditPackage.price_cents,
        ]
      );

      return NextResponse.json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
          packageDetails: {
            id: creditPackage.id,
            name: creditPackage.name,
            credits: creditPackage.credits,
            priceCents: creditPackage.price_cents,
            priceUsd: (creditPackage.price_cents / 100).toFixed(2),
          },
        },
      });
    } catch (error) {
      console.error('Credit purchase error:', error);
      return NextResponse.json(
        {
          error: 'Failed to initiate credit purchase',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    requiredScope: 'credits:write',
  }
);

/**
 * GET /api/v1/credits/purchase?sessionId=cs_test_...
 * Checks the status of a Stripe checkout session
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const { searchParams } = new URL(request.url);
      const sessionId = searchParams.get('sessionId');

      if (!sessionId) {
        return NextResponse.json(
          { error: 'sessionId query parameter is required' },
          { status: 400 }
        );
      }

      // Verify session belongs to this customer
      const paymentResult = await query(
        `SELECT * FROM stripe_payments 
         WHERE stripe_session_id = $1 AND customer_id = $2`,
        [sessionId, context.customer.id]
      );

      if (paymentResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Payment session not found' },
          { status: 404 }
        );
      }

      const payment = paymentResult.rows[0];

      // Get session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return NextResponse.json({
        success: true,
        data: {
          sessionId: session.id,
          status: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          customerEmail: session.customer_email,
          paymentIntentId: session.payment_intent,
          localStatus: payment.status,
          creditsToAdd: payment.credits_purchased || 0,
        },
      });
    } catch (error) {
      console.error('Get purchase status error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get purchase status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    requiredScope: 'credits:read',
  }
);
