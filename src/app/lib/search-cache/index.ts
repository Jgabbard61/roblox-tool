
/**
 * Search Result Cache Module
 * 
 * Prevents duplicate credit charges by caching search results per customer.
 * When a customer searches for the same term again, we return the cached result
 * without charging additional credits.
 */

import { query } from '@/app/lib/db';

// ============================================
// TYPES
// ============================================

export interface SearchCacheEntry {
  id: number;
  customer_id: number;
  search_term: string;
  search_type: 'smart' | 'exact';
  result_data: unknown; // JSON data
  result_count: number;
  result_status: 'success' | 'no_results' | 'error';
  first_searched_at: Date;
  last_accessed_at: Date;
  access_count: number;
}

// ============================================
// CACHE FUNCTIONS
// ============================================

/**
 * Check if a search result exists in cache
 * 
 * @param customerId - The customer ID
 * @param searchTerm - The search term (will be normalized)
 * @param searchType - 'smart' or 'exact'
 * @returns Cached result or null if not found
 */
export async function getSearchCache(
  customerId: number,
  searchTerm: string,
  searchType: 'smart' | 'exact'
): Promise<SearchCacheEntry | null> {
  // Normalize search term (lowercase, trim)
  const normalizedTerm = searchTerm.toLowerCase().trim();

  const result = await query<SearchCacheEntry>(
    `SELECT * FROM search_result_cache
     WHERE customer_id = $1 AND search_term = $2 AND search_type = $3`,
    [customerId, normalizedTerm, searchType]
  );

  if (result.rows.length > 0) {
    // Update access tracking
    await query(
      `UPDATE search_result_cache
       SET last_accessed_at = CURRENT_TIMESTAMP, 
           access_count = access_count + 1
       WHERE id = $1`,
      [result.rows[0].id]
    );

    return result.rows[0];
  }

  return null;
}

/**
 * Store a search result in cache
 * 
 * @param customerId - The customer ID
 * @param searchTerm - The search term
 * @param searchType - 'smart' or 'exact'
 * @param resultData - The search results (JSON)
 * @param resultCount - Number of results found
 * @param resultStatus - 'success', 'no_results', or 'error'
 * @returns The created cache entry
 */
export async function setSearchCache(params: {
  customerId: number;
  searchTerm: string;
  searchType: 'smart' | 'exact';
  resultData: unknown;
  resultCount: number;
  resultStatus: 'success' | 'no_results' | 'error';
}): Promise<SearchCacheEntry> {
  const { customerId, searchTerm, searchType, resultData, resultCount, resultStatus } = params;

  // Normalize search term
  const normalizedTerm = searchTerm.toLowerCase().trim();

  const result = await query<SearchCacheEntry>(
    `INSERT INTO search_result_cache 
      (customer_id, search_term, search_type, result_data, result_count, result_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (customer_id, search_term, search_type) 
     DO UPDATE SET
       result_data = EXCLUDED.result_data,
       result_count = EXCLUDED.result_count,
       result_status = EXCLUDED.result_status,
       last_accessed_at = CURRENT_TIMESTAMP,
       access_count = search_result_cache.access_count + 1
     RETURNING *`,
    [customerId, normalizedTerm, searchType, JSON.stringify(resultData), resultCount, resultStatus]
  );

  return result.rows[0];
}

/**
 * Clear old cache entries (maintenance function)
 * Removes cache entries older than specified days
 * 
 * @param daysOld - Number of days to keep cache (default: 30)
 * @returns Number of deleted entries
 */
export async function clearOldCache(daysOld: number = 30): Promise<number> {
  const result = await query(
    `DELETE FROM search_result_cache
     WHERE last_accessed_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
     RETURNING id`
  );

  return result.rows.length;
}

/**
 * Get cache statistics for a customer
 * 
 * @param customerId - The customer ID
 * @returns Cache statistics
 */
export async function getCacheStats(customerId: number) {
  const result = await query(
    `SELECT 
      COUNT(*) as total_cached_searches,
      SUM(access_count - 1) as total_cache_hits,
      MAX(last_accessed_at) as last_cache_hit
     FROM search_result_cache
     WHERE customer_id = $1`,
    [customerId]
  );

  return result.rows[0] || {
    total_cached_searches: 0,
    total_cache_hits: 0,
    last_cache_hit: null,
  };
}
