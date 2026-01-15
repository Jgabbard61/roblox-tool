-- Migration 013: Add credit information to customer_stats view
-- This migration updates the customer_stats view to include credit balance and transaction information
-- NOTE: This handles the case where customer_stats is currently a TABLE (not a VIEW)

-- Drop the existing table (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS customer_stats CASCADE;

-- Recreate the view with credit information
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
GROUP BY c.id, c.name, c.is_active, c.created_at, c.contact_email, c.max_users, c.logo_url, cc.balance, cc.total_purchased, cc.total_used;

-- Add comment to the view
COMMENT ON VIEW customer_stats IS 'Customer statistics view including user counts, search activity, and credit balances';
