import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/usage-stats
 * Fetches API usage statistics for the authenticated user's customer
 * 
 * Query parameters:
 * - days: number of days to look back (default: 30)
 * - limit: number of recent API calls to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = session.user.customerId;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get API client IDs for this customer
    const clientsResult = await query(
      `SELECT id FROM api_clients WHERE customer_id = $1`,
      [customerId]
    );

    const clientIds = clientsResult.rows.map((r) => r.id);

    // If no API clients exist yet, return empty statistics
    if (clientIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalApiCalls: 0,
            creditsConsumed: 0,
            mostUsedEndpoint: null,
            averageResponseTime: 0,
            successRate: 0,
          },
          recentApiCalls: [],
          topEndpoints: [],
          usageByDate: [],
        },
      });
    }

    const dateFilter = `NOW() - INTERVAL '${days} days'`;

    // Get summary statistics
    const summaryResult = await query(
      `SELECT 
        COUNT(*) as total_calls,
        SUM(credits_used) as total_credits,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END)::float / NULLIF(COUNT(*), 0) as success_rate
       FROM api_usage
       WHERE api_client_id = ANY($1)
       AND created_at >= ${dateFilter}`,
      [clientIds]
    );

    const summary = summaryResult.rows[0];

    // Get most used endpoint
    const mostUsedResult = await query(
      `SELECT endpoint, method, COUNT(*) as call_count
       FROM api_usage
       WHERE api_client_id = ANY($1)
       AND created_at >= ${dateFilter}
       GROUP BY endpoint, method
       ORDER BY call_count DESC
       LIMIT 1`,
      [clientIds]
    );

    const mostUsedEndpoint = mostUsedResult.rows[0] 
      ? `${mostUsedResult.rows[0].method} ${mostUsedResult.rows[0].endpoint}`
      : null;

    // Get recent API calls
    const recentCallsResult = await query(
      `SELECT 
        au.endpoint,
        au.method,
        au.status_code,
        au.credits_used,
        au.created_at,
        au.response_time_ms,
        ak.name as api_key_name
       FROM api_usage au
       LEFT JOIN api_keys ak ON au.api_key_id = ak.id
       WHERE au.api_client_id = ANY($1)
       ORDER BY au.created_at DESC
       LIMIT $2`,
      [clientIds, limit]
    );

    // Get top endpoints by usage
    const topEndpointsResult = await query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as call_count,
        SUM(credits_used) as credits_used,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END)::float / NULLIF(COUNT(*), 0) as success_rate
       FROM api_usage
       WHERE api_client_id = ANY($1)
       AND created_at >= ${dateFilter}
       GROUP BY endpoint, method
       ORDER BY call_count DESC
       LIMIT 5`,
      [clientIds]
    );

    // Get usage by date (last 7 days)
    const usageByDateResult = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as call_count,
        SUM(credits_used) as credits_used
       FROM api_usage
       WHERE api_client_id = ANY($1)
       AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [clientIds]
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalApiCalls: parseInt(summary.total_calls || '0'),
          creditsConsumed: parseInt(summary.total_credits || '0'),
          mostUsedEndpoint,
          averageResponseTime: Math.round(parseFloat(summary.avg_response_time || '0')),
          successRate: parseFloat(summary.success_rate || '0'),
        },
        recentApiCalls: recentCallsResult.rows.map((row) => ({
          endpoint: row.endpoint,
          method: row.method,
          statusCode: row.status_code,
          creditsUsed: row.credits_used,
          timestamp: row.created_at,
          responseTime: row.response_time_ms,
          apiKeyName: row.api_key_name,
        })),
        topEndpoints: topEndpointsResult.rows.map((row) => ({
          endpoint: row.endpoint,
          method: row.method,
          callCount: parseInt(row.call_count),
          creditsUsed: parseInt(row.credits_used || '0'),
          avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
          successRate: parseFloat(row.success_rate),
        })),
        usageByDate: usageByDateResult.rows.map((row) => ({
          date: row.date,
          callCount: parseInt(row.call_count),
          creditsUsed: parseInt(row.credits_used || '0'),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch usage statistics',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
