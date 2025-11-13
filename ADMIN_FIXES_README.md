# Admin Dashboard Fixes - November 13, 2025

## Summary of Changes

This update fixes the "Failed to fetch customers" error in the Super Admin Dashboard and adds manual credit addition functionality.

## 🐛 Issues Fixed

### 1. Customers Tab Fetch Failure
**Problem:** The Customers tab in the Super Admin Dashboard was showing "Failed to fetch customers" error.

**Root Cause:** The `customer_stats` database view was missing the `contact_email`, `max_users`, and `logo_url` columns that the frontend expected.

**Solution:** Updated the `customer_stats` view to include all required fields.

### 2. Manual Credit Addition
**Added:** Super admins can now manually add credits to customer accounts directly from the admin dashboard.

## 📋 Changes Made

### Database Changes
1. **Migration 013:** Updated `customer_stats` view
   - Location: `database/migrations/013_fix_customer_stats_view.sql`
   - Adds: `contact_email`, `max_users`, `logo_url` fields to the view
   - File: `src/app/lib/db/schema.sql` (updated canonical schema)

2. **Migration Endpoint:** Updated `/api/admin/migrate` route
   - Now runs both migration 012 and 013
   - File: `src/app/api/admin/migrate/route.ts`

### Frontend Changes
1. **CustomerManagement Component**
   - Location: `src/app/admin/components/CustomerManagement.tsx`
   - Added "💳 Add Credits" button in the actions column
   - Added credit addition modal with form
   - Integrated with existing `/api/admin/credits/add` API endpoint
   - Includes validation and success/error feedback

### API (Already Existed)
- The `/api/admin/credits/add` endpoint was already implemented
- Supports SUPER_ADMIN and CUSTOMER_ADMIN roles
- Creates audit trail with admin username
- Validates amount (1-10,000 credits per transaction)

## 🚀 Deployment Instructions

### Step 1: Run the Database Migration

You have **two options** to apply the database migration:

#### Option A: Via Admin Dashboard (Recommended)
1. Deploy the updated code to Vercel
2. Log in to the Super Admin Dashboard
3. Open the browser console (F12)
4. Run this command:
   ```javascript
   fetch('/api/admin/migrate', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```
5. You should see: `{ success: true, message: "Migrations completed successfully..." }`

#### Option B: Via Database Client
If you prefer to run the SQL directly:

```sql
-- Fix customer_stats view to include missing fields
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
```

### Step 2: Verify the Fix

1. Go to Super Admin Dashboard: `/admin`
2. Click on the "Customers" tab
3. ✅ You should now see the list of customers (no error)
4. ✅ Each customer should have an "💳 Add Credits" button

### Step 3: Test Manual Credit Addition

1. Click "💳 Add Credits" on any customer
2. Enter:
   - **Credit Amount:** e.g., 100
   - **Description:** e.g., "VerifyLens support added credits"
3. Click "Add Credits"
4. ✅ You should see a success message with transaction details

## 📝 Usage

### Adding Credits to a Customer

1. Navigate to **Super Admin Dashboard** → **Customers** tab
2. Find the customer you want to add credits to
3. Click **💳 Add Credits** in the Actions column
4. In the modal:
   - Enter the number of credits (1-10,000)
   - Enter a description for the audit trail
   - Click **Add Credits**
5. The system will:
   - Validate the inputs
   - Create a credit transaction
   - Log the action with your username
   - Show the new balance
   - Update the customer list

### Audit Trail

All manual credit additions are logged with:
- Admin username who added the credits
- Amount added
- Description: `[ADMIN] {your description} (Added by: {username})`
- Transaction ID
- Balance before and after
- Timestamp

You can view these transactions in the credit transaction history.

## 🔒 Security

- Only users with `SUPER_ADMIN` role can add credits via the Customers tab
- All actions are logged with the admin's username
- Amount is validated (max 10,000 per transaction)
- Proper authorization checks on the API endpoint

## 📂 Files Modified

```
database/migrations/
  └── 013_fix_customer_stats_view.sql          [NEW]

scripts/
  └── run-migration-013.js                     [NEW]

src/app/lib/db/
  └── schema.sql                               [MODIFIED]

src/app/api/admin/migrate/
  └── route.ts                                 [MODIFIED]

src/app/admin/components/
  └── CustomerManagement.tsx                   [MODIFIED]
```

## ✅ Testing Checklist

- [ ] Migration runs successfully (no errors in console)
- [ ] Customers tab loads and displays customer list
- [ ] All customer fields are visible (name, status, users, searches, etc.)
- [ ] "Add Credits" button appears for each customer
- [ ] Add Credits modal opens when button is clicked
- [ ] Form validation works (positive numbers, max 10,000, description required)
- [ ] Credits are successfully added
- [ ] Success message shows transaction details
- [ ] Customer list refreshes after adding credits
- [ ] Audit log contains the admin's username and description

## 🆘 Troubleshooting

### Customers tab still shows error after migration
1. Check browser console for errors
2. Verify migration ran successfully: Check `/api/admin/migrate` response
3. Check database connection in Vercel logs
4. Verify the `customer_stats` view exists: Run `SELECT * FROM customer_stats LIMIT 1;`

### Add Credits fails
1. Check browser console network tab for the API response
2. Verify you're logged in as SUPER_ADMIN
3. Check amount is between 1 and 10,000
4. Check description is not empty
5. Check Vercel function logs for backend errors

### Need to revert?
If you need to revert the view changes:
```sql
-- Revert to old view (missing fields)
DROP VIEW IF EXISTS customer_stats;
CREATE VIEW customer_stats AS
SELECT 
    c.id, c.name, c.is_active, c.created_at,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    MAX(u.last_login) as last_login_at
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
GROUP BY c.id, c.name, c.is_active, c.created_at;
```

## 📞 Support

If you encounter any issues, please check:
1. Vercel deployment logs
2. Browser console errors
3. Database connection status
4. Migration was applied successfully

---

**Commit Message:** `Fix admin customers tab and add manual credit addition for super admins`

**Date:** November 13, 2025
**Developer:** DeepAgent (Abacus.AI)
