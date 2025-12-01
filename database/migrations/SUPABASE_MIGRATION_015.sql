-- ============================================
-- SUPABASE MIGRATION 015
-- Add credit balance to customer_stats view
-- ============================================
-- Date: 2025-12-01
-- Description: Update customer_stats view to include credit balance information
--
-- IMPORTANT: Copy and paste this entire script into Supabase SQL Editor
-- This migration recreates the customer_stats view to include credit data
--
-- Prerequisites:
-- - customer_credits table must exist (created in earlier migrations)
-- - customers, users, search_history tables must exist
--
-- ============================================

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS customer_stats;

-- Step 2: Create the updated view with credit balance information
CREATE VIEW customer_stats AS
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
    COALESCE(cc.total_used, 0) as total_credits_used,
    cc.last_purchase_at
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
LEFT JOIN customer_credits cc ON c.id = cc.customer_id
GROUP BY c.id, c.name, c.is_active, c.created_at, c.contact_email, c.max_users, c.logo_url, 
         cc.balance, cc.total_purchased, cc.total_used, cc.last_purchase_at;

-- Step 3: Add comment to the view
COMMENT ON VIEW customer_stats IS 'Customer statistics with user counts, search activity, and credit balance information';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries after executing the migration to verify success:

-- 1. Check if the view exists and has the correct columns:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'customer_stats'
-- ORDER BY ordinal_position;

-- 2. Test the view with a sample query:
-- SELECT id, name, credit_balance, total_credits_purchased, total_credits_used
-- FROM customer_stats
-- LIMIT 5;

-- 3. Verify credit data is showing correctly:
-- SELECT c.name, 
--        cs.credit_balance, 
--        cc.balance as actual_balance,
--        cs.total_credits_purchased,
--        cc.total_purchased as actual_total_purchased
-- FROM customer_stats cs
-- JOIN customers c ON c.id = cs.id
-- LEFT JOIN customer_credits cc ON cc.customer_id = c.id
-- LIMIT 10;

-- ============================================
-- NOTES
-- ============================================
-- This migration does NOT join with api_keys because:
-- - api_keys table does NOT have a customer_id column
-- - The relationship is: api_keys → api_client_id → api_clients → customer_id
-- - Credit tracking is managed through customer_credits table which has direct customer_id
--
-- If you see an error like "column ak.customer_id does not exist", it means
-- someone tried to add a join to api_keys using an incorrect column name.
--
-- ============================================
