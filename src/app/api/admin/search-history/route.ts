// API Route: /api/admin/search-history
// Handles search history queries with advanced filtering

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET: Get search history with advanced filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const customerId = searchParams.get('customerId');
    const userId = searchParams.get('userId');
    const searchType = searchParams.get('searchType');
    const resultStatus = searchParams.get('resultStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchTerm = searchParams.get('search');
    
    const offset = (page - 1) * limit;
    
    // Build query with filters
    let whereClause = '1=1';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let paramCount = 0;
    
    if (customerId && customerId !== 'all') {
      paramCount++;
      if (customerId === 'null') {
        whereClause += ' AND sh.customer_id IS NULL';
      } else {
        whereClause += ` AND sh.customer_id = $${paramCount}`;
        params.push(parseInt(customerId));
      }
    }
    
    if (userId) {
      paramCount++;
      whereClause += ` AND sh.user_id = $${paramCount}`;
      params.push(parseInt(userId));
    }
    
    if (searchType && searchType !== 'all') {
      paramCount++;
      whereClause += ` AND sh.search_type = $${paramCount}`;
      params.push(searchType);
    }
    
    if (resultStatus && resultStatus !== 'all') {
      paramCount++;
      whereClause += ` AND sh.result_status = $${paramCount}`;
      params.push(resultStatus);
    }
    
    if (startDate) {
      paramCount++;
      whereClause += ` AND sh.searched_at >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      whereClause += ` AND sh.searched_at <= $${paramCount}`;
      params.push(endDate);
    }
    
    if (searchTerm) {
      paramCount++;
      whereClause += ` AND (sh.search_query ILIKE $${paramCount} OR sh.roblox_username ILIKE $${paramCount})`;
      params.push(`%${searchTerm}%`);
    }
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM search_history sh WHERE ${whereClause}`,
      params
    );
    const totalSearches = parseInt(countResult.rows[0].total);
    
    // Get search history with pagination
    params.push(limit, offset);
    const result = await query(
      `SELECT 
        sh.id, sh.user_id, sh.customer_id, sh.search_type, sh.search_query,
        sh.roblox_username, sh.roblox_user_id, sh.roblox_display_name,
        sh.has_verified_badge, sh.result_count, sh.result_status,
        sh.response_time_ms, sh.searched_at,
        u.username as searched_by_username,
        c.name as customer_name
       FROM search_history sh
       LEFT JOIN users u ON sh.user_id = u.id
       LEFT JOIN customers c ON sh.customer_id = c.id
       WHERE ${whereClause}
       ORDER BY sh.searched_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );
    
    return NextResponse.json({
      searches: result.rows,
      pagination: {
        total: totalSearches,
        page,
        limit,
        totalPages: Math.ceil(totalSearches / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch search history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}
