
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/app/lib/api-auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/v1/usage
 * Gets usage statistics for the authenticated customer
 * 
 * Query parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - groupBy: 'day' | 'week' | 'month' (default: 'day')
 * 
 * Headers:
 * Authorization: Bearer <api_key>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "totalRequests": 1000,
 *       "totalCreditsUsed": 500,
 *       "averageResponseTime": 120,
 *       "successRate": 0.95
 *     },
 *     "byEndpoint": [...],
 *     "byDate": [...],
 *     "recentActivity": [...]
 *   }
 * }
 */
export const GET = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const { searchParams } = new URL(request.url);
      
      // Parse date range
      const endDate = searchParams.get('endDate') 
        ? new Date(searchParams.get('endDate')!)
        : new Date();
      
      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const groupBy = searchParams.get('groupBy') || 'day';

      // Validate date range
      if (startDate > endDate) {
        return NextResponse.json(
          { error: 'startDate must be before endDate' },
          { status: 400 }
        );
      }

      // Get API client IDs for this customer
      const clientsResult = await query(
        `SELECT id FROM api_clients WHERE customer_id = $1`,
        [context.customer.id]
      );

      const clientIds = clientsResult.rows.map((r) => r.id);

      if (clientIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            summary: {
              totalRequests: 0,
              totalCreditsUsed: 0,
              averageResponseTime: 0,
              successRate: 0,
            },
            byEndpoint: [],
            byDate: [],
            recentActivity: [],
          },
        });
      }

      // Get summary statistics
      const summaryResult = await query(
        `SELECT 
          COUNT(*) as total_requests,
          SUM(credits_used) as total_credits_used,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END)::float / COUNT(*) as success_rate
         FROM api_usage
         WHERE api_client_id = ANY($1)
         AND created_at BETWEEN $2 AND $3`,
        [clientIds, startDate, endDate]
      );

      const summary = summaryResult.rows[0];

      // Get usage by endpoint
      const byEndpointResult = await query(
        `SELECT 
          endpoint,
          method,
          COUNT(*) as request_count,
          SUM(credits_used) as credits_used,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END)::float / COUNT(*) as success_rate
         FROM api_usage
         WHERE api_client_id = ANY($1)
         AND created_at BETWEEN $2 AND $3
         GROUP BY endpoint, method
         ORDER BY request_count DESC
         LIMIT 50`,
        [clientIds, startDate, endDate]
      );

      // Get usage by date
      const dateGroupFormat = 
        groupBy === 'month' ? 'YYYY-MM' :
        groupBy === 'week' ? 'YYYY-WW' :
        'YYYY-MM-DD';

      const byDateResult = await query(
        `SELECT 
          TO_CHAR(created_at, $4) as date,
          COUNT(*) as request_count,
          SUM(credits_used) as credits_used,
          AVG(response_time_ms) as avg_response_time
         FROM api_usage
         WHERE api_client_id = ANY($1)
         AND created_at BETWEEN $2 AND $3
         GROUP BY TO_CHAR(created_at, $4)
         ORDER BY date`,
        [clientIds, startDate, endDate, dateGroupFormat]
      );

      // Get recent activity (last 10 requests)
      const recentActivityResult = await query(
        `SELECT 
          au.endpoint,
          au.method,
          au.status_code,
          au.response_time_ms,
          au.credits_used,
          au.created_at,
          ak.name as api_key_name
         FROM api_usage au
         JOIN api_keys ak ON au.api_key_id = ak.id
         WHERE au.api_client_id = ANY($1)
         ORDER BY au.created_at DESC
         LIMIT 10`,
        [clientIds]
      );

      // Get search history summary
      const searchStatsResult = await query(
        `SELECT 
          search_mode,
          COUNT(*) as count,
          COUNT(CASE WHEN result_found THEN 1 END) as successful
         FROM search_history
         WHERE customer_id = $1
         AND created_at BETWEEN $2 AND $3
         GROUP BY search_mode`,
        [context.customer.id, startDate, endDate]
      );

      return NextResponse.json({
        success: true,
        data: {
          dateRange: {
            start: startDate,
            end: endDate,
          },
          summary: {
            totalRequests: parseInt(summary.total_requests),
            totalCreditsUsed: parseInt(summary.total_credits_used || 0),
            averageResponseTime: Math.round(parseFloat(summary.avg_response_time || 0)),
            successRate: parseFloat(summary.success_rate || 0),
          },
          byEndpoint: byEndpointResult.rows.map((row) => ({
            endpoint: row.endpoint,
            method: row.method,
            requestCount: parseInt(row.request_count),
            creditsUsed: parseInt(row.credits_used || 0),
            avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
            successRate: parseFloat(row.success_rate),
          })),
          byDate: byDateResult.rows.map((row) => ({
            date: row.date,
            requestCount: parseInt(row.request_count),
            creditsUsed: parseInt(row.credits_used || 0),
            avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
          })),
          recentActivity: recentActivityResult.rows.map((row) => ({
            endpoint: row.endpoint,
            method: row.method,
            statusCode: row.status_code,
            responseTime: row.response_time_ms,
            creditsUsed: row.credits_used,
            timestamp: row.created_at,
            apiKeyName: row.api_key_name,
          })),
          searchStats: searchStatsResult.rows.map((row) => ({
            mode: row.search_mode,
            totalSearches: parseInt(row.count),
            successful: parseInt(row.successful),
            successRate: parseInt(row.successful) / parseInt(row.count),
          })),
        },
      });
    } catch (error) {
      console.error('Get usage statistics error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get usage statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    requiredScope: 'usage:read',
  }
);

