
// API route for viewing customer users
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUsersByCustomer } from '@/app/lib/db';

// GET /api/admin/customers/[customerId]/users - Get all users for a customer
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

    const users = await getUsersByCustomer(customerId);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching customer users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer users' },
      { status: 500 }
    );
  }
}
