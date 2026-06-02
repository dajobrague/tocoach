-- Per-trainer nutrition_v2 feature flag (P0-T5)
--
-- Additive, non-destructive: a single boolean on tenants, default OFF. Backfills
-- existing rows to false via the column default. Gating of UI/routes behind this
-- flag lands incrementally as those features ship; this migration only adds the
-- flag itself.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS nutrition_v2_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants.nutrition_v2_enabled IS
    'Per-trainer feature flag for the nutrition-v2 rebuild. Default false (off).';
