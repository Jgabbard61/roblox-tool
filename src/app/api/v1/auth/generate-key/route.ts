import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { createApiClient, createApiKey, getApiClients } from '@/app/lib/api-key';
import { query } from '@/app/lib/db';

/**
 * POST /api/v1/auth/generate-key
 * Generates a new API key for the authenticated customer
 * 
 * Request body:
 * {
 *   "name": "My API Key",
 *   "scopes": ["verify:read", "credits:read"],
 *   "rateLimit": 1000,
 *   "expiresInDays": 90,
 *   "clientName": "My Application" // Optional, creates new client if not exists
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const customerId = parseInt(session.user.customerId);

    // Parse request body
    const body = await request.json();
    const {
      name,
      scopes = ['verify:read', 'credits:read'],
      rateLimit = 1000,
      expiresInDays,
      clientName = 'Web Application',
      clientDescription,
      webhookUrl,
    } = body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    if (rateLimit < 1 || rateLimit > 10000) {
      return NextResponse.json(
        { error: 'Rate limit must be between 1 and 10000 requests per hour' },
        { status: 400 }
      );
    }

    // Valid scopes
    const validScopes = [
      'verify:read',    // Can use verification endpoints
      'verify:write',   // Reserved for future
      'credits:read',   // Can check credit balance
      'credits:write',  // Can purchase credits
      'usage:read',     // Can view usage statistics
      '*',              // All permissions (admin only)
    ];

    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get or create API client
    let apiClientId: number;
    const existingClients = await getApiClients(customerId);
    
    if (existingClients.length > 0) {
      // Use the first existing client
      apiClientId = existingClients[0].id;
    } else {
      // Create a new API client
      apiClientId = await createApiClient(
        customerId,
        clientName,
        clientDescription,
        webhookUrl
      );
    }

    // Generate API key
    const { apiKey, keyData } = await createApiKey(
      apiClientId,
      name,
      scopes,
      {
        rateLimit,
        expiresInDays,
        isProduction: process.env.NODE_ENV === 'production',
      }
    );

    // Return the API key (only time it's visible!)
    return NextResponse.json({
      success: true,
      data: {
        apiKey, // IMPORTANT: Store this securely - it won't be shown again
        keyId: keyData.id,
        keyPrefix: keyData.key_prefix,
        name: keyData.name,
        scopes: keyData.scopes,
        rateLimit: keyData.rate_limit,
        expiresAt: keyData.expires_at,
        createdAt: keyData.created_at,
      },
      message: 'API key generated successfully. Save it securely - it cannot be retrieved later.',
    });
  } catch (error) {
    console.error('Generate API key error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/auth/generate-key
 * Lists all API keys for the authenticated customer (with sensitive data masked)
 */
export async function GET() {
  try {
    // Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const customerId = parseInt(session.user.customerId);

    // Get all API clients and their keys
    const result = await query(
      `SELECT 
        ak.id,
        ak.api_client_id,
        ak.key_prefix,
        ak.name,
        ak.scopes,
        ak.rate_limit,
        ak.is_active,
        ak.last_used_at,
        ak.expires_at,
        ak.created_at,
        ac.name as client_name
       FROM api_keys ak
       JOIN api_clients ac ON ak.api_client_id = ac.id
       WHERE ac.customer_id = $1
       ORDER BY ak.created_at DESC`,
      [customerId]
    );

    const apiKeys = result.rows.map((key) => ({
      id: key.id,
      keyPrefix: key.key_prefix,
      name: key.name,
      scopes: key.scopes,
      rateLimit: key.rate_limit,
      isActive: key.is_active,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      createdAt: key.created_at,
      clientName: key.client_name,
    }));

    return NextResponse.json({
      success: true,
      data: {
        apiKeys,
        count: apiKeys.length,
      },
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list API keys',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/auth/generate-key?keyId=123
 * Revokes (deactivates) an API key
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const customerId = parseInt(session.user.customerId);
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json(
        { error: 'keyId parameter is required' },
        { status: 400 }
      );
    }

    // Verify the API key belongs to this customer
    const keyResult = await query(
      `SELECT ak.id
       FROM api_keys ak
       JOIN api_clients ac ON ak.api_client_id = ac.id
       WHERE ak.id = $1 AND ac.customer_id = $2`,
      [parseInt(keyId), customerId]
    );

    if (keyResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'API key not found or does not belong to you' },
        { status: 404 }
      );
    }

    // Revoke the key
    await query(
      'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1',
      [parseInt(keyId)]
    );

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
