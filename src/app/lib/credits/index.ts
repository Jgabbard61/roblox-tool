/**
 * Credit Service Module
 * 
 * Handles all credit-related operations for the billing system:
 * - Getting credit balances
 * - Checking sufficient credits
 * - Deducting credits (for searches)
 * - Adding credits (after purchases)
 * - Getting transaction history
 * - Managing credit packages
 */

import { query, transaction } from '@/app/lib/db';
import { PoolClient } from 'pg';

// ============================================
// TYPES
// ============================================

export interface CreditBalance {
  customer_id: number;
  balance: number;
  total_purchased: number;
  total_used: number;
  last_purchase_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransaction {
  id: number;
  customer_id: number;
  user_id: number | null;
  transaction_type: 'purchase' | 'usage' | 'refund' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  search_history_id: number | null;
  payment_id: string | null;
  created_at: Date;
}

export interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price: number;
  price_per_credit: number;
  is_active: boolean;
  description: string | null;
  sort_order: number;
}

// ============================================
// CREDIT BALANCE FUNCTIONS
// ============================================

/**
 * Get current credit balance for a customer
 * 
 * @param customerId - The customer ID
 * @returns Credit balance object or null if not found
 */
export async function getCustomerCredits(customerId: number): Promise<CreditBalance | null> {
  const result = await query<CreditBalance>(
    `SELECT 
      customer_id, balance, total_purchased, total_used, 
      last_purchase_at, created_at, updated_at
     FROM customer_credits
     WHERE customer_id = $1`,
    [customerId]
  );

  return result.rows[0] || null;
}

/**
 * Check if customer has sufficient credits
 * 
 * @param customerId - The customer ID
 * @param requiredCredits - Number of credits required
 * @returns True if customer has enough credits, false otherwise
 */
export async function checkSufficientCredits(
  customerId: number,
  requiredCredits: number
): Promise<boolean> {
  const credits = await getCustomerCredits(customerId);
  
  if (!credits) {
    return false;
  }
  
  return credits.balance >= requiredCredits;
}

/**
 * Initialize credit balance for a new customer
 * 
 * @param customerId - The customer ID
 * @returns The created credit balance
 */
export async function initializeCustomerCredits(customerId: number): Promise<CreditBalance> {
  const result = await query<CreditBalance>(
    `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
     VALUES ($1, 0, 0, 0)
     ON CONFLICT (customer_id) DO NOTHING
     RETURNING customer_id, balance, total_purchased, total_used, last_purchase_at, created_at, updated_at`,
    [customerId]
  );

  // If already exists, return existing
  if (result.rows.length === 0) {
    return (await getCustomerCredits(customerId))!;
  }

  return result.rows[0];
}

// ============================================
// CREDIT TRANSACTION FUNCTIONS
// ============================================

/**
 * Deduct credits from customer account
 * Creates a transaction record and updates balance atomically
 * 
 * @param customerId - The customer ID
 * @param userId - The user who initiated the deduction
 * @param amount - Number of credits to deduct
 * @param searchHistoryId - Optional search history ID to link
 * @param description - Description of the transaction
 * @returns The created transaction
 */
export async function deductCredits(params: {
  customerId: number;
  userId: number;
  amount: number;
  searchHistoryId?: number;
  description: string;
}): Promise<CreditTransaction> {
  const { customerId, userId, amount, searchHistoryId, description } = params;

  return transaction(async (client: PoolClient) => {
    // Lock the row for update
    const balanceResult = await client.query<CreditBalance>(
      'SELECT * FROM customer_credits WHERE customer_id = $1 FOR UPDATE',
      [customerId]
    );

    const currentBalance = balanceResult.rows[0];

    if (!currentBalance) {
      throw new Error('Customer credit account not found');
    }

    if (currentBalance.balance < amount) {
      throw new Error('Insufficient credits');
    }

    const balanceBefore = currentBalance.balance;
    const balanceAfter = balanceBefore - amount;

    // Update balance
    await client.query(
      `UPDATE customer_credits 
       SET balance = $1, total_used = total_used + $2, updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $3`,
      [balanceAfter, amount, customerId]
    );

    // Create transaction record
    const transactionResult = await client.query<CreditTransaction>(
      `INSERT INTO credit_transactions 
        (customer_id, user_id, transaction_type, amount, balance_before, balance_after, 
         description, search_history_id)
       VALUES ($1, $2, 'USAGE', $3, $4, $5, $6, $7)
       RETURNING *`,
      [customerId, userId, -amount, balanceBefore, balanceAfter, description, searchHistoryId || null]
    );

    return transactionResult.rows[0];
  });
}

