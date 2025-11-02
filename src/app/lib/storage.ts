// FILE: src/app/lib/storage.ts
// Supabase Storage utility for file uploads

import { createClient } from '@supabase/supabase-js';

// Extract Supabase credentials from DATABASE_URL
// Format: postgresql://[user]:[password]@[host]/[database]
// Supabase pattern: postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
function getSupabaseConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  // Extract project reference from DATABASE_URL
  // Example: postgresql://postgres.rxyfhdfellmsssgsfci:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
  const match = dbUrl.match(/postgres\.([a-zA-Z0-9]+):.*@([a-z0-9.-]+)/);
  
  if (!match) {
    throw new Error('Could not parse Supabase project reference from DATABASE_URL');
  }

  const projectRef = match[1];
  
  // Construct Supabase URL
  const supabaseUrl = `https://${projectRef}.supabase.co`;
  
  // Get anon key from environment or use default
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key not configured. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in your environment variables.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

// Create Supabase client for storage operations
export function getStorageClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const STORAGE_BUCKET = 'customer-logos';

/**
 * Upload a file to Supabase Storage
 * @param bucket - Storage bucket name
 * @param path - File path in the bucket
 * @param file - File buffer to upload
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getStorageClient();

  // Upload file
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true, // Replace if exists
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param bucket - Storage bucket name
 * @param path - File path in the bucket
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Storage delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Ensure storage bucket exists and is public
 */
export async function ensureBucket(bucketName: string): Promise<void> {
  const supabase = getStorageClient();

  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  
  const bucketExists = buckets?.some(b => b.name === bucketName);
  
  if (!bucketExists) {
    // Create bucket with public access
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'],
    });

    if (error) {
      console.error('Failed to create bucket:', error);
      throw new Error(`Failed to create storage bucket: ${error.message}`);
    }
  }
}
