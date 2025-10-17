
// API route for managing customers
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as bcrypt from 'bcrypt';
import {
  getAllCustomersWithStats,
  createCustomerWithAdmin,
  updateCustomerStatus,
} from '@/app/lib/db';

// GET /api/admin/customers - Get all customers with stats
export async function GET(request: NextRequest) {
  try {
    // Verify admin access (redundant with middleware, but good practice)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const customers = await getAllCustomersWithStats();

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/customers - Create new customer with admin user
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerName, adminUsername, adminPassword, adminEmail } = body;

    // Validate input
    if (!customerName || !adminUsername || !adminPassword) {
      return NextResponse.json(
        { error: 'Customer name, admin username, and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create customer and admin user
    const result = await createCustomerWithAdmin(
      customerName,
      adminUsername,
      passwordHash,
      adminEmail
    );

    return NextResponse.json({
      message: 'Customer and admin user created successfully',
      customer: result.customer,
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        email: result.user.email,
        created_at: result.user.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    
    // Handle unique constraint violation (PostgreSQL unique constraint error code)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json(
        { error: 'Customer name or username already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/customers - Update customer status
export async function PATCH(request: NextRequest) {
  try {
    // Verify admin access
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerId, isActive } = body;

    if (!customerId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Customer ID and active status are required' },
        { status: 400 }
      );
    }

    await updateCustomerStatus(customerId, isActive);

    return NextResponse.json({
      message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error updating customer status:', error);
    return NextResponse.json(
      { error: 'Failed to update customer status' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/customers - Update customer details
export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerId, name, contactEmail, maxUsers } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Import query function
    const { query } = await import('@/app/lib/db');

    // Build update query
    const updates: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (contactEmail !== undefined) {
      paramCount++;
      updates.push(`contact_email = $${paramCount}`);
      params.push(contactEmail);
    }

    if (maxUsers !== undefined) {
      paramCount++;
      updates.push(`max_users = $${paramCount}`);
      params.push(maxUsers);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    params.push(customerId);
    await query(
      `UPDATE customers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount + 1}`,
      params
    );

    return NextResponse.json({
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/customers - Delete customer (with warning if has users)
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const force = searchParams.get('force') === 'true';

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Import query function
    const { query } = await import('@/app/lib/db');

    // Check if customer has users
    const usersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE customer_id = $1',
      [parseInt(customerId)]
    );

    const userCount = parseInt(usersResult.rows[0].count);

    if (userCount > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Customer has associated users',
          userCount,
          message: 'Please confirm deletion of customer with all associated users',
        },
        { status: 409 }
      );
    }

    // Delete customer (CASCADE will delete users and search history)
    await query('DELETE FROM customers WHERE id = $1', [parseInt(customerId)]);

    return NextResponse.json({
      message: 'Customer deleted successfully',
      deletedUsers: userCount,
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
