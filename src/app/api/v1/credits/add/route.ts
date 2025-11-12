
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
      const description = searchParams.get('description') || 'Manual credit addition via API';

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
        // Get a user_id for this customer (required by credit_transactions table)
        // We'll use the first active user, or NULL if none exists
        const userResult = await query(
          `SELECT id FROM users 
           WHERE customer_id = $1 AND is_active = true 
           ORDER BY id ASC LIMIT 1`,
          [context.customer.id]
        );

        const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

        // Initialize customer credits if doesn't exist
        await query(
          `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
           VALUES ($1, 0, 0, 0)
           ON CONFLICT (customer_id) DO NOTHING`,
          [context.customer.id]
        );

        // Lock the row for update and get current balance
        const balanceResult = await query(
          `SELECT balance FROM customer_credits 
           WHERE customer_id = $1 FOR UPDATE`,
          [context.customer.id]
        );

        const balanceBefore = parseInt(balanceResult.rows[0].balance);
        const balanceAfter = balanceBefore + amount;

        // Update customer credits
        await query(
          `UPDATE customer_credits 
           SET balance = $1, 
               total_purchased = total_purchased + $2,
               last_purchase_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE customer_id = $3`,
          [balanceAfter, amount, context.customer.id]
        );

        // Log the transaction with proper balance tracking
        await query(
          `INSERT INTO credit_transactions 
           (customer_id, user_id, amount, transaction_type, balance_before, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [context.customer.id, userId, amount, 'ADJUSTMENT', balanceBefore, balanceAfter, description]
        );

        await query('COMMIT');

        return NextResponse.json({
          success: true,
          data: {
            creditsAdded: amount,
            balanceBefore,
            newBalance: balanceAfter,
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
      const { amount, description = 'Manual credit addition via API' } = body;

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
        // Get a user_id for this customer (required by credit_transactions table)
        // We'll use the first active user, or NULL if none exists
        const userResult = await query(
          `SELECT id FROM users 
           WHERE customer_id = $1 AND is_active = true 
           ORDER BY id ASC LIMIT 1`,
          [context.customer.id]
        );

        const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

        // Initialize customer credits if doesn't exist
        await query(
          `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
           VALUES ($1, 0, 0, 0)
           ON CONFLICT (customer_id) DO NOTHING`,
          [context.customer.id]
        );

        // Lock the row for update and get current balance
        const balanceResult = await query(
          `SELECT balance FROM customer_credits 
           WHERE customer_id = $1 FOR UPDATE`,
          [context.customer.id]
        );

        const balanceBefore = parseInt(balanceResult.rows[0].balance);
        const balanceAfter = balanceBefore + amount;

        // Update customer credits
        await query(
          `UPDATE customer_credits 
           SET balance = $1, 
               total_purchased = total_purchased + $2,
               last_purchase_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE customer_id = $3`,
          [balanceAfter, amount, context.customer.id]
        );

        // Log the transaction with proper balance tracking
        await query(
          `INSERT INTO credit_transactions 
           (customer_id, user_id, amount, transaction_type, balance_before, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [context.customer.id, userId, amount, 'ADJUSTMENT', balanceBefore, balanceAfter, description]
        );

        await query('COMMIT');

        return NextResponse.json({
          success: true,
          data: {
            creditsAdded: amount,
            balanceBefore,
            newBalance: balanceAfter,
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
