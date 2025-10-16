
// Database connection and utility functions for PostgreSQL
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      process.exit(-1);
    });
  }

  return pool;
}

/**
 * Execute a query with automatic error handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', {
        text: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if database connection is healthy
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================
// Database Utility Functions for Multi-tenant
// ============================================

/**
 * Get user by username with customer info
 */
export async function getUserByUsername(username: string) {
  const result = await query(
    `SELECT 
      u.id, u.username, u.password_hash, u.role, u.customer_id, 
      u.email, u.full_name, u.is_active,
      c.name as customer_name, c.is_active as customer_is_active
     FROM users u
     LEFT JOIN customers c ON u.customer_id = c.id
     WHERE u.username = $1`,
    [username]
  );
  
  return result.rows[0] || null;
}

/**
 * Get user by ID with customer info
 */
export async function getUserById(userId: number) {
  const result = await query(
    `SELECT 
      u.id, u.username, u.role, u.customer_id, 
      u.email, u.full_name, u.is_active,
      c.name as customer_name, c.is_active as customer_is_active
     FROM users u
     LEFT JOIN customers c ON u.customer_id = c.id
     WHERE u.id = $1`,
    [userId]
  );
  
  return result.rows[0] || null;
}

/**
 * Update user's last login timestamp
 */
export async function updateUserLastLogin(userId: number) {
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );
}

/**
 * Create a new customer with admin user (transaction)
 */
export async function createCustomerWithAdmin(
  customerName: string,
  adminUsername: string,
  passwordHash: string,
  adminEmail?: string
) {
  return transaction(async (client) => {
    // Create customer
    const customerResult = await client.query(
      'INSERT INTO customers (name, is_active) VALUES ($1, $2) RETURNING id, name, is_active, created_at',
      [customerName, true]
    );
    
    const customer = customerResult.rows[0];
    
    // Create admin user for customer
    const userResult = await client.query(
      `INSERT INTO users (username, password_hash, role, customer_id, email, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, role, customer_id, email, created_at`,
      [adminUsername, passwordHash, 'CUSTOMER_ADMIN', customer.id, adminEmail, true]
    );
    
    const user = userResult.rows[0];
    
    return { customer, user };
  });
}

/**
 * Log a search to search_history
 */
export async function logSearch(params: {
  userId: number;
  customerId: number;
  searchType: string;
  searchQuery: string;
  robloxUsername?: string;
  robloxUserId?: number;
  robloxDisplayName?: string;
  hasVerifiedBadge?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultData?: any;
  resultCount?: number;
  resultStatus: 'success' | 'no_results' | 'error';
  errorMessage?: string;
  responseTimeMs?: number;
}) {
  await query(
    `INSERT INTO search_history 
      (user_id, customer_id, search_type, search_query, 
       roblox_username, roblox_user_id, roblox_display_name, has_verified_badge,
       result_data, result_count, result_status, error_message, response_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      params.userId,
      params.customerId,
      params.searchType,
      params.searchQuery,
      params.robloxUsername || null,
      params.robloxUserId || null,
      params.robloxDisplayName || null,
      params.hasVerifiedBadge !== undefined ? params.hasVerifiedBadge : null,
      params.resultData ? JSON.stringify(params.resultData) : null,
      params.resultCount || 0,
      params.resultStatus,
      params.errorMessage || null,
      params.responseTimeMs || null,
    ]
  );
}

/**
 * Get all customers with stats
 */
export async function getAllCustomersWithStats() {
  const result = await query(
    'SELECT * FROM customer_stats ORDER BY created_at DESC'
  );
  
  return result.rows;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: number) {
  const result = await query(
    'SELECT * FROM customers WHERE id = $1',
    [customerId]
  );
  
  return result.rows[0] || null;
}

/**
 * Update customer active status
 */
export async function updateCustomerStatus(customerId: number, isActive: boolean) {
  await query(
    'UPDATE customers SET is_active = $1 WHERE id = $2',
    [isActive, customerId]
  );
}

/**
 * Get search history for a customer
 */
export async function getSearchHistoryByCustomer(
  customerId: number,
  limit: number = 100,
  offset: number = 0
) {
  const result = await query(
    `SELECT 
      sh.id, sh.search_type, sh.search_query, sh.searched_at,
      sh.roblox_username, sh.roblox_user_id, sh.result_status,
      u.username as searched_by
     FROM search_history sh
     JOIN users u ON sh.user_id = u.id
     WHERE sh.customer_id = $1
     ORDER BY sh.searched_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );
  
  return result.rows;
}

/**
 * Get all users for a customer
 */
export async function getUsersByCustomer(customerId: number) {
  const result = await query(
    `SELECT 
      id, username, role, email, full_name, is_active, 
      created_at, last_login
     FROM users
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );
  
  return result.rows;
}
