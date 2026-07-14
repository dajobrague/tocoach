-- Nutrition-v2 flag split: trainer tools vs client experience.
--
-- The single nutrition_v2_enabled flag gated BOTH the trainer's v2 surfaces
-- (recipe library, importer, cycle builder) and every client's Nutrición page
-- at once — so a trainer could not prepare (import recipes, draft plans,
-- preview) without exposing clients to v2 on the spot.
--
-- nutrition_v2_trainer_enabled turns on the trainer tools ONLY; clients keep
-- the legacy experience until nutrition_v2_enabled flips (the real cutover,
-- semantics unchanged). Trainer tools are implicitly on for fully-flipped
-- tenants (readers treat trainer_enabled OR enabled as enabled).
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS nutrition_v2_trainer_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants.nutrition_v2_trainer_enabled IS
    'Prepare-phase flag: trainer sees the v2 nutrition tools while clients stay on legacy. nutrition_v2_enabled remains the client-facing cutover.';
