-- Migration: Make user_id nullable in credit_transactions
-- Purpose: Allow API transactions without user context (only customer_id)
-- Date: 2025-11-13

-- API transactions are associated with customers via API keys, not users
-- User transactions (purchases via UI) still use user_id
-- This allows both types of transactions to coexist

BEGIN;

-- Make user_id nullable
ALTER TABLE credit_transactions 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add comment to explain the nullable user_id
COMMENT ON COLUMN credit_transactions.user_id IS 
  'User ID for user-initiated transactions (purchases). NULL for API transactions (usage).';

-- Verify the change
-- The following query should return 'YES' for is_nullable
-- SELECT column_name, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'credit_transactions' AND column_name = 'user_id';

COMMIT;
