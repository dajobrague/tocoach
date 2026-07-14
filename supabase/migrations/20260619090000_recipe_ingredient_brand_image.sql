-- Recipe ingredients: frozen brand + image for display
--
-- Recipe ingredient lines already freeze name + per-100g nutrients. Add the
-- brand and product image alongside them so the library can show what an
-- ingredient is beyond its name. Nullable: manual/raw lines have neither, and
-- existing rows stay NULL (no backfill) until re-added.

ALTER TABLE recipe_ingredients
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT;
