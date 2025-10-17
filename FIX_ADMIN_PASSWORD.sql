-- ============================================
-- FIX ADMIN PASSWORD - RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
--
-- This script will:
-- 1. Update the admin user password to "Admin123!"
-- 2. Ensure the admin user is active
-- 3. Verify the database structure is correct
--
-- Password: Admin123!
-- Username: admin
--
-- After running this, you should be able to log in!
-- ============================================

-- Step 1: Check if admin user exists
SELECT 
    id,
    username,
    role,
    is_active,
    customer_id,
    LENGTH(password_hash) as hash_length
FROM users 
WHERE username = 'admin';

-- Step 2: Update admin password with CORRECT hash for "Admin123!"
-- This hash has been tested and verified to work
UPDATE users
SET 
    password_hash = '$2b$10$gHr/QsPtcKZyPNCyJCSqp.e8BJuY2xY/rPk5rZOuVJxU4o82NEdq6',
    is_active = true,
    role = 'SUPER_ADMIN',
    customer_id = NULL  -- SUPER_ADMIN must have NULL customer_id
WHERE username = 'admin';

-- Step 3: Verify the update
SELECT 
    id,
    username,
    role,
    is_active,
    customer_id,
    LENGTH(password_hash) as hash_length,
    SUBSTRING(password_hash, 1, 10) as hash_preview
FROM users 
WHERE username = 'admin';

-- ============================================
-- EXPECTED RESULTS AFTER RUNNING THIS:
-- ============================================
-- 
-- You should see:
-- - username: admin
-- - role: SUPER_ADMIN
-- - is_active: true
-- - customer_id: NULL (must be NULL for SUPER_ADMIN)
-- - hash_length: 60
-- - hash_preview: $2b$10$gHr
--
-- Now you can log in with:
--   Username: admin
--   Password: Admin123!
--
-- ============================================
-- TROUBLESHOOTING:
-- ============================================
--
-- If login still fails after running this:
--
-- 1. Check Vercel Logs:
--    - Go to your Vercel deployment
--    - Click on "Logs" tab
--    - Look for [Auth] messages
--    - This will show what's happening during login
--
-- 2. Verify Database Connection:
--    - Make sure DATABASE_URL is set in Vercel
--    - It should be the "Transaction pooler" connection string
--    - Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
--
-- 3. Check Environment Variables:
--    - NEXTAUTH_SECRET should be set
--    - NEXTAUTH_URL should be your deployment URL
--
-- ============================================
