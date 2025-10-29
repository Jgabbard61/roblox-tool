/**
 * POST /api/credits/webhook
 * 
 * Handles Stripe webhook events
 * 
 * Primary event: checkout.session.completed
 * - Adds credits to customer account
 * - Logs payment in stripe_payments table
 * - Sends purchase confirmation email
 * - Sends welcome email (if first purchase)
 * 
 * This endpoint is public but validates Stripe signature
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits, logStripePayment, initializeCustomerCredits } from '@/app/lib/credits';
import { sendPurchaseConfirmationEmail, sendWelcomeEmail } from '@/app/lib/email';
import { query } from '@/app/lib/db';
import * as bcrypt from 'bcrypt';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Webhook secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Received event:', event.type);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[Webhook] Processing checkout session:', session.id);

      // Extract metadata
      const customerId = parseInt(session.metadata?.customer_id || '0');
      const userId = parseInt(session.metadata?.user_id || '0');
      const packageId = parseInt(session.metadata?.package_id || '0');
      const credits = parseInt(session.metadata?.credits || '0');

      if (!customerId || !credits) {
        console.error('[Webhook] Missing required metadata:', session.metadata);
        return NextResponse.json(
          { error: 'Missing required metadata' },
          { status: 400 }
        );
      }

      // Get customer and user info
      const customerResult = await query(
        `SELECT c.id, c.name, c.contact_email,
                u.id as user_id, u.email, u.username, u.full_name, u.password_hash, u.email_verified
         FROM customers c
         LEFT JOIN users u ON u.customer_id = c.id AND u.id = $2
         WHERE c.id = $1`,
        [customerId, userId || null]
      );

      if (customerResult.rows.length === 0) {
        console.error('[Webhook] Customer not found:', customerId);
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const customer = customerResult.rows[0];
      const isFirstPurchase = userId && customer.user_id; // New: first purchase for registered user

      // Initialize credit account if doesn't exist
      await initializeCustomerCredits(customerId);

      // Add credits to customer account
      const transaction = await addCredits({
        customerId,
        userId: userId || undefined,
        amount: credits,
        paymentId: session.payment_intent as string,
        description: `Purchased ${credits} credits via Stripe`,
      });

      console.log('[Webhook] Credits added:', transaction);

      // Log Stripe payment
      await logStripePayment({
        customerId,
        userId: userId || undefined,
        stripePaymentIntentId: session.payment_intent as string,
        stripeCustomerId: session.customer as string,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        credits,
        packageId: packageId || undefined,
        status: 'completed',
        metadata: session.metadata || {},
      });

      // Send emails
      try {
        if (isFirstPurchase && customer.user_id) {
          // New flow: User registered from lander, send welcome email with login link
          await sendWelcomeEmail({
            email: customer.email || customer.contact_email,
            customerName: customer.full_name || customer.name,
            username: customer.username,
            tempPassword: '', // Empty since user set their own password during registration
            credits,
            loginUrl: `${process.env.APP_URL || process.env.NEXTAUTH_URL}/auth/signin`,
          });
        } else if (!customer.user_id) {
          // Old flow: Legacy checkout without registration (shouldn't happen with new flow)
          // Generate temporary password
          const tempPassword = generateTempPassword();
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          // Create user account
          const username = generateUsername(customer.name);
          await query(
            `INSERT INTO users (username, password_hash, role, customer_id, email, is_active)
             VALUES ($1, $2, 'CUSTOMER_ADMIN', $3, $4, true)`,
            [username, passwordHash, customerId, customer.email || customer.contact_email]
          );

          // Send welcome email with temp password
          await sendWelcomeEmail({
            email: customer.email || customer.contact_email,
            customerName: customer.name,
            username,
            tempPassword,
            credits,
            loginUrl: `${process.env.APP_URL || process.env.NEXTAUTH_URL}/auth/signin`,
          });
        } else {
          // Subsequent purchases: Send purchase confirmation email
          await sendPurchaseConfirmationEmail({
            email: customer.email || customer.contact_email,
            customerName: customer.full_name || customer.name,
            credits,
            amountPaid: (session.amount_total || 0) / 100, // Convert cents to dollars
            newBalance: transaction.balance_after,
          });
        }
      } catch (emailError) {
        console.error('[Webhook] Failed to send email:', emailError);
        // Don't fail the webhook if email fails
      }

      return NextResponse.json({ received: true, creditsAdded: credits });
    }

    // Handle other event types if needed
    console.log('[Webhook] Unhandled event type:', event.type);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook Error]:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Helper: Generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Helper: Generate username from customer name
function generateUsername(customerName: string): string {
  // Convert to lowercase, remove spaces and special chars
  const base = customerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  
  // Add random suffix
  const suffix = Math.floor(Math.random() * 1000);
  return `${base}${suffix}`;
}
