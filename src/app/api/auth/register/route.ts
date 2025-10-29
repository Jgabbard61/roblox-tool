/**
 * POST /api/auth/register
 * 
 * Creates a new user account with customer organization
 * 
 * Request body:
 * - firstName: User's first name (required)
 * - lastName: User's last name (required)
 * - email: User's email address (required, must be unique)
 * - phoneNumber: User's phone number (optional)
 * - companyName: Company/organization name (required)
 * - password: Password (required, min 8 chars with complexity requirements)
 * 
 * Password requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 * 
 * Returns:
 * - success: true/false
 * - userId: Created user ID
 * - customerId: Created customer ID
 * - email: User email
 * - message: Success or error message
 */

import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '@/app/lib/db';
import { sendVerificationEmail } from '@/app/lib/email';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{8,}$/;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CORS headers helper
function corsHeaders(origin: string | null) {
  const allowedOrigins = [
    'https://site.verifylens.com',
    'https://www.verifylens.com',
    'http://localhost:3000',
  ];
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return NextResponse.json({}, { 
    status: 200,
    headers: corsHeaders(origin)
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    // Parse request body
    const body = await request.json();
    const { firstName, lastName, email, phoneNumber, companyName, password } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !companyName || !password) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields. Please provide firstName, lastName, email, companyName, and password.' 
        },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Trim whitespace
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCompanyName = companyName.trim();
    const trimmedPhoneNumber = phoneNumber?.trim() || null;

    // Validate field lengths
    if (trimmedFirstName.length < 1 || trimmedFirstName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'First name must be between 1 and 100 characters' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (trimmedLastName.length < 1 || trimmedLastName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Last name must be between 1 and 100 characters' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (trimmedCompanyName.length < 1 || trimmedCompanyName.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Company name must be between 1 and 255 characters' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validate password complexity
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
        },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Check if email already exists
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [trimmedEmail]
    );

    if (existingEmail.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email address is already registered' },
        { status: 409, headers: corsHeaders(origin) }
      );
    }

    // Check if company name already exists
    const existingCompany = await query(
      'SELECT id FROM customers WHERE name = $1',
      [trimmedCompanyName]
    );

    if (existingCompany.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Company name is already registered. Please contact support if you need access to this organization.' },
        { status: 409, headers: corsHeaders(origin) }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create customer and user in a transaction
    const result = await query('BEGIN');

    try {
      // Create customer
      const customerResult = await query(
        `INSERT INTO customers (name, contact_email, is_active)
         VALUES ($1, $2, $3)
         RETURNING id, name, contact_email`,
        [trimmedCompanyName, trimmedEmail, true]
      );

      const customer = customerResult.rows[0];

      // Generate username from email
      const username = trimmedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const fullName = `${trimmedFirstName} ${trimmedLastName}`;

      // Create user
      const userResult = await query(
        `INSERT INTO users (
          username, password_hash, role, customer_id, email, full_name, 
          phone_number, is_active, email_verified, email_verification_token, 
          email_verification_expires
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, username, email, full_name`,
        [
          username,
          passwordHash,
          'CUSTOMER_ADMIN',
          customer.id,
          trimmedEmail,
          fullName,
          trimmedPhoneNumber,
          true, // is_active
          false, // email_verified
          verificationToken,
          verificationExpires
        ]
      );

      const user = userResult.rows[0];

      // Commit transaction
      await query('COMMIT');

      // Send verification email
      try {
        const verificationUrl = `${process.env.NEXTAUTH_URL || process.env.APP_URL}/api/auth/verify-email?token=${verificationToken}`;
        
        await sendVerificationEmail({
          email: trimmedEmail,
          firstName: trimmedFirstName,
          verificationUrl,
        });

        console.log('[Registration] Verification email sent to:', trimmedEmail);
      } catch (emailError) {
        console.error('[Registration] Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }

      return NextResponse.json(
        {
          success: true,
          userId: user.id,
          customerId: customer.id,
          email: user.email,
          message: 'Account created successfully. Please check your email to verify your account.'
        },
        { 
          status: 201,
          headers: corsHeaders(origin)
        }
      );

    } catch (error) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('[Registration Error]:', error);

    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { success: false, error: 'Account already exists with this information' },
        { status: 409, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
