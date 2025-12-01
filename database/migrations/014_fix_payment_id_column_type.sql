-- ============================================
-- MIGRATION 014: Fix payment_id Column Type
-- ============================================
-- Purpose: Change credit_transactions.payment_id from INTEGER to TEXT
--          to support both Stripe payment IDs and manual admin payment IDs
-- Date: December 1, 2025
-- Issue: Admin credit additions fail with "invalid input syntax for type integer"
--        when trying to insert string values like "MANUAL_ADMIN_2_1764551502843"
--
-- Changes:
-- 1. Drop foreign key constraint to stripe_payments
-- 2. Change payment_id column from INTEGER to TEXT
-- 3. Add check constraint for valid payment ID formats
-- ============================================

BEGIN;

-- Step 1: Drop the foreign key constraint
-- (This constraint was linking payment_id to stripe_payments.id as an integer)
ALTER TABLE credit_transactions 
DROP CONSTRAINT IF EXISTS credit_transactions_payment_id_fkey;

-- Step 2: Change payment_id column type from INTEGER to TEXT
-- This allows us to store:
-- - Stripe payment intent IDs (e.g., "pi_xxx")
-- - Manual admin payment IDs (e.g., "MANUAL_ADMIN_2_1764551502843")
ALTER TABLE credit_transactions 
ALTER COLUMN payment_id TYPE TEXT USING payment_id::TEXT;

-- Step 3: Add a check constraint to validate payment ID formats
-- Valid formats:
-- - Stripe payment intents: starts with "pi_"
-- - Stripe charges: starts with "ch_"
-- - Manual admin: starts with "MANUAL_ADMIN_"
-- - NULL (for transactions not linked to payments)
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_payment_id_format_check CHECK (
    payment_id IS NULL OR
    payment_id LIKE 'pi_%' OR
    payment_id LIKE 'ch_%' OR
    payment_id LIKE 'MANUAL_ADMIN_%'
);

-- Step 4: Add index for better query performance on payment_id lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id 
ON credit_transactions(payment_id) 
WHERE payment_id IS NOT NULL;

-- Step 5: Update comment to reflect the new column type
COMMENT ON COLUMN credit_transactions.payment_id IS 
    'Payment identifier: Stripe payment intent ID (pi_xxx), Stripe charge ID (ch_xxx), or manual admin ID (MANUAL_ADMIN_{userId}_{timestamp})';

COMMIT;

-- ============================================
-- Verification Query
-- ============================================
-- Run this after migration to verify the change:
-- 
-- SELECT 
--   column_name, 
--   data_type, 
--   character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'credit_transactions' 
-- AND column_name = 'payment_id';
--
-- Expected output:
-- payment_id | text | NULL
-- ============================================

-- ============================================
-- Success Message
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE '✓ Migration 014 completed successfully';
    RAISE NOTICE '✓ Changed credit_transactions.payment_id from INTEGER to TEXT';
    RAISE NOTICE '✓ Added format validation constraint';
    RAISE NOTICE '✓ Admin credit additions will now work correctly';
    RAISE NOTICE '→ Test by adding credits through the admin dashboard';
END $$;
