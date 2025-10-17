// API Route: /api/admin/stats
// Provides detailed dashboard statistics

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET: Get comprehensive dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get overall stats
    const [
      customerStats,
      userStats,
      searchStats,
      recentActivity,
      topCustomers,
      searchTrends,
    ] = await Promise.all([
      // Customer statistics
      query(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE is_active = true) as active_customers,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${days} days') as new_customers
        FROM customers
      `),
      
      // User statistics
      query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users,
          COUNT(*) FILTER (WHERE role = 'SUPER_ADMIN') as super_admins,
          COUNT(*) FILTER (WHERE role = 'CUSTOMER_ADMIN') as customer_admins,
          COUNT(*) FILTER (WHERE role = 'CUSTOMER_USER') as customer_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${days} days') as new_users
        FROM users
      `),
      
      // Search statistics
      query(`
        SELECT 
          COUNT(*) as total_searches,
          COUNT(*) FILTER (WHERE searched_at >= NOW() - INTERVAL '${days} days') as recent_searches,
          COUNT(*) FILTER (WHERE result_status = 'success') as successful_searches,
          COUNT(*) FILTER (WHERE result_status = 'no_results') as no_results_searches,
          COUNT(*) FILTER (WHERE result_status = 'error') as error_searches,
          AVG(response_time_ms) as avg_response_time,
          COUNT(DISTINCT user_id) as active_searchers
        FROM search_history
      `),
      
      // Recent activity (last 10 searches)
      query(`
        SELECT 
          sh.id, sh.search_query, sh.search_type, sh.result_status, 
          sh.searched_at, sh.response_time_ms,
          u.username, c.name as customer_name
        FROM search_history sh
        LEFT JOIN users u ON sh.user_id = u.id
        LEFT JOIN customers c ON sh.customer_id = c.id
        ORDER BY sh.searched_at DESC
        LIMIT 10
      `),
      
      // Top customers by search volume
      query(`
        SELECT 
          c.id, c.name,
          COUNT(sh.id) as search_count,
          COUNT(DISTINCT sh.user_id) as active_users
        FROM customers c
        LEFT JOIN search_history sh ON c.id = sh.customer_id
        WHERE sh.searched_at >= NOW() - INTERVAL '${days} days'
        GROUP BY c.id, c.name
        ORDER BY search_count DESC
        LIMIT 10
      `),
      
      // Search trends by day (last 7 days)
      query(`
        SELECT 
          DATE(searched_at) as date,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE result_status = 'success') as success_count
        FROM search_history
        WHERE searched_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(searched_at)
        ORDER BY date DESC
      `),
    ]);
    
    return NextResponse.json({
      customers: customerStats.rows[0],
      users: userStats.rows[0],
      searches: searchStats.rows[0],
      recentActivity: recentActivity.rows,
      topCustomers: topCustomers.rows,
      searchTrends: searchTrends.rows,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
