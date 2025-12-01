# Apply Migration 015: Add Credit Balance to Customer Stats View

## Overview
This migration updates the `customer_stats` view to include credit balance information from the `customer_credits` table.

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
