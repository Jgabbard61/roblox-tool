
-- Migration: Add Credit System
-- This migration adds tables for credit packages, customer credits, and transaction tracking

-- ============================================
-- CREDIT PACKAGES TABLE
-- Defines available credit packages for purchase
-- ============================================
CREATE TABLE IF NOT EXISTS credit_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    credits INTEGER NOT NULL CHECK (credits > 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT credit_packages_name_check CHECK (name <> '')
);

CREATE INDEX IF NOT EXISTS idx_credit_packages_is_active ON credit_packages(is_active);

-- ============================================
-- CUSTOMER CREDITS TABLE
-- Tracks current credit balance for each customer
-- ============================================
CREATE TABLE IF NOT EXISTS customer_credits (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);

-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- Logs all credit purchases and usage
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'adjustment')),
    amount INTEGER NOT NULL, -- Positive for additions, negative for deductions
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    
    -- Purchase details (for transaction_type = 'purchase')
    credit_package_id INTEGER REFERENCES credit_packages(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    payment_amount_cents INTEGER,
    
    -- Usage details (for transaction_type = 'usage')
    search_history_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL,
    usage_description TEXT,
    
    -- General metadata
    description TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id ON credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment_intent_id ON credit_transactions(stripe_payment_intent_id);

-- ============================================
-- CREDIT PRICING TABLE
-- Defines cost in credits for different operations
-- ============================================
CREATE TABLE IF NOT EXISTS credit_pricing (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL UNIQUE,
    cost_in_credits INTEGER NOT NULL CHECK (cost_in_credits >= 0),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT credit_pricing_operation_check CHECK (operation_type <> '')
);

CREATE INDEX IF NOT EXISTS idx_credit_pricing_operation_type ON credit_pricing(operation_type);
CREATE INDEX IF NOT EXISTS idx_credit_pricing_is_active ON credit_pricing(is_active);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for credit_packages updated_at
CREATE TRIGGER update_credit_packages_updated_at BEFORE UPDATE ON credit_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for customer_credits updated_at
CREATE TRIGGER update_customer_credits_updated_at BEFORE UPDATE ON customer_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for credit_pricing updated_at
CREATE TRIGGER update_credit_pricing_updated_at BEFORE UPDATE ON credit_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default credit packages
INSERT INTO credit_packages (name, credits, price_cents, is_active, description) VALUES
    ('Starter Pack', 10, 1000, true, 'Perfect for trying out the service'),
    ('Professional Pack', 50, 5000, true, 'Great for regular users'),
    ('Business Pack', 100, 10000, true, 'Ideal for small teams'),
    ('Enterprise Pack', 200, 20000, true, 'Best value for large organizations')
ON CONFLICT (name) DO UPDATE SET
    name = EXCLUDED.name,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

-- Insert default credit pricing for operations
INSERT INTO credit_pricing (operation_type, cost_in_credits, description, is_active) VALUES
    ('exact_search', 1, 'Exact username or ID search', true),
    ('smart_search', 3, 'AI-powered smart matching search', true),
    ('display_name_search', 2, 'Display name fuzzy search', true),
    ('forensic_mode', 5, 'Detailed forensic profile analysis', true),
    ('deep_context', 2, 'Full profile context view', true)
ON CONFLICT (operation_type) DO UPDATE SET
    cost_in_credits = EXCLUDED.cost_in_credits,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE credit_packages IS 'Defines available credit packages that customers can purchase';
COMMENT ON TABLE customer_credits IS 'Tracks the current credit balance for each customer organization';
COMMENT ON TABLE credit_transactions IS 'Logs all credit-related transactions including purchases, usage, and adjustments';
COMMENT ON TABLE credit_pricing IS 'Defines the cost in credits for different operations in the system';

COMMENT ON COLUMN credit_transactions.amount IS 'Positive values for additions (purchases), negative values for deductions (usage)';
COMMENT ON COLUMN credit_transactions.balance_after IS 'The customer credit balance after this transaction was applied';
