import { NextRequest } from 'next/server';
import { validateApiKey } from './api-key';
import { checkRateLimit } from './rate-limit';
import { query } from './db';

export interface ApiAuthContext {
  apiKey: {
    id: number;
    api_client_id: number;
    customer_id: number;
    name: string;
    scopes: string[];
    rate_limit: number;
  };
  customer: {
    id: number;
    name: string;
    credits: number;
  };
}

export class ApiAuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

/**
 * Authenticates API requests using API keys
 * Validates the key, checks rate limits, and returns context
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiAuthContext> {
  // Extract API key from Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new ApiAuthError(401, 'Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiAuthError(401, 'Invalid Authorization header format. Use: Bearer <api_key>');
  }

  // Validate API key
  const apiKey = await validateApiKey(token);
  if (!apiKey) {
    throw new ApiAuthError(401, 'Invalid or expired API key');
  }

  // Check if API key is active
  if (!apiKey.is_active) {
    throw new ApiAuthError(403, 'API key is disabled');
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(
    apiKey.id,
    apiKey.rate_limit
  );
  
  if (!rateLimitResult.allowed) {
    throw new ApiAuthError(
      429,
      `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds`
    );
  }

  // Get customer and credits
  const customerResult = await query(
    `SELECT 
      c.id,
      c.name,
      COALESCE(cc.credits, 0) as credits
     FROM customers c
     LEFT JOIN customer_credits cc ON c.id = cc.customer_id
     WHERE c.id = $1 AND c.is_active = true`,
    [apiKey.customer_id]
  );

  if (customerResult.rows.length === 0) {
    throw new ApiAuthError(403, 'Customer account not found or inactive');
  }

  const customer = customerResult.rows[0];

  return {
    apiKey: {
      id: apiKey.id,
      api_client_id: apiKey.api_client_id,
      customer_id: apiKey.customer_id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      rate_limit: apiKey.rate_limit,
    },
    customer: {
      id: customer.id,
      name: customer.name,
      credits: parseInt(customer.credits),
    },
  };
}

/**
 * Checks if the authenticated user has the required scope
 */
export function hasScope(context: ApiAuthContext, requiredScope: string): boolean {
  return context.apiKey.scopes.includes(requiredScope) || 
         context.apiKey.scopes.includes('*');
}

/**
 * Checks if the customer has enough credits
 */
export function hasCredits(context: ApiAuthContext, required: number): boolean {
  return context.customer.credits >= required;
}

/**
 * Deducts credits from customer account
 */
export async function deductCredits(
  customerId: number,
  amount: number,
  description: string
): Promise<void> {
  await query('BEGIN');
  
  try {
    // Deduct credits
    const result = await query(
      `UPDATE customer_credits 
       SET credits = credits - $1,
           updated_at = NOW()
       WHERE customer_id = $2 AND credits >= $1
       RETURNING credits`,
      [amount, customerId]
    );

    if (result.rows.length === 0) {
      throw new ApiAuthError(402, 'Insufficient credits');
    }

    // Record transaction
    await query(
      `INSERT INTO credit_transactions 
       (customer_id, amount, transaction_type, description)
       VALUES ($1, $2, 'debit', $3)`,
      [customerId, -amount, description]
    );

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

/**
 * Records API usage for analytics
 */
export async function recordApiUsage(
  context: ApiAuthContext,
  request: NextRequest,
  statusCode: number,
  responseTimeMs: number,
  creditsUsed: number = 0
): Promise<void> {
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    await query(
      `INSERT INTO api_usage 
       (api_client_id, api_key_id, endpoint, method, status_code, 
        response_time_ms, credits_used, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        context.apiKey.api_client_id,
        context.apiKey.id,
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        creditsUsed,
        ipAddress,
        userAgent,
      ]
    );

    // Update last_used_at for API key
    await query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [context.apiKey.id]
    );
  } catch (error) {
    console.error('Failed to record API usage:', error);
    // Don't throw error as this is non-critical
  }
}

/**
 * Wraps API route handlers with authentication
 */
export function withApiAuth(
  handler: (request: NextRequest, context: ApiAuthContext) => Promise<Response>,
  options: {
    requiredScope?: string;
    requiredCredits?: number;
  } = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now();
    let statusCode = 200;
    const creditsUsed = 0;

    try {
      // Authenticate request
      const context = await authenticateApiRequest(request);

      // Check scope if required
      if (options.requiredScope && !hasScope(context, options.requiredScope)) {
        throw new ApiAuthError(403, `Missing required scope: ${options.requiredScope}`);
      }

      // Check credits if required
      if (options.requiredCredits && !hasCredits(context, options.requiredCredits)) {
        throw new ApiAuthError(402, 'Insufficient credits');
      }

      // Call the actual handler
      const response = await handler(request, context);
      statusCode = response.status;

      // Record usage
      const responseTimeMs = Date.now() - startTime;
      await recordApiUsage(context, request, statusCode, responseTimeMs, creditsUsed);

      return response;
    } catch (error) {
      if (error instanceof ApiAuthError) {
        statusCode = error.statusCode;
        return new Response(
          JSON.stringify({
            error: error.message,
            statusCode: error.statusCode,
          }),
          {
            status: error.statusCode,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Unexpected error
      console.error('API route error:', error);
      statusCode = 500;
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          statusCode: 500,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}
