-- Migration: Fix customer_stats view to include missing fields
-- Date: 2025-11-13
-- Description: Add contact_email, max_users, and logo_url fields to customer_stats view
--              to fix "Failed to fetch customers" error in admin dashboard

DROP VIEW IF EXISTS customer_stats;

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
    MAX(u.last_login) as last_login_at
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
GROUP BY c.id, c.name, c.is_active, c.created_at, c.contact_email, c.max_users, c.logo_url;

COMMENT ON VIEW customer_stats IS 'Customer statistics with user counts and search activity, includes all customer metadata fields';
