/**
 * POST /api/credits/checkout
 * 
 * Creates a Stripe Checkout session for purchasing credits
 * 
 * Request body:
 * - packageId: Credit package ID to purchase
 * 
 * Requires:
 * - Authentication (JWT token)
 * - User must belong to a customer (customer_id not null)
 * 
 * Returns:
 * - sessionId: Stripe Checkout session ID
 * - checkoutUrl: URL to redirect user to Stripe Checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCreditPackageById } from '@/app/lib/credits';
import { query } from '@/app/lib/db';
import { STRIPE_API_VERSION, getStripeSecretKey } from '@/app/lib/constants/stripe';

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey(), {
  apiVersion: STRIPE_API_VERSION,
});

export async function POST(request: NextRequest) {
  try {
    // Get user info from middleware headers
    const userId = request.headers.get('X-User-Id');
    const customerId = request.headers.get('X-Customer-Id');
    
    // Validate authentication
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate customer ID
    if (!customerId || customerId === 'null') {
      return NextResponse.json(
        { error: 'Customer ID required. Super admins cannot purchase credits.' },
        { status: 400 }
      );
    }

    const customerIdInt = parseInt(customerId);
    const userIdInt = parseInt(userId);

    // Parse request body
    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID required' },
        { status: 400 }
      );
    }

    // Get credit package
    const creditPackage = await getCreditPackageById(packageId);

    if (!creditPackage || !creditPackage.is_active) {
      return NextResponse.json(
        { error: 'Invalid or inactive credit package' },
        { status: 404 }
      );
    }

    // Get customer info from database
    const customerResult = await query(
      `SELECT c.id, c.name, c.contact_email, c.stripe_customer_id,
              u.email, u.username, u.full_name
       FROM customers c
       JOIN users u ON u.customer_id = c.id
       WHERE c.id = $1 AND u.id = $2`,
      [customerIdInt, userIdInt]
    );

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer or user not found' },
        { status: 404 }
      );
    }

    const customer = customerResult.rows[0];

    // Create or retrieve Stripe customer
    let stripeCustomerId = customer.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: customer.email || customer.contact_email,
        name: customer.full_name || customer.username,
        metadata: {
          customer_id: customerIdInt.toString(),
          customer_name: customer.name,
          user_id: userIdInt.toString(),
        },
      });

      stripeCustomerId = stripeCustomer.id;

      // Save Stripe customer ID to database
      await query(
        'UPDATE customers SET stripe_customer_id = $1 WHERE id = $2',
        [stripeCustomerId, customerIdInt]
      );
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: creditPackage.price, // Amount in cents
            product_data: {
              name: creditPackage.name,
              description: `${creditPackage.credits} credits for VerifyLens - Roblox User Verification`,
              images: [], // Optional: Add product images
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL || process.env.APP_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL || process.env.APP_URL}/dashboard?payment=cancelled`,
      metadata: {
        customer_id: customerIdInt.toString(),
        user_id: userIdInt.toString(),
        package_id: packageId.toString(),
        credits: creditPackage.credits.toString(),
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error('[Stripe Checkout Error]:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
