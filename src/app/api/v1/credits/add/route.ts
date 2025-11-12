
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/api-auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/v1/credits/add
 * Adds credits to the authenticated customer's account
 * 
 * Query parameters:
 * - amount: number of credits to add (required)
 * - description: description of the credit addition (optional)
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "creditsAdded": 100,
 *     "newBalance": 1100,
 *     "customerId": 5,
 *     "description": "Credit addition"
 *   }
 * }
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const { searchParams } = new URL(request.url);
      const amountStr = searchParams.get('amount');
      const description = searchParams.get('description') || 'Manual credit addition';

      // Validate amount
      if (!amountStr) {
        return NextResponse.json(
          { error: 'amount query parameter is required' },
          { status: 400 }
        );
      }

      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive integer' },
          { status: 400 }
        );
      }

      // Add credits using a transaction
      await query('BEGIN');

      try {
        // Update customer credits
        const updateResult = await query(
          `INSERT INTO customer_credits (customer_id, credits, created_at, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (customer_id)
           DO UPDATE SET 
             credits = customer_credits.credits + $2,
             updated_at = CURRENT_TIMESTAMP
           RETURNING credits`,
          [context.customer.id, amount]
        );

        const newBalance = parseInt(updateResult.rows[0].credits);

        // Log the transaction
        await query(
          `INSERT INTO credit_transactions 
           (customer_id, amount, transaction_type, description, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [context.customer.id, amount, 'credit', description]
        );

        await query('COMMIT');

        return NextResponse.json({
          success: true,
          data: {
            creditsAdded: amount,
            newBalance,
            customerId: context.customer.id,
            description,
          },
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Add credits error:', error);
      return NextResponse.json(
        {
          error: 'Failed to add credits',
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
 * POST /api/v1/credits/add
 * Adds credits to the authenticated customer's account
 * 
 * Request body:
 * {
 *   "amount": 100,
 *   "description": "Credit addition" // Optional
 * }
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const body = await request.json();
      const { amount, description = 'Manual credit addition' } = body;

      // Validate amount
      if (!amount || typeof amount !== 'number') {
        return NextResponse.json(
          { error: 'amount is required and must be a number' },
          { status: 400 }
        );
      }

      if (amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive integer' },
          { status: 400 }
        );
      }

      // Add credits using a transaction
      await query('BEGIN');

      try {
        // Update customer credits
        const updateResult = await query(
          `INSERT INTO customer_credits (customer_id, credits, created_at, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (customer_id)
           DO UPDATE SET 
             credits = customer_credits.credits + $2,
             updated_at = CURRENT_TIMESTAMP
           RETURNING credits`,
          [context.customer.id, amount]
        );

        const newBalance = parseInt(updateResult.rows[0].credits);

        // Log the transaction
        await query(
          `INSERT INTO credit_transactions 
           (customer_id, amount, transaction_type, description, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [context.customer.id, amount, 'credit', description]
        );

        await query('COMMIT');

        return NextResponse.json({
          success: true,
          data: {
            creditsAdded: amount,
            newBalance,
            customerId: context.customer.id,
            description,
          },
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Add credits error:', error);
      return NextResponse.json(
        {
          error: 'Failed to add credits',
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
