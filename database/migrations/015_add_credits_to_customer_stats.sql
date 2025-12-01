-- Migration 015: Add credit balance to customer_stats view
-- Date: 2025-12-01
-- Description: Update customer_stats view to include credit balance information
--
-- IMPORTANT: This migration uses c.contact_email (NOT c.email)
-- The customers table has contact_email, not email
-- User emails are stored in users.email

DROP VIEW IF EXISTS customer_stats;

CREATE VIEW customer_stats AS
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    c.contact_email,                                          -- NOTE: contact_email, NOT email
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
LEFT JOIN customer_credits cc ON c.id = cc.customer_id       -- Join with customer_credits for balance info
GROUP BY 
    c.id, 
    c.name, 
    c.is_active, 
    c.created_at, 
    c.contact_email,                                         -- NOTE: contact_email, NOT email
    c.max_users, 
    c.logo_url, 
    cc.balance, 
    cc.total_purchased, 
    cc.total_used, 
    cc.last_purchase_at;

COMMENT ON VIEW customer_stats IS 'Customer statistics with user counts, search activity, and credit balance information';
