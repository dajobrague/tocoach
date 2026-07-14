-- Serving data for cached foods (OFF v2 product API; the search index has none).
-- All three stay NULL until the row is lazily enriched on first selection;
-- serving_quantity_unit = 'none' marks "checked, OFF has no serving data" so
-- the enrichment never re-hits the API for the same product.
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS serving_size TEXT,
  ADD COLUMN IF NOT EXISTS serving_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS serving_quantity_unit TEXT;

COMMENT ON COLUMN ingredients.serving_size IS
  'Human serving label from OFF ("2 rebanadas (60 g)"); free text, display-only.';
COMMENT ON COLUMN ingredients.serving_quantity IS
  'One serving, in serving_quantity_unit. NULL = unknown/not yet enriched.';
COMMENT ON COLUMN ingredients.serving_quantity_unit IS
  'g | ml | none (none = enrichment ran and OFF had no serving data).';