/**
 * POST /api/v1/usage
 * Gets detailed usage statistics with custom filters
 * 
 * Request body:
 * {
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-12-31",
 *   "endpoints": ["/api/v1/verify/username"], // Optional: filter by endpoints
 *   "methods": ["GET", "POST"], // Optional: filter by HTTP methods
 *   "statusCodes": [200, 404], // Optional: filter by status codes
 *   "groupBy": "day" // Optional: 'day', 'week', 'month'
 * }
 */
export const POST = withApiAuth(
  async (request: NextRequest, context) => {
    try {
      const body = await request.json();
      const {
        startDate: startDateStr,
        endDate: endDateStr,
        endpoints,
        methods,
        statusCodes,
        groupBy: _groupBy = 'day',
      } = body;

      // Parse dates
      const endDate = endDateStr ? new Date(endDateStr) : new Date();
      const startDate = startDateStr 
        ? new Date(startDateStr)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Build query with filters
      let whereClause = 'WHERE au.api_client_id = ANY($1) AND au.created_at BETWEEN $2 AND $3';
      const queryParams: (string[] | Date | string | number | boolean)[] = [
        await getClientIds(context.customer.id),
        startDate,
        endDate,
      ];

      if (endpoints && Array.isArray(endpoints) && endpoints.length > 0) {
        queryParams.push(endpoints);
        whereClause += ` AND au.endpoint = ANY($${queryParams.length})`;
      }

      if (methods && Array.isArray(methods) && methods.length > 0) {
        queryParams.push(methods);
        whereClause += ` AND au.method = ANY($${queryParams.length})`;
      }

      if (statusCodes && Array.isArray(statusCodes) && statusCodes.length > 0) {
        queryParams.push(statusCodes);
        whereClause += ` AND au.status_code = ANY($${queryParams.length})`;
      }

      // Get filtered statistics
      const statsResult = await query(
        `SELECT 
          COUNT(*) as total_requests,
          SUM(au.credits_used) as total_credits,
          AVG(au.response_time_ms) as avg_response_time,
          MIN(au.response_time_ms) as min_response_time,
          MAX(au.response_time_ms) as max_response_time,
          COUNT(CASE WHEN au.status_code >= 200 AND au.status_code < 300 THEN 1 END) as successful_requests
         FROM api_usage au
         ${whereClause}`,
        queryParams
      );

      const stats = statsResult.rows[0];

      return NextResponse.json({
        success: true,
        data: {
          filters: {
            startDate,
            endDate,
            endpoints: endpoints || null,
            methods: methods || null,
            statusCodes: statusCodes || null,
          },
          statistics: {
            totalRequests: parseInt(stats.total_requests),
            totalCreditsUsed: parseInt(stats.total_credits || 0),
            averageResponseTime: Math.round(parseFloat(stats.avg_response_time || 0)),
            minResponseTime: parseInt(stats.min_response_time || 0),
            maxResponseTime: parseInt(stats.max_response_time || 0),
            successfulRequests: parseInt(stats.successful_requests),
            successRate: parseInt(stats.successful_requests) / parseInt(stats.total_requests),
          },
        },
      });
    } catch (error) {
      console.error('Get detailed usage statistics error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get usage statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    requiredScope: 'usage:read',
  }
);

/**
 * Helper function to get all API client IDs for a customer
 */
async function getClientIds(customerId: number): Promise<number[]> {
  const result = await query(
    `SELECT id FROM api_clients WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows.map((r) => r.id);
}
