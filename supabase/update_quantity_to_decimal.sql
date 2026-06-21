-- Migration to change quantity column from integer to numeric
-- This allows for decimal values like 0.25, 0.5, etc.

-- Alter the order_items table to change quantity from integer to numeric
ALTER TABLE order_items 
ALTER COLUMN quantity TYPE numeric;

-- Optional: Add a check constraint to ensure quantity is positive
ALTER TABLE order_items 
ADD CONSTRAINT quantity_positive_check CHECK (quantity >= 0.25);
