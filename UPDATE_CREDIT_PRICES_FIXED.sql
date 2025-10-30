-- ============================================
-- Update Credit Package Pricing (CORRECTED)
-- ============================================
-- 1 credit = $100
-- Column name: price_cents (stores price in cents)
-- 
-- This script updates the credit package prices to reflect the new pricing model

UPDATE credit_packages
SET 
  price_cents = 100000  -- 10 credits × $100 = $1,000 = 100,000 cents
WHERE name = 'Starter Pack' AND credits = 10;

UPDATE credit_packages
SET 
  price_cents = 500000  -- 50 credits × $100 = $5,000 = 500,000 cents
WHERE name = 'Professional Pack' AND credits = 50;

UPDATE credit_packages
SET 
  price_cents = 1000000  -- 100 credits × $100 = $10,000 = 1,000,000 cents
WHERE name = 'Business Pack' AND credits = 100;

UPDATE credit_packages
SET 
  price_cents = 2000000  -- 200 credits × $100 = $20,000 = 2,000,000 cents
WHERE name = 'Enterprise Pack' AND credits = 200;

-- Verify the updates
SELECT 
  id, 
  name, 
  credits, 
  price_cents,
  (price_cents::FLOAT / 100) AS price_dollars,
  is_active
FROM credit_packages
ORDER BY credits;
