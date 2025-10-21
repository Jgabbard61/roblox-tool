-- ============================================================================
-- Supabase Storage RLS Policies for customer-logos Bucket
-- ============================================================================
-- Quick Fix: Copy and paste this entire file into Supabase SQL Editor
-- Then click "Run" to create all necessary policies at once
-- ============================================================================

-- 1️⃣ POLICY: Allow authenticated users to INSERT (upload) files
CREATE POLICY "Allow authenticated users to upload logos"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'customer-logos');

-- 2️⃣ POLICY: Allow public SELECT (read) access to all files
CREATE POLICY "Allow public read access to logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'customer-logos');

-- 3️⃣ POLICY: Allow authenticated users to UPDATE files
CREATE POLICY "Allow authenticated users to update logos"
ON storage.objects
FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'customer-logos')
WITH CHECK (bucket_id = 'customer-logos');

-- 4️⃣ POLICY: Allow authenticated users to DELETE files
CREATE POLICY "Allow authenticated users to delete logos"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (bucket_id = 'customer-logos');

-- ============================================================================
-- VERIFICATION: Check that policies were created
-- ============================================================================
SELECT 
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%logos%'
ORDER BY cmd, policyname;
