-- Migration: Add email verification fields to users table
-- Date: 2025-10-29
-- Description: Add fields for email verification functionality

-- Add new columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);

-- Create index for email verification token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Create index for phone number
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) 
WHERE phone_number IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification (expires after 24 hours)';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration timestamp for email verification token';
COMMENT ON COLUMN users.phone_number IS 'User phone number (optional)';
