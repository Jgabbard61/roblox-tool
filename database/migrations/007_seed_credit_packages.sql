-- ============================================
-- MIGRATION 007: Seed Credit Packages
-- ============================================
-- Purpose: Insert initial credit packages for purchase
-- Date: October 28, 2025
-- Author: Development Team
-- 
-- This migration inserts the initial credit packages available for purchase.
--
-- Pricing Structure:
-- - Base rate: 1 credit = $100 USD per search
-- - Package discounts: None currently (future: volume discounts)
-- - All packages active by default
--
-- Packages:
-- 1. 10 credits = $1,000 (Starter)
-- 2. 50 credits = $5,000 (Professional)
-- 3. 100 credits = $10,000 (Business)
-- 4. 200 credits = $20,000 (Enterprise)
-- ============================================

-- ============================================
-- Insert Credit Packages
-- Use ON CONFLICT to make migration idempotent (safe to run multiple times)
-- ============================================

INSERT INTO credit_packages (name, credits, price_cents, is_active) 
VALUES 
    ('Starter Pack', 10, 100000, true),
    ('Professional Pack', 50, 500000, true),
    ('Business Pack', 100, 1000000, true),
    ('Enterprise Pack', 200, 2000000, true)
ON CONFLICT (credits) DO UPDATE SET
    name = EXCLUDED.name,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

-- ============================================
-- Verify Packages Were Inserted
-- ============================================
DO $$ 
DECLARE
    package_count INTEGER;
    packages_info TEXT;
BEGIN
    -- Count total packages
    SELECT COUNT(*) INTO package_count FROM credit_packages WHERE is_active = true;
    
    -- Get package details for display
    SELECT string_agg(
        format('%s: %s credits = $%s', name, credits, (price_cents::FLOAT / 100)::TEXT),
        E'\n  '
    ) INTO packages_info
    FROM credit_packages
    WHERE is_active = true
    ORDER BY credits;
    
    RAISE NOTICE '✓ Migration 007 completed successfully';
    RAISE NOTICE '✓ Credit packages seeded: % active packages', package_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Available Credit Packages:';
    RAISE NOTICE '  %', packages_info;
    RAISE NOTICE '';
    RAISE NOTICE '→ All credit system migrations completed!';
    RAISE NOTICE '→ Review APPLY_CREDIT_MIGRATIONS.md for verification steps';
END $$;
