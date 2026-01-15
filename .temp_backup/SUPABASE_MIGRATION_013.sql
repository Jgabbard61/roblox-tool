-- =====================================================
-- SUPABASE SQL EDITOR - MIGRATION 013
-- Add Credit Information to Customer Stats
-- =====================================================
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Create a new query
-- 4. Paste this SQL
-- 5. Click "Run" or press Ctrl+Enter
-- =====================================================

-- Step 1: Drop the existing customer_stats TABLE (if it exists)
-- CASCADE ensures any dependent objects are also dropped
DROP TABLE IF EXISTS customer_stats CASCADE;

-- Step 2: Create the new customer_stats VIEW with credit information
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    c.contact_email,
    c.max_users,
    c.logo_url,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    MAX(u.last_login) as last_login_at,
    COALESCE(cc.balance, 0) as credit_balance,
    COALESCE(cc.total_purchased, 0) as total_credits_purchased,
    COALESCE(cc.total_used, 0) as total_credits_used
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
LEFT JOIN customer_credits cc ON c.id = cc.customer_id
GROUP BY 
    c.id, 
    c.name, 
    c.is_active, 
    c.created_at, 
    c.contact_email, 
    c.max_users, 
    c.logo_url, 
    cc.balance, 
    cc.total_purchased, 
    cc.total_used;

-- Step 3: Add documentation comment
COMMENT ON VIEW customer_stats IS 'Customer statistics view including user counts, search activity, and credit balances';

-- =====================================================
-- VERIFICATION QUERIES (Run these after the migration)
-- =====================================================

-- Verify the view was created successfully
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'customer_stats';
-- Expected: table_name = 'customer_stats', table_type = 'VIEW'

-- Check the view columns
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'customer_stats'
ORDER BY ordinal_position;

-- Test the view with a sample query
SELECT 
    id,
    name,
    credit_balance,
    total_credits_purchased,
    total_credits_used,
    total_users,
    total_searches
FROM customer_stats
LIMIT 5;

-- =====================================================
-- Migration Complete!
-- =====================================================
