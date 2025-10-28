/**
 * GET /api/credits/packages
 * 
 * Returns all active credit packages
 * 
 * This endpoint is public (no authentication required)
 * Used on landing page and checkout flow
 */

import { NextResponse } from 'next/server';
import { getCreditPackages } from '@/app/lib/credits';

export async function GET() {
  try {
    const packages = await getCreditPackages();

    return NextResponse.json({
      packages,
    });
  } catch (error) {
    console.error('[Credit Packages Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit packages' },
      { status: 500 }
    );
  }
}
