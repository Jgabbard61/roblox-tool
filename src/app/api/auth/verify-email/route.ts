/**
 * GET /api/auth/verify-email
 * 
 * Verifies a user's email address using the verification token
 * 
 * Query parameters:
 * - token: Email verification token (required)
 * 
 * Returns:
 * - Redirects to success page on successful verification
 * - Redirects to error page on failure (expired/invalid token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      console.log('[Email Verification] No token provided');
      return NextResponse.redirect(
        new URL('/auth/signin?error=MissingToken', request.url)
      );
    }

    // Find user with matching token
    const userResult = await query(
      `SELECT id, email, email_verification_expires, email_verified
       FROM users
       WHERE email_verification_token = $1`,
      [token]
    );

    if (userResult.rows.length === 0) {
      console.log('[Email Verification] Invalid token');
      return NextResponse.redirect(
        new URL('/auth/signin?error=InvalidToken', request.url)
      );
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      console.log('[Email Verification] Email already verified:', user.email);
      return NextResponse.redirect(
        new URL('/auth/signin?message=AlreadyVerified', request.url)
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(user.email_verification_expires);

    if (now > expiresAt) {
      console.log('[Email Verification] Token expired for:', user.email);
      return NextResponse.redirect(
        new URL('/auth/signin?error=TokenExpired', request.url)
      );
    }

    // Mark email as verified and clear token
    await query(
      `UPDATE users
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    console.log('[Email Verification] Email verified successfully:', user.email);

    // Redirect to sign-in page with success message
    return NextResponse.redirect(
      new URL('/auth/signin?message=EmailVerified', request.url)
    );

  } catch (error) {
    console.error('[Email Verification Error]:', error);
    return NextResponse.redirect(
      new URL('/auth/signin?error=VerificationFailed', request.url)
    );
  }
}
