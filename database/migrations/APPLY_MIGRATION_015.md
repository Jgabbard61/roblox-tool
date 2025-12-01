# ⚠️ IMPORTANT: Error Fix Available

If you encountered this error:
```
ERROR: 42703: column c.email does not exist
LINE 9: c.email,
HINT: Perhaps you meant to reference the column "u.email".
```

**Solution:** Use **`SUPABASE_MIGRATION_015_FIXED.sql`** which correctly uses `c.contact_email` instead of `c.email`.

📖 **See [MIGRATION_015_FIX_GUIDE.md](../../MIGRATION_015_FIX_GUIDE.md) for complete troubleshooting and fix documentation.**

---

# Apply Migration 015: Add Credit Balance to Customer Stats View

## Overview
This migration updates the `customer_stats` view to include credit balance information from the `customer_credits` table.

**Note:** This migration does NOT join with the `api_keys` table because api_keys doesn't have a `customer_id` column. If you see an error about `ak.customer_id`, you may have used an incorrect version of the migration. Use `SUPABASE_MIGRATION_015.sql` or the verified `015_add_credits_to_customer_stats.sql` file.

## Steps to Apply in Supabase

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to "SQL Editor" in the left sidebar

2. **Run the Migration**
   - Copy the contents of `015_add_credits_to_customer_stats.sql`
   - Paste into a new query in the SQL Editor
   - Click "Run" to execute

3. **Verify the Migration**
   - Run this query to check the view structure:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'customer_stats' 
   ORDER BY ordinal_position;
   ```

4. **Test the View**
   - Run this query to see the credit balance data:
   ```sql
   SELECT id, name, credit_balance, total_credits_purchased, total_credits_used 
   FROM customer_stats 
   LIMIT 5;
   ```

## Expected Columns After Migration
- `credit_balance` - Current available credits (integer)
- `total_credits_purchased` - Total credits ever purchased (integer)
- `total_credits_used` - Total credits ever used (integer)
- `last_purchase_at` - Timestamp of last credit purchase (timestamp with time zone)

## Rollback (if needed)
If you need to rollback, run the original migration 013:
```sql
-- See: database/migrations/013_fix_customer_stats_view.sql
```