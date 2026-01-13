-- Migration 017: Add IP address tracking for public searches
-- Date: 2026-01-13
-- Purpose: Track IP addresses for public tool usage

BEGIN;

-- Add ip_address column to search_history table
ALTER TABLE search_history
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add index for IP-based queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_search_history_ip_address
  ON search_history(ip_address)
  WHERE ip_address IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN search_history.ip_address IS 'IP address of user making the search (for public anonymous searches)';

-- Make user_id nullable for public searches
-- (This is safe as the column already has the NOT NULL constraint removed in migration 001)
-- Just add a comment to clarify
COMMENT ON COLUMN search_history.user_id IS 'User ID if authenticated, NULL for public anonymous searches';

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Migration 017 completed successfully';
  RAISE NOTICE '✓ Added ip_address column to search_history table';
  RAISE NOTICE '✓ Tool is now ready for public free usage with IP tracking';
END $$;
