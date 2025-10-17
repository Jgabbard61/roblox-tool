// API Route: /api/admin/users/password
// Handles user password reset operations

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import * as bcrypt from 'bcrypt';

// POST: Reset user password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPassword } = body;
    
    // Validation
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const userResult = await query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    );
    
    return NextResponse.json({
      message: 'Password reset successfully',
      username: userResult.rows[0].username,
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
