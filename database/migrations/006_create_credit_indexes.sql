-- ============================================
-- MIGRATION 006: Create Credit System Indexes
-- ============================================
-- Purpose: Create performance indexes for credit/billing system queries
-- Date: October 28, 2025
-- Author: Development Team
-- 
-- This migration creates indexes to optimize common queries in the credit system:
-- - Credit balance lookups by customer
-- - Transaction history queries
-- - Payment status lookups
-- - Stripe customer ID lookups
--
-- Performance Impact:
-- - Dramatically improves query performance for credit checks
-- - Enables efficient transaction history pagination
-- - Speeds up payment reconciliation
-- - Optimizes admin dashboard queries
-- ============================================

-- ============================================
-- INDEXES FOR credit_packages
-- ============================================

-- Index for finding active packages (most common query)
CREATE INDEX IF NOT EXISTS idx_credit_packages_is_active 
ON credit_packages(is_active) 
WHERE is_active = true;

COMMENT ON INDEX idx_credit_packages_is_active IS 'Partial index for quickly finding active credit packages available for purchase';

-- Index for sorting packages by credits
CREATE INDEX IF NOT EXISTS idx_credit_packages_credits 
ON credit_packages(credits);

COMMENT ON INDEX idx_credit_packages_credits IS 'Index for sorting credit packages by number of credits';

-- ============================================
-- INDEXES FOR customer_credits
-- ============================================

-- Primary lookup: Get credit balance by customer_id (most frequent query)
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id 
ON customer_credits(customer_id);

COMMENT ON INDEX idx_customer_credits_customer_id IS 'Index for fast credit balance lookups by customer ID';

-- Index for finding customers with low balance (for notifications)
CREATE INDEX IF NOT EXISTS idx_customer_credits_balance 
ON customer_credits(balance) 
WHERE balance < 10;

COMMENT ON INDEX idx_customer_credits_balance IS 'Partial index for finding customers with low credit balance (<10 credits) for notifications';

-- Index for finding recent purchasers (for analytics)
CREATE INDEX IF NOT EXISTS idx_customer_credits_last_purchase 
ON customer_credits(last_purchase_at DESC NULLS LAST);

COMMENT ON INDEX idx_customer_credits_last_purchase IS 'Index for finding recent credit purchasers, with NULLs (never purchased) at the end';

-- ============================================
-- INDEXES FOR credit_transactions
-- ============================================

-- Primary lookup: Transaction history by customer
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id 
ON credit_transactions(customer_id, created_at DESC);

COMMENT ON INDEX idx_credit_transactions_customer_id IS 'Composite index for efficient transaction history queries by customer, sorted by newest first';

-- Secondary lookup: Transaction history by user
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id 
ON credit_transactions(user_id, created_at DESC);

COMMENT ON INDEX idx_credit_transactions_user_id IS 'Composite index for user-specific transaction history';

-- Index for transaction type filtering (e.g., all USAGE transactions)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type 
ON credit_transactions(transaction_type, created_at DESC);

COMMENT ON INDEX idx_credit_transactions_type IS 'Index for filtering transactions by type (PURCHASE, USAGE, REFUND, etc.)';

-- Index for linking transactions to searches
CREATE INDEX IF NOT EXISTS idx_credit_transactions_search_history_id 
ON credit_transactions(search_history_id) 
WHERE search_history_id IS NOT NULL;

COMMENT ON INDEX idx_credit_transactions_search_history_id IS 'Partial index for finding credit transactions associated with specific searches';

-- Index for linking transactions to payments
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id 
ON credit_transactions(payment_id) 
WHERE payment_id IS NOT NULL;

COMMENT ON INDEX idx_credit_transactions_payment_id IS 'Partial index for finding credit transactions associated with specific payments';

-- Index for finding recent transactions (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at 
ON credit_transactions(created_at DESC);

COMMENT ON INDEX idx_credit_transactions_created_at IS 'Index for sorting transactions by timestamp (newest first) for admin dashboard';

-- ============================================
-- INDEXES FOR stripe_payments
-- ============================================

-- Primary lookup: Payments by customer
CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer_id 
ON stripe_payments(customer_id, created_at DESC);

COMMENT ON INDEX idx_stripe_payments_customer_id IS 'Composite index for customer payment history, sorted by newest first';

-- Secondary lookup: Payments by user (who initiated the purchase)
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_id 
ON stripe_payments(user_id, created_at DESC);

COMMENT ON INDEX idx_stripe_payments_user_id IS 'Composite index for user-initiated payments';

-- Critical: Fast lookup by Stripe Payment Intent ID (webhook processing)
CREATE INDEX IF NOT EXISTS idx_stripe_payments_payment_intent_id 
ON stripe_payments(stripe_payment_intent_id);

COMMENT ON INDEX idx_stripe_payments_payment_intent_id IS 'Index for fast lookups by Stripe PaymentIntent ID (critical for webhook processing)';

-- Index for Stripe Customer ID lookups
CREATE INDEX IF NOT EXISTS idx_stripe_payments_stripe_customer_id 
ON stripe_payments(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

COMMENT ON INDEX idx_stripe_payments_stripe_customer_id IS 'Partial index for finding payments by Stripe Customer ID';

-- Index for payment status filtering (e.g., failed payments)
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status 
ON stripe_payments(status, created_at DESC);

COMMENT ON INDEX idx_stripe_payments_status IS 'Composite index for filtering payments by status (succeeded, failed, etc.)';

-- Index for finding recent successful payments (analytics)
CREATE INDEX IF NOT EXISTS idx_stripe_payments_succeeded 
ON stripe_payments(created_at DESC) 
WHERE status = 'succeeded';

COMMENT ON INDEX idx_stripe_payments_succeeded IS 'Partial index for finding recent successful payments (optimized for analytics)';

-- Index for sorting by update time (webhook order processing)
CREATE INDEX IF NOT EXISTS idx_stripe_payments_updated_at 
ON stripe_payments(updated_at DESC);

COMMENT ON INDEX idx_stripe_payments_updated_at IS 'Index for sorting by last update time (useful for webhook processing and reconciliation)';

-- ============================================
-- INDEX FOR customers.stripe_customer_id
-- (Added here for better organization)
-- ============================================

-- Index for looking up customers by Stripe Customer ID
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id 
ON customers(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

COMMENT ON INDEX idx_customers_stripe_customer_id IS 'Partial index for fast customer lookups by Stripe Customer ID (webhook processing)';

-- ============================================
-- Verify Indexes Were Created
-- ============================================
DO $$ 
DECLARE
    index_count INTEGER;
BEGIN
    -- Count indexes created by this migration
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename IN ('credit_packages', 'customer_credits', 'credit_transactions', 'stripe_payments', 'customers')
    AND indexname LIKE 'idx_%credit%' OR indexname LIKE 'idx_%stripe%';
    
    RAISE NOTICE '✓ Migration 006 completed successfully';
    RAISE NOTICE '✓ Created % indexes for credit system tables', index_count;
    RAISE NOTICE '✓ Performance optimized for:';
    RAISE NOTICE '  - Credit balance lookups';
    RAISE NOTICE '  - Transaction history queries';
    RAISE NOTICE '  - Payment status filtering';
    RAISE NOTICE '  - Stripe webhook processing';
    RAISE NOTICE '→ Next: Run migration 007 to seed initial credit packages';
END $$;
