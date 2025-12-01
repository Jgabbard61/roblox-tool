-- ============================================
-- TEST MIGRATION 015
-- Validation and testing queries for migration 015
-- ============================================
-- This file contains queries to validate that migration 015 will work correctly
--
-- Run these queries BEFORE applying migration 015 to ensure compatibility
-- ============================================

-- TEST 1: Verify customers table has contact_email (NOT email)
-- Expected: Should return contact_email
-- If this fails, the customers table structure is different than expected
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customers' 
  AND column_name IN ('email', 'contact_email');

-- Expected result: contact_email (NOT email)

-- TEST 2: Verify customer_credits table exists and has required columns
-- Expected: Should return balance, total_purchased, total_used, last_purchase_at
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customer_credits'
  AND column_name IN ('customer_id', 'balance', 'total_purchased', 'total_used', 'last_purchase_at')
ORDER BY ordinal_position;

-- Expected: All 5 columns should exist

-- TEST 3: Check current structure of customer_stats view
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customer_stats'
ORDER BY ordinal_position;

-- TEST 4: Verify the join relationship will work
-- This tests if customers can be joined with customer_credits
SELECT 
    c.id as customer_id,
    c.name,
    c.contact_email,
    cc.balance,
    cc.total_purchased,
    cc.total_used
FROM customers c
LEFT JOIN customer_credits cc ON c.id = cc.customer_id
LIMIT 5;

-- TEST 5: Check if any customers have credit data
SELECT 
    COUNT(*) as total_customers,
    COUNT(cc.id) as customers_with_credits,
    COUNT(*) - COUNT(cc.id) as customers_without_credits
FROM customers c
LEFT JOIN customer_credits cc ON c.id = cc.customer_id;

-- ============================================
-- DRY RUN: Simulate the view creation
-- ============================================
-- This tests the exact query that will be used in the view
-- If this runs without errors, the migration should work
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    c.contact_email,                                          -- ✅ contact_email, NOT email
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
GROUP BY 
    c.id, 
    c.name, 
    c.is_active, 
    c.created_at, 
    c.contact_email,                                         -- ✅ contact_email, NOT email
    c.max_users, 
    c.logo_url, 
    cc.balance, 
    cc.total_purchased, 
    cc.total_used, 
    cc.last_purchase_at
LIMIT 10;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- If all tests pass:
-- ✅ TEST 1: Returns 'contact_email' (NOT 'email')
-- ✅ TEST 2: Returns 5 rows for customer_credits columns
-- ✅ TEST 3: Returns current customer_stats structure
-- ✅ TEST 4: Returns customer data with credit balances (NULL for no credits)
-- ✅ TEST 5: Returns count of customers with/without credits
-- ✅ DRY RUN: Returns customer stats with credit information, no errors
--
-- If any test fails:
-- ❌ Check the error message
-- ❌ Verify table structure matches expected schema
-- ❌ DO NOT apply migration 015 until issues are resolved
--
-- ============================================
