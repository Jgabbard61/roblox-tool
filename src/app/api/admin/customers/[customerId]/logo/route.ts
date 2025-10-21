// FILE: src/app/api/admin/customers/[customerId]/logo/route.ts
// Customer logo upload endpoint with Supabase Storage

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import { uploadFile, deleteFile, STORAGE_BUCKET, ensureBucket } from '@/app/lib/storage';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the uploaded file from FormData
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed types: .jpg, .jpeg, .png, .gif, .bmp' 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB' 
      }, { status: 400 });
    }

    // Check if customer exists
    const customerResult = await query(
      'SELECT id, name, logo_url FROM customers WHERE id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customerResult.rows[0];

    // Ensure storage bucket exists
    try {
      await ensureBucket(STORAGE_BUCKET);
    } catch (err) {
      console.error('Bucket creation/verification failed:', err);
      // Continue - bucket might already exist
    }

    // Get file extension
    const extension = file.name.split('.').pop() || 'png';
    const fileName = `customer-${customerId}.${extension}`;
    const filePath = `${fileName}`;

    // Delete old logo if exists (from Supabase Storage)
    if (customer.logo_url) {
      try {
        // Extract filename from URL if it's a Supabase URL
        const oldFileName = customer.logo_url.split('/').pop();
        if (oldFileName) {
          await deleteFile(STORAGE_BUCKET, oldFileName);
        }
      } catch (err) {
        console.error('Failed to delete old logo:', err);
        // Continue - not critical if old logo deletion fails
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const logoUrl = await uploadFile(STORAGE_BUCKET, filePath, buffer, file.type);

    // Update database with logo URL
    await query(
      'UPDATE customers SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [logoUrl, customerId]
    );

    return NextResponse.json({ 
      success: true, 
      logoUrl,
      message: 'Logo uploaded successfully to cloud storage' 
    });

  } catch (error) {
    console.error('Logo upload error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload logo';
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorDetails.includes('Supabase')) {
      errorMessage = 'Storage service configuration error';
      errorDetails = 'Please ensure Supabase storage is properly configured. Check that NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable is set.';
    } else if (errorDetails.includes('bucket')) {
      errorMessage = 'Storage bucket error';
      errorDetails = 'Failed to access or create the storage bucket. Please check Supabase storage permissions.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get current logo URL
    const result = await query(
      'SELECT logo_url FROM customers WHERE id = $1',
      [customerId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const logoUrl = result.rows[0].logo_url;
    
    if (logoUrl) {
      // Delete file from Supabase Storage
      try {
        const fileName = logoUrl.split('/').pop();
        if (fileName) {
          await deleteFile(STORAGE_BUCKET, fileName);
        }
      } catch (err) {
        console.error('Failed to delete logo file from storage:', err);
        // Continue - we'll still update the database
      }

      // Update database
      await query(
        'UPDATE customers SET logo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [customerId]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo deleted successfully from cloud storage' 
    });

  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
