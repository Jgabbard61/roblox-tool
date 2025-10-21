// FILE: src/app/api/customer-logo/[customerId]/route.ts
// API endpoint to fetch customer logo URL

import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    // Fetch customer logo URL
    const result = await query(
      'SELECT logo_url FROM customers WHERE id = $1 AND is_active = true',
      [customerId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ logoUrl: null });
    }

    const logoUrl = result.rows[0].logo_url;

    return NextResponse.json({ logoUrl }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache
      },
    });

  } catch (error) {
    console.error('Customer logo fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch customer logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
