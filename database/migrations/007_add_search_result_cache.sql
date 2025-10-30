-- Migration 007: Add Search Result Cache Table
-- This table stores search results per customer to prevent duplicate charges

-- ============================================
-- SEARCH RESULT CACHE TABLE
-- Stores search results per customer to prevent duplicate charges
-- ============================================
CREATE TABLE IF NOT EXISTS search_result_cache (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Search details (used as lookup key)
    search_term VARCHAR(500) NOT NULL, -- The exact search term (normalized to lowercase)
    search_type VARCHAR(50) NOT NULL CHECK (search_type IN ('smart', 'exact')),
    
    -- Cached result data
    result_data JSONB NOT NULL, -- Full search results
    result_count INTEGER NOT NULL DEFAULT 0,
    result_status VARCHAR(50) NOT NULL CHECK (result_status IN ('success', 'no_results', 'error')),
    
    -- Metadata
    first_searched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER NOT NULL DEFAULT 1,
    
    -- Constraints: One unique cache entry per customer + search_term + search_type
    CONSTRAINT unique_search_cache UNIQUE(customer_id, search_term, search_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_search_result_cache_customer_search ON search_result_cache(customer_id, search_term, search_type);
CREATE INDEX IF NOT EXISTS idx_search_result_cache_last_accessed ON search_result_cache(last_accessed_at DESC);

-- ============================================
-- FUNCTION: Update last_accessed_at on cache hit
-- ============================================
CREATE OR REPLACE FUNCTION update_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = CURRENT_TIMESTAMP;
    NEW.access_count = OLD.access_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to auto-update access tracking
CREATE TRIGGER update_search_cache_access 
BEFORE UPDATE ON search_result_cache
FOR EACH ROW 
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_cache_access();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE search_result_cache IS 'Caches search results per customer to prevent duplicate charges for the same search';
COMMENT ON COLUMN search_result_cache.search_term IS 'Normalized search term (lowercase, trimmed)';
COMMENT ON COLUMN search_result_cache.access_count IS 'Number of times this cached result has been accessed (1 = original search)';
