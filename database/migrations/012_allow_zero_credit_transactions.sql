-- Migration: Allow Zero-Credit Transactions
-- Purpose: Enable recording of free searches (exact searches with no results, duplicate cached searches)
-- These transactions show important audit trail without charging credits

-- Drop the existing non-zero constraint
ALTER TABLE credit_transactions 
DROP CONSTRAINT IF EXISTS credit_transactions_amount_non_zero;

-- Add a new comment explaining the change
COMMENT ON COLUMN credit_transactions.amount IS 
'Credit change: positive for PURCHASE/REFUND/PROMO/ADJUSTMENT, negative for USAGE, zero for free searches (exact no-results, cached duplicates)';

-- Create index for better performance when querying free searches
CREATE INDEX IF NOT EXISTS idx_credit_transactions_zero_amount 
ON credit_transactions(customer_id, amount) 
WHERE amount = 0;

COMMENT ON INDEX idx_credit_transactions_zero_amount IS 
'Index for efficiently querying free search transactions (amount = 0) per customer';
