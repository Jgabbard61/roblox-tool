-- Migration: Add search_mode column to search_history
-- Date: 2025-10-20
-- Description: Add a new column to track the search mode used (exact, smart, displayName)
--              This is separate from search_type which tracks the input type (username, userId, etc)

-- Step 1: Add the search_mode column
ALTER TABLE search_history 
ADD COLUMN IF NOT EXISTS search_mode VARCHAR(50) CHECK (search_mode IN ('exact', 'smart', 'displayName'));

-- Step 2: Set default value for existing rows (they were all exact searches before this feature)
UPDATE search_history 
SET search_mode = 'exact' 
WHERE search_mode IS NULL;

-- Step 3: Make the column NOT NULL with a default value
ALTER TABLE search_history 
ALTER COLUMN search_mode SET DEFAULT 'exact';

ALTER TABLE search_history 
ALTER COLUMN search_mode SET NOT NULL;

-- Step 4: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_search_history_search_mode ON search_history(search_mode);

-- Verification: Check the updated table structure
-- You can run: \d search_history

-- Sample query to see search modes
-- SELECT search_mode, COUNT(*) FROM search_history GROUP BY search_mode;

