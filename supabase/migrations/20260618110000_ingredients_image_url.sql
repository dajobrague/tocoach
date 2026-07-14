-- Ingredients cache: product image URL
--
-- Adds an optional thumbnail URL so cached foods resolved from Open Food Facts
-- can show a product image next to search results. Nullable: manual entries
-- and products without a photo simply have no image. No backfill — existing
-- rows stay NULL and acquire an image the next time they are re-resolved.

ALTER TABLE ingredients
    ADD COLUMN IF NOT EXISTS image_url TEXT;
