
-- Migration: Add email verification and phone number columns to users table
-- This migration adds support for email verification during registration

-- Add phone_number column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add email verification columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;

-- Create index for faster verification token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token 
ON users(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Create index for email lookups (for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Update the schema comment
COMMENT ON COLUMN users.phone_number IS 'User phone number (optional)';
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token sent to user email for verification';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration timestamp for the verification token';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Added columns: phone_number, email_verified, email_verification_token, email_verification_expires';
END $$;
