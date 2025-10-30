-- ============================================
-- COMPLETE CREDIT SYSTEM SETUP
-- ============================================
-- This file combines all necessary migrations for the credit system
-- Run this in your Supabase SQL Editor
-- ============================================

-- Drop existing tables if they exist (to start fresh)
-- WARNING: This will delete all existing credit data!
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS stripe_payments CASCADE;
DROP TABLE IF EXISTS credit_pricing CASCADE;
DROP TABLE IF EXISTS customer_credits CASCADE;
DROP TABLE IF EXISTS credit_packages CASCADE;

-- ============================================
-- MIGRATION 004: Create Credit System Tables
-- ============================================

-- TABLE 1: credit_packages
CREATE TABLE credit_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT credit_packages_name_check CHECK (name <> ''),
    CONSTRAINT credit_packages_credits_positive CHECK (credits > 0),
    CONSTRAINT credit_packages_price_positive CHECK (price_cents > 0),
    CONSTRAINT credit_packages_unique_credits UNIQUE (credits)
);

COMMENT ON TABLE credit_packages IS 'Available credit packages for purchase';

-- TABLE 2: customer_credits
CREATE TABLE customer_credits (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT customer_credits_unique_customer UNIQUE (customer_id),
    CONSTRAINT customer_credits_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT customer_credits_total_purchased_non_negative CHECK (total_purchased >= 0),
    CONSTRAINT customer_credits_total_used_non_negative CHECK (total_used >= 0),
    CONSTRAINT customer_credits_balance_integrity CHECK (balance = total_purchased - total_used)
);

COMMENT ON TABLE customer_credits IS 'Credit balance and statistics for each customer';

-- TABLE 3: stripe_payments
CREATE TABLE stripe_payments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    status VARCHAR(50) NOT NULL,
    credits_purchased INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT stripe_payments_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT stripe_payments_credits_positive CHECK (credits_purchased > 0),
    CONSTRAINT stripe_payments_status_check CHECK (
        status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded')
    ),
    CONSTRAINT stripe_payments_currency_check CHECK (currency IN ('usd', 'eur', 'gbp'))
);

COMMENT ON TABLE stripe_payments IS 'Payment transaction records from Stripe integration';

-- TABLE 4: credit_transactions
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    search_history_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES stripe_payments(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
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

-- ============================================
-- MIGRATION 005: Add stripe_customer_id to customers
-- ============================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

COMMENT ON COLUMN customers.stripe_customer_id IS 'Stripe Customer ID (cus_xxx) for payment processing';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id ON credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment_intent_id ON credit_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer_id ON stripe_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_id ON stripe_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_stripe_payment_intent_id ON stripe_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_credit_packages_is_active ON credit_packages(is_active);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_credits_updated_at 
BEFORE UPDATE ON customer_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payments_updated_at 
BEFORE UPDATE ON stripe_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Credit Packages
-- ============================================
INSERT INTO credit_packages (name, credits, price_cents, is_active) VALUES
    ('Starter Pack', 10, 1000, true),
    ('Professional Pack', 50, 5000, true),
    ('Business Pack', 100, 10000, true),
    ('Enterprise Pack', 200, 20000, true)
ON CONFLICT (credits) DO UPDATE SET
    name = EXCLUDED.name,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE '✓ Credit system setup completed successfully!';
    RAISE NOTICE '✓ Created tables: credit_packages, customer_credits, credit_transactions, stripe_payments';
    RAISE NOTICE '✓ Added stripe_customer_id column to customers table';
    RAISE NOTICE '✓ Created all necessary indexes';
    RAISE NOTICE '✓ Seeded 4 credit packages';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Ensure Stripe API keys are set in Vercel environment variables';
    RAISE NOTICE '2. Test the credit purchase flow';
    RAISE NOTICE '3. Verify credit packages appear in the dashboard';
END $$;
