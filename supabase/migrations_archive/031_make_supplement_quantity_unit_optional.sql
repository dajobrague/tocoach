-- Make quantity and unit optional in supplement_inventory
-- Add product_url field for external product links
-- Client requested to remove quantity/unit fields and add URL field instead
-- Drop existing constraints
ALTER TABLE supplement_inventory DROP CONSTRAINT IF EXISTS unit_not_empty,
    DROP CONSTRAINT IF EXISTS quantity_non_negative;
-- Make fields nullable
ALTER TABLE supplement_inventory
ALTER COLUMN quantity DROP NOT NULL,
    ALTER COLUMN unit DROP NOT NULL;
-- Add new constraint to allow null values but if provided, quantity must be non-negative
ALTER TABLE supplement_inventory
ADD CONSTRAINT quantity_non_negative CHECK (
        quantity IS NULL
        OR quantity >= 0
    );
-- Add product_url field
ALTER TABLE supplement_inventory
ADD COLUMN IF NOT EXISTS product_url TEXT;
-- Update existing records to have null values (optional, depending on preference)
-- UPDATE supplement_inventory SET quantity = NULL, unit = NULL;
-- Add comments explaining the changes
COMMENT ON COLUMN supplement_inventory.quantity IS 'Optional quantity per unit - made optional per client request';
COMMENT ON COLUMN supplement_inventory.unit IS 'Optional unit of measurement - made optional per client request';
COMMENT ON COLUMN supplement_inventory.product_url IS 'Optional URL link to product page or purchase link';