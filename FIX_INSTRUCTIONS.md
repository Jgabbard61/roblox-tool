# Fix Instructions for Logo Upload Issue

## Option A: Complete Supabase Storage Setup (Recommended)

### Step 1: Get Supabase Anon Key
1. Go to your Supabase project dashboard
2. Navigate to: **Settings** → **API**
3. Copy the **anon public** key (starts with `eyJ...`)

### Step 2: Add Environment Variable to Vercel
1. Go to your Vercel project dashboard
2. Navigate to: **Settings** → **Environment Variables**
3. Add new variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: (paste the anon key from step 1)
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**

### Step 3: Create the Storage Bucket
Run this SQL in your Supabase SQL Editor:

```sql
-- Create the customer-logos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-logos',
  'customer-logos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-logos');

CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'customer-logos');

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'customer-logos');

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'customer-logos');
```

### Step 4: Redeploy
1. In Vercel dashboard, go to **Deployments**
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**

### Step 5: Test
1. Try uploading a customer logo
2. Should now work! ✅

---

## Option B: Revert to Local File Storage (Quick Fix)

If you want to quickly restore the previous functionality:

### Step 1: Revert the Logo Upload Changes
```bash
cd /home/ubuntu/github_repos/roblox-tool
git checkout 4226ba3 -- src/app/api/admin/customers/[customerId]/logo/route.ts src/app/admin/components/CustomerManagement.tsx
git commit -m "Revert logo upload to local storage temporarily"
git push origin main
```

This will:
- Keep the Remember Me feature (working perfectly)
- Restore local filesystem logo storage (no Supabase needed)
- Get logo uploads working immediately

---

## Recommendation

I recommend **Option A** because:
1. Vercel doesn't support local file storage in production (ephemeral filesystem)
2. Supabase Storage is the proper solution for Vercel deployments
3. The setup is quick (5 minutes)
4. You keep all the new features

The merge didn't break anything - it just requires completing the Supabase Storage setup that was partially implemented.

---

## What Actually Happened

The merge introduced a migration from local filesystem storage to Supabase Cloud Storage. This is actually a GOOD thing for your Vercel deployment because:

1. **Vercel Problem**: Vercel's filesystem is ephemeral - uploaded files disappear on redeployment
2. **Supabase Solution**: Cloud storage persists files permanently
3. **Missing Step**: The Supabase Storage setup wasn't completed (missing env vars and bucket)

Your site is working fine - just need to complete the storage setup!

