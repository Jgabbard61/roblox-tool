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

    // Run the migration
    const migrationSQL = `
      -- Drop the existing non-zero constraint
      ALTER TABLE credit_transactions 
      DROP CONSTRAINT IF EXISTS credit_transactions_amount_non_zero;

      -- Create index for better performance when querying free searches
      CREATE INDEX IF NOT EXISTS idx_credit_transactions_zero_amount 
      ON credit_transactions(customer_id, amount) 
      WHERE amount = 0;
    `;

    await query(migrationSQL);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully. Zero-credit transactions are now allowed.',
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
