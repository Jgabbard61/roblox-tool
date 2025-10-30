import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * POST /api/credits/purchase
 * Creates a Stripe checkout session for purchasing credit packages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.customerId || !session?.user?.customerName) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Fetch the credit package
    const packageResult = await query(
      `SELECT id, name, credits, price_cents, is_active
       FROM credit_packages
       WHERE id = $1 AND is_active = true`,
      [packageId]
    );

    if (packageResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Credit package not found or inactive' },
        { status: 404 }
      );
    }

    const creditPackage = packageResult.rows[0];

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: creditPackage.name,
              description: `${creditPackage.credits} credits for VerifyLens - Roblox User Verification Tool`,
              images: ['https://verifylens.abacusai.app/verifylens-logo.png'],
            },
            unit_amount: creditPackage.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard?purchase=cancelled`,
      client_reference_id: session.user.customerId.toString(),
      customer_email: session.user.email || undefined,
      metadata: {
        customer_id: session.user.customerId.toString(),
        customer_name: session.user.customerName,
        package_id: creditPackage.id.toString(),
        credits: creditPackage.credits.toString(),
        user_id: session.user.id?.toString() || '',
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: stripeSession.id,
      url: stripeSession.url,
    });
  } catch (error) {
    console.error('Error creating purchase session:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase session' },
      { status: 500 }
    );
  }
}
