// FILE: src/app/api/admin/customers/[customerId]/logo/route.ts
// Customer logo upload endpoint

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { query } from '@/app/lib/db';

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
      'SELECT id, name FROM customers WHERE id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get file extension
    const extension = file.name.split('.').pop() || 'png';
    const fileName = `customer-${customerId}.${extension}`;
    const filePath = path.join(process.cwd(), 'public', 'customer-logos', fileName);

    // Delete old logo if exists
    const oldLogoResult = await query(
      'SELECT logo_url FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (oldLogoResult.rows.length > 0 && oldLogoResult.rows[0].logo_url) {
      const oldFileName = oldLogoResult.rows[0].logo_url.split('/').pop();
      if (oldFileName) {
        const oldFilePath = path.join(process.cwd(), 'public', 'customer-logos', oldFileName);
        try {
          await unlink(oldFilePath);
        } catch (err) {
          console.error('Failed to delete old logo:', err);
        }
      }
    }

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update database with logo URL
    const logoUrl = `/customer-logos/${fileName}`;
    await query(
      'UPDATE customers SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [logoUrl, customerId]
    );

    return NextResponse.json({ 
      success: true, 
      logoUrl,
      message: 'Logo uploaded successfully' 
    });

  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload logo',
      details: error instanceof Error ? error.message : 'Unknown error'
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
      // Delete file from disk
      const fileName = logoUrl.split('/').pop();
      if (fileName) {
        const filePath = path.join(process.cwd(), 'public', 'customer-logos', fileName);
        try {
          await unlink(filePath);
        } catch (err) {
          console.error('Failed to delete logo file:', err);
        }
      }

      // Update database
      await query(
        'UPDATE customers SET logo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [customerId]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logo deleted successfully' 
    });

  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
