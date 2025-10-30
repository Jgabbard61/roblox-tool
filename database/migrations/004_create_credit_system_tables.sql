-- ============================================
-- MIGRATION 004: Create Credit System Tables
-- ============================================
-- Purpose: Implement automated credit/billing system for VerifyLens searches
-- Date: October 28, 2025
-- Author: Development Team
-- 
-- This migration creates the core tables for the credit-based billing system:
-- 1. credit_packages - Available credit packages for purchase
-- 2. customer_credits - Track credit balances per customer
-- 3. credit_transactions - Detailed log of all credit operations
-- 4. stripe_payments - Payment records from Stripe
--
-- Business Rules:
-- - 1 credit = $100 USD (per search)
-- - Exact searches with no results = FREE (0 credits)
-- - Smart and Display Name searches = 1 credit each
-- - Credits never expire
-- - All transactions are immutable (append-only log)
-- ============================================

-- ============================================
-- TABLE 1: credit_packages
-- Stores available credit packages for purchase
-- ============================================
CREATE TABLE credit_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT credit_packages_name_check CHECK (name <> ''),
    CONSTRAINT credit_packages_credits_positive CHECK (credits > 0),
    CONSTRAINT credit_packages_price_positive CHECK (price_cents > 0),
    CONSTRAINT credit_packages_unique_credits UNIQUE (credits)
);

COMMENT ON TABLE credit_packages IS 'Available credit packages for purchase';
COMMENT ON COLUMN credit_packages.credits IS 'Number of search credits in this package';
COMMENT ON COLUMN credit_packages.price_cents IS 'Price in cents (USD). Divide by 100 for dollars';
COMMENT ON COLUMN credit_packages.is_active IS 'Whether this package is currently available for purchase';

-- ============================================
-- TABLE 2: customer_credits
-- Tracks credit balance for each customer
-- ============================================
CREATE TABLE customer_credits (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT customer_credits_unique_customer UNIQUE (customer_id),
    CONSTRAINT customer_credits_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT customer_credits_total_purchased_non_negative CHECK (total_purchased >= 0),
    CONSTRAINT customer_credits_total_used_non_negative CHECK (total_used >= 0),
    CONSTRAINT customer_credits_balance_integrity CHECK (balance = total_purchased - total_used)
);

COMMENT ON TABLE customer_credits IS 'Credit balance and statistics for each customer';
COMMENT ON COLUMN customer_credits.balance IS 'Current available credits (total_purchased - total_used)';
COMMENT ON COLUMN customer_credits.total_purchased IS 'Lifetime total credits purchased';
COMMENT ON COLUMN customer_credits.total_used IS 'Lifetime total credits used';
COMMENT ON COLUMN customer_credits.last_purchase_at IS 'Timestamp of most recent credit purchase';
COMMENT ON CONSTRAINT customer_credits_balance_integrity ON customer_credits IS 'Ensures balance always equals total_purchased minus total_used';

-- ============================================
-- TABLE 3: credit_transactions
-- Immutable log of all credit operations
-- ============================================
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    search_history_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL,
    payment_id INTEGER, -- FK to stripe_payments (added later to avoid circular dependency)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT credit_transactions_type_check CHECK (
        transaction_type IN ('PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'PROMO')
    ),
    CONSTRAINT credit_transactions_amount_non_zero CHECK (amount != 0),
    CONSTRAINT credit_transactions_balance_before_non_negative CHECK (balance_before >= 0),
    CONSTRAINT credit_transactions_balance_after_non_negative CHECK (balance_after >= 0),
    CONSTRAINT credit_transactions_balance_change_check CHECK (
        balance_after = balance_before + amount
    )
);

COMMENT ON TABLE credit_transactions IS 'Immutable audit log of all credit operations (append-only)';
COMMENT ON COLUMN credit_transactions.transaction_type IS 'PURCHASE (buy credits), USAGE (search charge), REFUND (return credits), ADJUSTMENT (manual fix), PROMO (promotional credits)';
COMMENT ON COLUMN credit_transactions.amount IS 'Credit change: positive for PURCHASE/REFUND/PROMO, negative for USAGE';
COMMENT ON COLUMN credit_transactions.balance_before IS 'Credit balance before this transaction';
COMMENT ON COLUMN credit_transactions.balance_after IS 'Credit balance after this transaction (must equal balance_before + amount)';
COMMENT ON COLUMN credit_transactions.search_history_id IS 'FK to search_history if transaction is for a search (USAGE type)';
COMMENT ON COLUMN credit_transactions.payment_id IS 'FK to stripe_payments if transaction is for a purchase (PURCHASE type)';
COMMENT ON CONSTRAINT credit_transactions_balance_change_check ON credit_transactions IS 'Enforces double-entry bookkeeping: balance_after = balance_before + amount';

-- ============================================
-- TABLE 4: stripe_payments
-- Records of Stripe payment transactions
-- ============================================
CREATE TABLE stripe_payments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255), -- Will be populated from customers.stripe_customer_id in next migration
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    status VARCHAR(50) NOT NULL,
    credits_purchased INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT stripe_payments_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT stripe_payments_credits_positive CHECK (credits_purchased > 0),
    CONSTRAINT stripe_payments_status_check CHECK (
        status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded')
    ),
    CONSTRAINT stripe_payments_currency_check CHECK (currency IN ('usd', 'eur', 'gbp'))
);

COMMENT ON TABLE stripe_payments IS 'Payment transaction records from Stripe integration';
COMMENT ON COLUMN stripe_payments.stripe_payment_intent_id IS 'Unique Stripe PaymentIntent ID (pi_xxx)';
COMMENT ON COLUMN stripe_payments.stripe_customer_id IS 'Stripe Customer ID (cus_xxx) - denormalized for quick lookup';
COMMENT ON COLUMN stripe_payments.amount_cents IS 'Payment amount in cents (divide by 100 for dollars)';
COMMENT ON COLUMN stripe_payments.currency IS 'ISO 4217 currency code (currently only USD supported)';
COMMENT ON COLUMN stripe_payments.status IS 'Stripe payment status: pending, processing, succeeded, failed, canceled, refunded';
COMMENT ON COLUMN stripe_payments.credits_purchased IS 'Number of credits purchased with this payment';
COMMENT ON COLUMN stripe_payments.metadata IS 'Additional Stripe metadata in JSON format';

-- ============================================
-- Add Foreign Key from credit_transactions to stripe_payments
-- (Had to defer this to avoid circular dependency)
-- ============================================
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_payment_id_fkey 
FOREIGN KEY (payment_id) REFERENCES stripe_payments(id) ON DELETE SET NULL;

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER update_customer_credits_updated_at 
BEFORE UPDATE ON customer_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payments_updated_at 
BEFORE UPDATE ON stripe_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Success Message
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE '✓ Migration 004 completed successfully';
    RAISE NOTICE '✓ Created tables: credit_packages, customer_credits, credit_transactions, stripe_payments';
    RAISE NOTICE '→ Next: Run migration 005 to add stripe_customer_id to customers table';
END $$;
