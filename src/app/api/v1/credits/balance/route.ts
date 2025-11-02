
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/api-auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/v1/credits/balance
 * Gets the current credit balance for the authenticated customer
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "credits": 1000,
 *     "customerId": 5,
 *     "customerName": "My Company"
 *   }
 * }
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      // Get current credit balance (already in context, but fetch fresh for accuracy)
      const result = await query(
        `SELECT 
          c.id,
          c.name,
          COALESCE(cc.credits, 0) as credits,
          cc.updated_at as last_updated
         FROM customers c
         LEFT JOIN customer_credits cc ON c.id = cc.customer_id
         WHERE c.id = $1`,
        [context.customer.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const customer = result.rows[0];

      return NextResponse.json({
        success: true,
        data: {
          credits: parseInt(customer.credits),
          customerId: customer.id,
          customerName: customer.name,
          lastUpdated: customer.last_updated,
        },
      });
    } catch (error) {
      console.error('Get credit balance error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get credit balance',
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

/**
 * POST /api/v1/credits/balance
 * Gets detailed credit information including transaction history
 * 
 * Request body:
 * {
 *   "includeTransactions": true, // Optional: include recent transactions
 *   "limit": 10 // Optional: number of transactions to return
 * }
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const body = await request.json();
      const { includeTransactions = false, limit = 10 } = body;

      // Get current credit balance
      const balanceResult = await query(
        `SELECT 
          c.id,
          c.name,
          COALESCE(cc.credits, 0) as credits,
          cc.updated_at as last_updated
         FROM customers c
         LEFT JOIN customer_credits cc ON c.id = cc.customer_id
         WHERE c.id = $1`,
        [context.customer.id]
      );

      if (balanceResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const customer = balanceResult.rows[0];

      interface BalanceResponseData {
        credits: number;
        customerId: number;
        customerName: string;
        lastUpdated: string;
        transactions?: Array<{
          id: number;
          amount: number;
          type: string;
          description: string;
          createdAt: string;
        }>;
      }

      const responseData: BalanceResponseData = {
        credits: parseInt(customer.credits),
        customerId: customer.id,
        customerName: customer.name,
        lastUpdated: customer.last_updated,
      };

      // Get transaction history if requested
      if (includeTransactions) {
        const transactionsResult = await query(
          `SELECT 
            id,
            amount,
            transaction_type,
            description,
            created_at
           FROM credit_transactions
           WHERE customer_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [context.customer.id, Math.min(limit, 100)] // Cap at 100 transactions
        );

        responseData.recentTransactions = transactionsResult.rows.map((t) => ({
          id: t.id,
          amount: parseInt(t.amount),
          type: t.transaction_type,
          description: t.description,
          createdAt: t.created_at,
        }));
      }

      // Get usage statistics
      const usageResult = await query(
        `SELECT 
          COUNT(*) as total_searches,
          COUNT(CASE WHEN result_found THEN 1 END) as successful_searches,
          SUM(CASE WHEN search_mode = 'exact' THEN 1 ELSE 0 END) as exact_searches,
          SUM(CASE WHEN search_mode = 'smart' THEN 1 ELSE 0 END) as smart_searches
         FROM search_history
         WHERE customer_id = $1`,
        [context.customer.id]
      );

      if (usageResult.rows.length > 0) {
        const usage = usageResult.rows[0];
        responseData.usage = {
          totalSearches: parseInt(usage.total_searches),
          successfulSearches: parseInt(usage.successful_searches),
          exactSearches: parseInt(usage.exact_searches),
          smartSearches: parseInt(usage.smart_searches),
        };
      }

      return NextResponse.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error('Get detailed credit balance error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get credit balance',
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
