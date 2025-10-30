-- Update Credit Package Pricing
-- 1 credit = $100
-- 
-- This script updates the credit package prices to reflect the new pricing model

UPDATE credit_packages
SET 
  price = 1000.00,  -- 10 credits × $100 = $1,000
  price_per_credit = 100.00
WHERE name = 'Starter Pack' AND credits = 10;

UPDATE credit_packages
SET 
  price = 5000.00,  -- 50 credits × $100 = $5,000
  price_per_credit = 100.00
WHERE name = 'Professional Pack' AND credits = 50;

UPDATE credit_packages
SET 
  price = 10000.00,  -- 100 credits × $100 = $10,000
  price_per_credit = 100.00
WHERE name = 'Business Pack' AND credits = 100;

UPDATE credit_packages
SET 
  price = 20000.00,  -- 200 credits × $100 = $20,000
  price_per_credit = 100.00
WHERE name = 'Enterprise Pack' AND credits = 200;

-- Verify the updates
SELECT id, name, credits, price, price_per_credit, is_active
FROM credit_packages
ORDER BY sort_order;
