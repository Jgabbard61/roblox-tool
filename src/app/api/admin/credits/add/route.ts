// API Route: /api/admin/credits/add
// Admin-only endpoint for manually adding credits to customer accounts
// Requires SUPER_ADMIN or CUSTOMER_ADMIN authentication

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { addCredits } from '@/app/lib/credits';

/**
 * POST /api/admin/credits/add
 * Manually add credits to a customer account
 * 
 * Request body:
 * {
 *   "customerId": number,        // Customer ID to add credits to
 *   "amount": number,             // Number of credits to add (must be positive)
 *   "description": string         // Description/reason for adding credits
 * }
 * 
 * Access:
 * - SUPER_ADMIN: Can add credits to any customer
 * - CUSTOMER_ADMIN: Can only add credits to their own customer account
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate and authorize the request
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin privileges
    const userRole = session.user.role;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'CUSTOMER_ADMIN';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId, amount, description } = body;

    // Validate required fields
    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing required field: customerId' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: amount (must be a number)' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: description (must be a string)' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate amount is reasonable (max 10,000 credits per transaction)
    if (amount > 10000) {
      return NextResponse.json(
        { error: 'Amount exceeds maximum limit of 10,000 credits per transaction' },
        { status: 400 }
      );
    }

    // Authorization check: CUSTOMER_ADMIN can only add credits to their own customer
    if (userRole === 'CUSTOMER_ADMIN') {
      const userCustomerId = session.user.customerId;
      
      if (!userCustomerId || parseInt(userCustomerId) !== parseInt(customerId.toString())) {
        return NextResponse.json(
          { error: 'Forbidden - You can only add credits to your own customer account' },
          { status: 403 }
        );
      }
    }

    // Add credits to the customer account
    // Using a special payment ID format for manual admin additions
    const adminPaymentId = `MANUAL_ADMIN_${session.user.id}_${Date.now()}`;
    const adminDescription = `[ADMIN] ${description} (Added by: ${session.user.username})`;

    const transaction = await addCredits({
      customerId: parseInt(customerId.toString()),
      userId: parseInt(session.user.id),
      amount: amount,
      paymentId: adminPaymentId,
      description: adminDescription,
    });

    // Log the action
    console.log('[Admin Credits] Credits added:', {
      customerId,
      amount,
      addedBy: session.user.username,
      userId: session.user.id,
      userRole,
      transactionId: transaction.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Credits added successfully',
      transaction: {
        id: transaction.id,
        customerId: transaction.customer_id,
        amount: transaction.amount,
        balanceBefore: transaction.balance_before,
        balanceAfter: transaction.balance_after,
        description: transaction.description,
        createdAt: transaction.created_at,
      },
    });
  } catch (error) {
    console.error('[Admin Credits] Error adding credits:', error);
    
    // Return appropriate error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to add credits',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