/**
 * Add credits to customer account (after purchase)
 * Creates a transaction record and updates balance atomically
 * 
 * @param customerId - The customer ID
 * @param userId - The user who initiated the purchase (optional)
 * @param amount - Number of credits to add
 * @param paymentId - Stripe payment ID
 * @param description - Description of the transaction
 * @returns The created transaction
 */
export async function addCredits(params: {
  customerId: number;
  userId?: number;
  amount: number;
  paymentId: string;
  description: string;
}): Promise<CreditTransaction> {
  const { customerId, userId, amount, paymentId, description } = params;

  return transaction(async (client: PoolClient) => {
    // Initialize credit account if doesn't exist
    await client.query(
      `INSERT INTO customer_credits (customer_id, balance, total_purchased, total_used)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (customer_id) DO NOTHING`,
      [customerId]
    );

    // Lock the row for update
    const balanceResult = await client.query<CreditBalance>(
      'SELECT * FROM customer_credits WHERE customer_id = $1 FOR UPDATE',
      [customerId]
    );

    const currentBalance = balanceResult.rows[0];
    const balanceBefore = currentBalance.balance;
    const balanceAfter = balanceBefore + amount;

    // Update balance
    await client.query(
      `UPDATE customer_credits 
       SET balance = $1, total_purchased = total_purchased + $2, 
           last_purchase_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $3`,
      [balanceAfter, amount, customerId]
    );

    // Create transaction record
    const transactionResult = await client.query<CreditTransaction>(
      `INSERT INTO credit_transactions 
        (customer_id, user_id, transaction_type, amount, balance_before, balance_after, 
         description, payment_id)
       VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7)
       RETURNING *`,
      [customerId, userId || null, amount, balanceBefore, balanceAfter, description, paymentId]
    );

    return transactionResult.rows[0];
  });
}

/**
 * Get transaction history for a customer
 * 
 * @param customerId - The customer ID
 * @param limit - Maximum number of transactions to return
 * @param offset - Number of transactions to skip
 * @returns Array of transactions
 */
export async function getTransactionHistory(
  customerId: number,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> {
  const result = await query<CreditTransaction>(
    `SELECT * FROM credit_transactions
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );

  return result.rows;
}

// ============================================
// CREDIT PACKAGE FUNCTIONS
// ============================================

/**
 * Get all active credit packages
 * 
 * @returns Array of credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const result = await query<CreditPackage>(
    `SELECT * FROM credit_packages
     WHERE is_active = true
     ORDER BY sort_order ASC, credits ASC`
  );

  return result.rows;
}

/**
 * Get a specific credit package by ID
 * 
 * @param packageId - The package ID
 * @returns Credit package or null if not found
 */
export async function getCreditPackageById(packageId: number): Promise<CreditPackage | null> {
  const result = await query<CreditPackage>(
    'SELECT * FROM credit_packages WHERE id = $1',
    [packageId]
  );

  return result.rows[0] || null;
}

// ============================================
// STRIPE PAYMENT LOGGING
// ============================================

/**
 * Log a Stripe payment
 * 
 * @param params - Payment details
 */
export async function logStripePayment(params: {
  customerId: number;
  userId?: number;
  stripePaymentIntentId: string;
  stripeCustomerId: string;
  amount: number;
  currency: string;
  credits: number;
  packageId?: number;
  status: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await query(
    `INSERT INTO stripe_payments 
      (customer_id, user_id, stripe_payment_intent_id, stripe_customer_id, 
       amount, currency, credits, package_id, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.customerId,
      params.userId || null,
      params.stripePaymentIntentId,
      params.stripeCustomerId,
      params.amount,
      params.currency,
      params.credits,
      params.packageId || null,
      params.status,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if customer needs low balance alert
 * 
 * @param customerId - The customer ID
 * @param threshold - Credit threshold (default: 10)
 * @returns True if balance is below threshold
 */
export async function needsLowBalanceAlert(
  customerId: number,
  threshold: number = 10
): Promise<boolean> {
  const credits = await getCustomerCredits(customerId);
  
  if (!credits) {
    return false;
  }
  
  return credits.balance < threshold && credits.balance > 0;
}

/**
 * Get credit summary for dashboard
 * 
 * @param customerId - The customer ID
 * @returns Credit summary object
 */
export async function getCreditSummary(customerId: number) {
  const credits = await getCustomerCredits(customerId);
  const recentTransactions = await getTransactionHistory(customerId, 10);
  
  return {
    balance: credits?.balance || 0,
    totalPurchased: credits?.total_purchased || 0,
    totalUsed: credits?.total_used || 0,
    lastPurchaseAt: credits?.last_purchase_at,
    needsAlert: await needsLowBalanceAlert(customerId),
    recentTransactions,
  };
}
