import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

/**
 * POST /api/admin/migrate
 * Runs database migration to allow zero-credit transactions
 * SUPER_ADMIN only
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    // Only SUPER_ADMIN can run migrations
    if (session?.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - SUPER_ADMIN access required' },
        { status: 403 }
      );
    }

    // Migration 012: Allow zero-credit transactions
    const migration012SQL = `
      -- Drop the existing non-zero constraint
      ALTER TABLE credit_transactions 
      DROP CONSTRAINT IF EXISTS credit_transactions_amount_non_zero;

      -- Create index for better performance when querying free searches
      CREATE INDEX IF NOT EXISTS idx_credit_transactions_zero_amount 
      ON credit_transactions(customer_id, amount) 
      WHERE amount = 0;
    `;

    // Migration 013: Fix customer_stats view to include missing fields
    const migration013SQL = `
      -- Fix customer_stats view to include contact_email, max_users, and logo_url
      DROP VIEW IF EXISTS customer_stats;

      CREATE VIEW customer_stats AS
      SELECT 
          c.id,
          c.name,
          c.is_active,
          c.created_at,
          c.contact_email,
          c.max_users,
          c.logo_url,
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
          COUNT(sh.id) as total_searches,
          MAX(sh.searched_at) as last_search_at,
          MAX(u.last_login) as last_login_at
      FROM customers c
      LEFT JOIN users u ON c.id = u.customer_id
      LEFT JOIN search_history sh ON c.id = sh.customer_id
      GROUP BY c.id, c.name, c.is_active, c.created_at, c.contact_email, c.max_users, c.logo_url;
    `;

    // Run migrations
    console.log('[Migration] Running migration 012: Allow zero-credit transactions');
    await query(migration012SQL);
    
    console.log('[Migration] Running migration 013: Fix customer_stats view');
    await query(migration013SQL);

    return NextResponse.json({
      success: true,
      message: 'Migrations completed successfully. Zero-credit transactions are allowed and customer_stats view has been fixed.',
      migrations: ['012_allow_zero_credit_transactions', '013_fix_customer_stats_view'],
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
