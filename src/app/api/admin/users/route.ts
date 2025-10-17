// API Route: /api/admin/users
// Handles user management operations (CRUD)

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import * as bcrypt from 'bcrypt';

// GET: Get all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const customerId = searchParams.get('customerId');
    const role = searchParams.get('role');
    const searchTerm = searchParams.get('search');
    
    const offset = (page - 1) * limit;
    
    // Build query with filters
    let whereClause = '1=1';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let paramCount = 0;
    
    if (customerId && customerId !== 'all') {
      paramCount++;
      whereClause += ` AND u.customer_id = $${paramCount}`;
      params.push(parseInt(customerId));
    }
    
    if (role && role !== 'all') {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }
    
    if (searchTerm) {
      paramCount++;
      whereClause += ` AND (u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      params.push(`%${searchTerm}%`);
    }
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      params
    );
    const totalUsers = parseInt(countResult.rows[0].total);
    
    // Get users with pagination
    params.push(limit, offset);
    const result = await query(
      `SELECT 
        u.id, u.username, u.role, u.customer_id, u.email, u.full_name, 
        u.is_active, u.created_at, u.last_login,
        c.name as customer_name
       FROM users u
       LEFT JOIN customers c ON u.customer_id = c.id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      params
    );
    
    return NextResponse.json({
      users: result.rows,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST: Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, role, customerId, email, fullName } = body;
    
    // Validation
    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }
    
    // Validate role
    const validRoles = ['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'CUSTOMER_USER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }
    
    // Validate customer_id requirement based on role
    if (role !== 'SUPER_ADMIN' && !customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required for non-super-admin users' },
        { status: 400 }
      );
    }
    
    if (role === 'SUPER_ADMIN' && customerId) {
      return NextResponse.json(
        { error: 'SUPER_ADMIN cannot have a customer ID' },
        { status: 400 }
      );
    }
    
    // Check if username already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await query(
      `INSERT INTO users (username, password_hash, role, customer_id, email, full_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, role, customer_id, email, full_name, is_active, created_at`,
      [username, passwordHash, role, customerId || null, email || null, fullName || null, true]
    );
    
    return NextResponse.json({
      message: 'User created successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// PATCH: Update a user
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, updates } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Build update query dynamically based on provided fields
    const allowedFields = ['role', 'customer_id', 'email', 'full_name', 'is_active'];
    const updateFields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];
    let paramCount = 0;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        params.push(value);
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    params.push(userId);
    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount + 1}
       RETURNING id, username, role, customer_id, email, full_name, is_active`,
      params
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const user = await query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [parseInt(userId)]
    );
    
    if (user.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Don't allow deleting yourself (would need session check)
    // This is a safety measure
    
    // Delete user
    await query('DELETE FROM users WHERE id = $1', [parseInt(userId)]);
    
    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
