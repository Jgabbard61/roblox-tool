-- ============================================
-- SUPABASE MIGRATION 015 - FIXED VERSION
-- Add credit balance to customer_stats view
-- ============================================
-- Date: 2025-12-01
-- Description: Update customer_stats view to include credit balance information
--
-- IMPORTANT FIX: This migration uses the CORRECT column names
-- ❌ WRONG: c.email (this column does NOT exist in customers table)
-- ✅ CORRECT: c.contact_email (this is the actual column name)
--
-- CUSTOMERS TABLE STRUCTURE:
-- - id
-- - name
-- - is_active
-- - created_at
-- - updated_at
-- - contact_email  ← This is the correct column name
-- - max_users
-- - logo_url
--
-- USERS TABLE STRUCTURE (for reference):
-- - id
-- - username
-- - email  ← Email is in the USERS table, not CUSTOMERS
-- - customer_id
-- - role
-- - etc.
--
-- ============================================

-- Step 0: VALIDATION - Check that required tables and columns exist
-- Run this first to verify your database schema:
/*
SELECT 
    'customers' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customers'
ORDER BY ordinal_position;

SELECT 
    'customer_credits' as table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customer_credits'
ORDER BY ordinal_position;
*/

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS customer_stats;

-- Step 2: Create the updated view with credit balance information
-- NOTE: Uses c.contact_email, NOT c.email
CREATE VIEW customer_stats AS
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    c.contact_email,                                          -- ✅ CORRECT: contact_email (not email)
    c.max_users,
    c.logo_url,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    MAX(u.last_login) as last_login_at,
    COALESCE(cc.balance, 0) as credit_balance,               -- New: credit balance
    COALESCE(cc.total_purchased, 0) as total_credits_purchased,  -- New: total purchased
    COALESCE(cc.total_used, 0) as total_credits_used,        -- New: total used
    cc.last_purchase_at                                      -- New: last purchase timestamp
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
LEFT JOIN customer_credits cc ON c.id = cc.customer_id
GROUP BY 
    c.id, 
    c.name, 
    c.is_active, 
    c.created_at, 
    c.contact_email,                                         -- ✅ CORRECT: contact_email (not email)
    c.max_users, 
    c.logo_url, 
    cc.balance, 
    cc.total_purchased, 
    cc.total_used, 
    cc.last_purchase_at;

-- Step 3: Add comment to the view
COMMENT ON VIEW customer_stats IS 'Customer statistics with user counts, search activity, and credit balance information';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries after executing the migration to verify success:

-- 1. Check if the view exists and has the correct columns:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'customer_stats'
ORDER BY ordinal_position;

-- Expected columns:
-- id, name, is_active, created_at, contact_email, max_users, logo_url,
-- total_users, active_users, total_searches, last_search_at, last_login_at,
-- credit_balance, total_credits_purchased, total_credits_used, last_purchase_at

-- 2. Test the view with a sample query:
SELECT 
    id, 
    name, 
    contact_email,                    -- ✅ CORRECT column name
    credit_balance, 
    total_credits_purchased, 
    total_credits_used,
    last_purchase_at
FROM customer_stats
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verify credit data is showing correctly for customers with credits:
SELECT 
    c.name, 
    cs.credit_balance, 
    cc.balance as actual_balance,
    cs.total_credits_purchased,
    cc.total_purchased as actual_total_purchased,
    cs.total_credits_used,
    cc.total_used as actual_total_used
FROM customer_stats cs
JOIN customers c ON c.id = cs.id
LEFT JOIN customer_credits cc ON cc.customer_id = c.id
ORDER BY c.id
LIMIT 10;

-- 4. Check for any customers without credit records:
SELECT 
    id,
    name,
    contact_email,                    -- ✅ CORRECT column name
    credit_balance,
    CASE 
        WHEN credit_balance = 0 THEN 'No credits or no credit record'
        ELSE 'Has credits'
    END as credit_status
FROM customer_stats
ORDER BY credit_balance DESC;

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If you see error: "column c.email does not exist"
-- ✅ Solution: Use c.contact_email instead
-- 
-- If you see error: "column does not exist" for credit columns
-- ✅ Solution: Ensure customer_credits table exists (run earlier migrations first)
--
-- If credit_balance shows 0 for all customers:
-- ✅ Check: SELECT * FROM customer_credits; to verify credit data exists
--
-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- To rollback to the previous version without credit fields:
/*
DROP VIEW IF EXISTS customer_stats;

CREATE VIEW customer_stats AS
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    c.contact_email,                  -- ✅ Still use contact_email
    c.max_users,
    c.logo_url,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    MAX(u.last_login) as last_login_at
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
GROUP BY c.id, c.name, c.is_active, c.created_at, c.contact_email, c.max_users, c.logo_url;
*/

-- ============================================
-- NOTES
-- ============================================
-- ✅ This migration uses c.contact_email (the actual column in customers table)
-- ❌ DO NOT use c.email (this column does not exist in customers table)
-- ℹ️  User emails are stored in users.email, not customers.email
-- ℹ️  Customer contact emails are stored in customers.contact_email
-- ℹ️  This migration does NOT join with api_keys table
-- ℹ️  Credit tracking is through customer_credits table which has direct customer_id
--
-- ============================================
