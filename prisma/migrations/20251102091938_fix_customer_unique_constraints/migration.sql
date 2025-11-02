-- Fix Customer unique constraints
-- Drop unique constraint on name field (company names don't need to be unique)
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_name_key";

-- Add unique constraint on contact_email field (emails should be unique per account)
ALTER TABLE "customers" ADD CONSTRAINT "customers_contact_email_key" UNIQUE ("contact_email");

-- Note: This migration also aligns with the schema change where:
-- - name (company name) is no longer unique
-- - contact_email is now unique to prevent duplicate accounts
