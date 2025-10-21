# Quick Setup Guide: Supabase Storage for Logo Uploads

## 🚀 Quick Start (5 minutes)

### Step 1: Get Your Supabase Anon Key

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **`anon`** public key (should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`)

⚠️ **Important:** Copy the `anon` key, NOT the `service_role` key!

### Step 2: Add to Vercel Environment Variables

#### Using Vercel Dashboard (Recommended):
1. Go to https://vercel.com/dashboard
2. Select your project (`roblox-tool`)
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** (paste your anon key from Step 1)
   - **Environments:** Select all (Production, Preview, Development)
6. Click **Save**

#### Using Vercel CLI (Alternative):
```bash
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste your anon key when prompted
# Select all environments
```

### Step 3: Deploy

The changes are already committed. Just trigger a new deployment:

```bash
git push origin main
```

Or manually trigger from Vercel Dashboard:
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment

### Step 4: Test

1. Open your admin dashboard
2. Go to **Customers** tab
3. Click **Logo** button for any customer
4. Upload an image
5. You should see: ✅ "Logo uploaded successfully to cloud storage"

## 📋 Troubleshooting

### Error: "Supabase anon key not configured"

**Solution:** You forgot Step 2! Add the environment variable to Vercel.

### Error: "Failed to access or create the storage bucket"

**Solution:** Create the bucket manually in Supabase:

1. Go to Supabase Dashboard → **Storage**
2. Click **New Bucket**
3. Name: `customer-logos`
4. **Enable** "Public bucket"
5. Click **Create bucket**

### Storage Policies (if auto-creation fails)

Run this SQL in Supabase SQL Editor:

```sql
-- Allow public read access to customer logos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-logos');

-- Allow authenticated uploads
CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-logos');

-- Allow authenticated updates
CREATE POLICY "Authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'customer-logos');

-- Allow authenticated deletes
CREATE POLICY "Authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'customer-logos');
```

## 🖼️ Image Requirements

| Property | Requirement |
|----------|-------------|
| **Formats** | JPG, JPEG, PNG, GIF, BMP |
| **Max Size** | 5MB |
| **Recommended Size** | Under 1MB |
| **Recommended Dimensions** | 400x400 pixels (square) |
| **Min Dimensions** | 200x200 pixels |

## 💰 Cost

**Free Tier:**
- 1GB storage
- 2GB bandwidth/month

**Estimated Usage (100 customers):**
- Storage: ~10MB
- Bandwidth: ~1GB/month

**Conclusion:** Free tier is more than sufficient! 

## ⚙️ What Changed?

- ✅ Logos now stored in **Supabase Storage** (cloud) instead of local filesystem
- ✅ Works perfectly on **Vercel** serverless platform
- ✅ Better **error handling** and user feedback
- ✅ **Persistent storage** across deployments

## 🔧 Technical Details

### Files Modified:
1. `src/app/lib/storage.ts` (NEW) - Supabase storage utility
2. `src/app/api/admin/customers/[customerId]/logo/route.ts` - Updated to use cloud storage
3. `src/app/admin/components/CustomerManagement.tsx` - Better error handling
4. `package.json` - Added `@supabase/supabase-js` dependency

### Environment Variables:
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** (NEW - required)
- DATABASE_URL (existing - used to detect Supabase project)

## 📞 Need Help?

**Check deployment logs:**
```bash
vercel logs --follow
```

**Check your environment variables:**
```bash
vercel env ls
```

**Test locally:**
```bash
npm install
npm run dev
```

## ✅ Verification Checklist

- [ ] Supabase anon key added to Vercel
- [ ] Deployment successful
- [ ] Can upload a logo successfully
- [ ] Logo displays after upload
- [ ] Logo persists after page reload
- [ ] Can delete a logo successfully
- [ ] Error messages appear for invalid files

---

**That's it!** Logo uploads should now work perfectly on Vercel. 🎉
