-- Migration: Allow NULL customer_id in search_history for SUPER_ADMIN searches
-- Date: 2025-10-17
-- Description: SUPER_ADMIN users don't have a customer_id, so we need to allow NULL
--              values in the search_history table to log their searches.

-- Step 1: Drop the existing constraint that requires customer_id to be NOT NULL
ALTER TABLE search_history 
ALTER COLUMN customer_id DROP NOT NULL;

-- Step 2: Drop the check constraint that enforces both user_id and customer_id
ALTER TABLE search_history 
DROP CONSTRAINT IF EXISTS search_history_user_customer_check;

-- Step 3: Add a new check constraint that allows NULL customer_id only for SUPER_ADMIN users
-- This is validated at the application level, so we just ensure user_id is always present
ALTER TABLE search_history 
ADD CONSTRAINT search_history_user_check CHECK (user_id IS NOT NULL);

-- Step 4: Create an index on customer_id for better query performance (allowing NULL)
CREATE INDEX IF NOT EXISTS idx_search_history_customer_id ON search_history(customer_id) WHERE customer_id IS NOT NULL;

-- Step 5: Create an index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);

-- Verification: Check the updated table structure
-- You can run: \d search_history
