# 🚨 Quick Fix: Customer Stats Migration Error

## The Problem

You got this error in Supabase:
```
ERROR: 42809: "customer_stats" is not a view
HINT: Use DROP TABLE to remove a table.
```

## The Solution

### ✅ Copy This SQL Into Supabase SQL Editor

1. **Go to:** Supabase Dashboard → SQL Editor → New Query
2. **Copy and paste** the following SQL:

```sql
-- Fix Migration 013: Drop TABLE and create VIEW with credit info

-- Step 1: Drop the existing TABLE (not VIEW)
DROP TABLE IF EXISTS customer_stats CASCADE;

-- Step 2: Create the new VIEW with credit columns
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

COMMENT ON VIEW customer_stats IS 'Customer statistics view including user counts, search activity, and credit balances';
```

3. **Click "Run"** or press `Ctrl+Enter`

4. **Verify it worked:**

```sql
-- This should return 'VIEW'
SELECT table_type 
FROM information_schema.tables 
WHERE table_name = 'customer_stats';

-- This should show your customers with credit info
SELECT 
    name,
    credit_balance,
    total_credits_purchased,
    total_credits_used
FROM customer_stats;
```

## What This Does

- ✅ Drops the existing `customer_stats` **TABLE**
- ✅ Creates a new `customer_stats` **VIEW**
- ✅ Adds credit columns: `credit_balance`, `total_credits_purchased`, `total_credits_used`
- ✅ Preserves all existing customer data
- ✅ Makes your admin dashboard credit display work

## Why This Happened

`customer_stats` was originally created as a TABLE, but the new design needs it to be a VIEW so it can dynamically fetch credit information from the `customer_credits` table.

## Next Steps

1. ✅ Run the SQL above in Supabase
2. ✅ Verify the queries work
3. ✅ Refresh your admin dashboard
4. ✅ You should now see credit balances for all customers!

---

**Need Help?** Check `/database/migrations/SUPABASE_INSTRUCTIONS.md` for detailed documentation.
