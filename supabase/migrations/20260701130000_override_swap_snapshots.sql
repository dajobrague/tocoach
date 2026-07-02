-- =====================================================
-- MULTI-ITEM SWAP OVERRIDES
-- =====================================================
-- A swap override can now replace a meal with one OR MORE items (e.g. two
-- dishes, or a re-portioned version of the same meal). The frozen snapshots are
-- stored as an ordered JSONB array. Legacy single-item swaps keep using
-- `swap_snapshot`; resolution falls back to it when `swap_snapshots` is null.

ALTER TABLE meal_cycle_overrides
    ADD COLUMN IF NOT EXISTS swap_snapshots JSONB;

COMMENT ON COLUMN meal_cycle_overrides.swap_snapshots IS
    'Ordered array of frozen OptionSnapshots for a multi-item swap; null for legacy single-item swaps (see swap_snapshot).';
