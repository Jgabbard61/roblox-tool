
# Credit Packages Setup Guide

## 🎯 Overview

Your dashboard is working correctly, but the credit packages aren't displaying because they haven't been seeded in your Supabase production database yet. This guide will walk you through the process.

---

## 📋 What You Need

- ✅ Access to your Supabase dashboard
- ✅ Your project's SQL Editor
- ✅ The migration file (included in this repo)

---

## 🚀 Step-by-Step Instructions

### Step 1: Log into Supabase

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your VerifyLens project
3. Navigate to the **SQL Editor** tab in the left sidebar

### Step 2: Run the Seed Migration

Copy and paste the following SQL into the SQL Editor:

```sql
-- ============================================
-- MIGRATION 007: Seed Credit Packages
-- ============================================
-- Purpose: Insert initial credit packages for purchase
-- Date: October 28, 2025
--
-- Pricing Structure:
-- - Base rate: 1 credit = $100 USD per search
-- - All packages active by default
--
-- Packages:
-- 1. 10 credits = $1,000 (Starter)
-- 2. 50 credits = $5,000 (Professional)
-- 3. 100 credits = $10,000 (Business)
-- 4. 200 credits = $20,000 (Enterprise)
-- ============================================

-- Insert Credit Packages
-- Use ON CONFLICT to make migration idempotent (safe to run multiple times)
INSERT INTO credit_packages (name, credits, price_cents, is_active) 
VALUES 
    ('Starter Pack', 10, 100000, true),
    ('Professional Pack', 50, 500000, true),
    ('Business Pack', 100, 1000000, true),
    ('Enterprise Pack', 200, 2000000, true)
ON CONFLICT (credits) DO UPDATE SET
    name = EXCLUDED.name,
    price_cents = EXCLUDED.price_cents,
    is_active = EXCLUDED.is_active;

-- Verify packages were inserted
SELECT 
    id,
    name,
    credits,
    (price_cents / 100.0) as price_usd,
    is_active,
    created_at
FROM credit_packages
ORDER BY credits ASC;
```

### Step 3: Execute the Query

1. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. You should see a success message
3. The verification query will display all inserted packages

### Step 4: Verify the Results

You should see 4 packages in the results:

| Name              | Credits | Price USD | Active |
|-------------------|---------|-----------|--------|
| Starter Pack      | 10      | $1,000    | ✓      |
| Professional Pack | 50      | $5,000    | ✓      |
| Business Pack     | 100     | $10,000   | ✓      |
| Enterprise Pack   | 200     | $20,000   | ✓      |

### Step 5: Refresh Your Dashboard

1. Go back to your deployed dashboard
2. Click the **"Refresh"** button (or refresh the page)
3. You should now see all 4 credit packages displayed!

---

## 🎨 What You'll See After Seeding

Once the packages are seeded, your dashboard will display:

### Credit Package Cards
```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Starter Pack      │  │ Professional Pack   │  │   Business Pack     │  │  Enterprise Pack    │
│                     │  │                     │  │                     │  │                     │
│      10 credits     │  │     50 credits      │  │    100 credits      │  │    200 credits      │
│       $1,000        │  │      $5,000         │  │     $10,000         │  │     $20,000         │
│   $100 per credit   │  │   $100 per credit   │  │   $100 per credit   │  │   $100 per credit   │
│                     │  │                     │  │                     │  │                     │
│   [  Purchase  ]    │  │   [  Purchase  ]    │  │   [  Purchase  ]    │  │   [  Purchase  ]    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

Each package will have a **"Purchase"** button that redirects to Stripe Checkout.

---

## ✅ Additional Features Now Available

After seeding, the following features will work:

1. **Purchase Flow**
   - Click any "Purchase" button
   - Redirects to Stripe Checkout
   - Processes payment
   - Credits added to your account automatically

2. **Navigation**
   - **"Return to Verifier"** button (top right) - Go back to search page
   - **"Refresh"** button - Reload credit balance

3. **Credit Balance Display**
   - Current Balance
   - Total Purchased
   - Total Used
   - Last Purchase date

4. **Transaction History**
   - Shows all credit purchases
   - Shows all credit usage (searches)
   - Real-time updates

---

## 🔧 Troubleshooting

### Issue: "No Credit Packages Available" still showing

**Solutions:**

1. **Verify the migration ran successfully**
   ```sql
   SELECT COUNT(*) as package_count FROM credit_packages WHERE is_active = true;
   ```
   Should return: `4`

2. **Check DATABASE_URL in Vercel**
   - Go to Vercel project settings
   - Environment Variables section
   - Ensure `DATABASE_URL` is set correctly
   - Should match your Supabase connection string

3. **Check API logs in Vercel**
   - Go to Vercel dashboard
   - Click "Functions" tab
   - Look for `/api/credits/packages` logs
   - Check for any errors

4. **Test API endpoint directly**
   ```bash
   curl https://your-vercel-domain.vercel.app/api/credits/packages
   ```
   Should return JSON with packages array

### Issue: "Failed to fetch credit packages" error

**Solutions:**

1. **Check database connection**
   - Verify DATABASE_URL is correct in Vercel
   - Test connection from Vercel deployment logs

2. **Check table exists**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'credit_packages';
   ```

3. **Redeploy on Vercel**
   - Sometimes environment variables need a fresh deployment
   - Go to Vercel dashboard
   - Click "Redeploy" on latest deployment

---

## 📝 Migration File Location

The complete migration file is located at:
```
/database/migrations/007_seed_credit_packages.sql
```

You can also find it in the GitHub repository:
```
https://github.com/Jgabbard61/roblox-tool/blob/main/database/migrations/007_seed_credit_packages.sql
```

---

## 🎯 Next Steps After Seeding

1. ✅ **Test Purchase Flow**
   - Click a "Purchase" button
   - Complete test payment with Stripe test card
   - Verify credits are added

2. ✅ **Test Search with Credits**
   - Go back to main app (click "Return to Verifier")
   - Perform a search
   - Verify credit is deducted

3. ✅ **Monitor Transaction History**
   - Check dashboard transaction history
   - Should show both purchases and usage

4. ✅ **Set Up Stripe Webhooks** (if not done yet)
   - Configure webhook in Stripe dashboard
   - Point to: `https://your-domain.vercel.app/api/credits/webhook`
   - Select event: `checkout.session.completed`

---

## 💡 Customizing Packages (Optional)

Want to change pricing or add more packages?

### Add a New Package
```sql
INSERT INTO credit_packages (name, credits, price_cents, is_active, sort_order) 
VALUES ('Custom Pack', 500, 4500000, true, 5);
```

### Update Package Pricing
```sql
UPDATE credit_packages 
SET price_cents = 450000 
WHERE name = 'Professional Pack';
```

### Disable a Package
```sql
UPDATE credit_packages 
SET is_active = false 
WHERE name = 'Starter Pack';
```

---

## 📞 Support

If you encounter any issues:

1. Check Vercel deployment logs
2. Check Supabase query logs
3. Verify all environment variables are set
4. Try redeploying on Vercel

---

## ✅ Summary Checklist

- [ ] Logged into Supabase dashboard
- [ ] Opened SQL Editor
- [ ] Ran the seed migration SQL
- [ ] Verified 4 packages were inserted
- [ ] Refreshed the dashboard
- [ ] Confirmed packages are now visible
- [ ] Tested "Return to Verifier" button
- [ ] Ready to test purchase flow!

---

**Status After Completion**: 🎉 Your dashboard will be fully functional with all credit packages available for purchase!
