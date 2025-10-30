
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

/**
 * GET /api/credit-packages
 * Fetches all active credit packages available for purchase
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all active credit packages
    const result = await query(
      `SELECT 
        id, 
        name, 
        credits, 
        price_cents,
        created_at
      FROM credit_packages 
      WHERE is_active = true 
      ORDER BY credits ASC`,
      []
    );

    return NextResponse.json({
      success: true,
      packages: result.rows,
    });
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit packages' },
      { status: 500 }
    );
  }
}
