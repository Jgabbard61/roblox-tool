-- Migration: Add logo_url column to customers table
-- Date: 2025-10-21
-- Description: Add support for customer white-label logos

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN customers.logo_url IS 'URL to customer logo for white-label branding';
