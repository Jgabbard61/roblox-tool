-- ============================================
-- MIGRATION 005: Add Stripe Customer ID to Customers Table
-- ============================================
-- Purpose: Add Stripe integration column for linking customers to Stripe accounts
-- Date: October 28, 2025
-- Author: Development Team
-- 
-- This migration adds the stripe_customer_id column to the customers table
-- to enable Stripe payment processing and customer management.
--
-- Business Context:
-- - Each customer organization gets a Stripe Customer ID (cus_xxx)
-- - Used for managing payment methods, invoices, and billing
-- - Enables saved payment methods and recurring billing (future)
-- - Links VerifyLens customers to their Stripe account
-- ============================================

-- ============================================
-- Add stripe_customer_id column to customers table
-- ============================================
ALTER TABLE customers 
ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE;

COMMENT ON COLUMN customers.stripe_customer_id IS 'Stripe Customer ID (cus_xxx) for payment processing. Unique per customer. NULL until first purchase.';

-- ============================================
-- Create index for efficient Stripe customer lookups
-- (Will be added in next migration for organization)
-- ============================================
-- Note: Index creation moved to migration 006 for better organization

-- ============================================
-- Verify column was added
-- ============================================
DO $$ 
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'stripe_customer_id'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE '✓ Migration 005 completed successfully';
        RAISE NOTICE '✓ Added column: customers.stripe_customer_id (VARCHAR(255) UNIQUE)';
        RAISE NOTICE '→ Next: Run migration 006 to create performance indexes';
    ELSE
        RAISE EXCEPTION 'Failed to add stripe_customer_id column';
    END IF;
END $$;
