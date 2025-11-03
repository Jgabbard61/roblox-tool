-- Fix VARCHAR(10) constraint on api_keys.key_prefix
-- The key_prefix stores the first 12 characters of the API key (e.g., "vrl_live_abc")
-- but was incorrectly constrained to VARCHAR(10)

-- First, check if the column exists and what its current type is
-- If it's VARCHAR(10), alter it to VARCHAR(20) to be safe

DO $$
BEGIN
    -- Check if key_prefix column exists and alter it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
          AND column_name = 'key_prefix'
          AND character_maximum_length = 10
    ) THEN
        ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE VARCHAR(20);
        RAISE NOTICE 'Updated api_keys.key_prefix from VARCHAR(10) to VARCHAR(20)';
    END IF;
END $$;

-- Add contact_email unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'customers_contact_email_key'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_contact_email_key UNIQUE (contact_email);
        RAISE NOTICE 'Added unique constraint to customers.contact_email';
    END IF;
END $$;

-- Check for any other VARCHAR(10) constraints that might be problematic
-- List all VARCHAR(10) columns for review
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name, column_name 
        FROM information_schema.columns
        WHERE character_maximum_length = 10
          AND table_schema = 'public'
        ORDER BY table_name, column_name
    ) LOOP
        RAISE NOTICE 'Found VARCHAR(10) column: %.% - please review', r.table_name, r.column_name;
    END LOOP;
END $$;
