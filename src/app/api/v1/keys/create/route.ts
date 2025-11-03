import { NextRequest, NextResponse } from 'next/server';
import { createCustomerWithAdmin } from '@/app/lib/db';
import { createApiClient, createApiKey } from '@/app/lib/api-key';
import * as bcrypt from 'bcrypt';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/keys/create
 * Creates a new customer and generates an API key
 * 
 * This is a public endpoint for programmatic registration.
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "companyName": "My Company",
 *   "password": "SecurePassword123!" // Optional, minimum 8 characters
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "apiKey": "vrl_live_...",
 *     "customerId": 123,
 *     "companyName": "My Company",
 *     "email": "user@example.com"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email, companyName, password } = body;

    // Validate input
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    if (!companyName || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Validate password if provided
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if customer with this email already exists
    const existingUser = await query(
      'SELECT u.id, u.customer_id, c.name as customer_name FROM users u JOIN customers c ON u.customer_id = c.id WHERE u.email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          error: 'A customer with this email already exists',
          details: 'Please use the login page or contact support if you need help accessing your account',
        },
        { status: 409 }
      );
    }

    // Use provided password or generate a temporary one
    const passwordToUse = password || Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(passwordToUse, 12);

    // Create customer and admin user
    const { customer, user } = await createCustomerWithAdmin(
      companyName,
      email, // Use email as username
      passwordHash,
      email
    );

    // Create API client for the customer
    const apiClientId = await createApiClient(
      customer.id,
      `${companyName} - API Client`,
      `Auto-generated API client for ${companyName}`,
      undefined // No webhook URL
    );

    // Generate API key
    const { apiKey, keyData } = await createApiKey(
      apiClientId,
      'Primary API Key',
      ['verify:read', 'credits:read', 'credits:write', 'usage:read'], // Default scopes
      {
        rateLimit: 1000,
        expiresInDays: undefined, // No expiration
        isProduction: process.env.NODE_ENV === 'production',
      }
    );

    // Log the registration
    console.log('[API] New customer registered via API:', {
      customerId: customer.id,
      companyName: customer.name,
      email: user.email,
    });

    // Return the API key (only time it's visible!)
    return NextResponse.json({
      success: true,
      data: {
        apiKey, // IMPORTANT: Store this securely - it won't be shown again
        customerId: customer.id,
        companyName: customer.name,
        email: user.email,
        keyId: keyData.id,
        scopes: keyData.scopes,
        rateLimit: keyData.rate_limit,
      },
      message: 'Customer created successfully. Save your API key securely - it cannot be retrieved later.',
    });
  } catch (error) {
    console.error('[API] Create customer API key error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create customer and API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
