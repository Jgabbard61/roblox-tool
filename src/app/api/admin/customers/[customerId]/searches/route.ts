
// API route for viewing customer search history
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSearchHistoryByCustomer } from '@/app/lib/db';

// GET /api/admin/customers/[customerId]/searches - Get search history for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify admin access
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const customerId = parseInt(params.customerId);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const searches = await getSearchHistoryByCustomer(customerId, limit, offset);

    return NextResponse.json({ searches, limit, offset });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}
