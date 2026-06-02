-- FK + tenant lookup indexes on scheduled_session_exercises (migration 093).
--
-- Migration 093 declared FKs to exercises(id) and tenants(host) with
-- ON DELETE CASCADE but did not add indexes on those columns. Without
-- them:
--   - Deleting an exercise scans this table (sequential scan of all
--     overrides across all tenants) to find dependent rows.
--   - Deleting a tenant has the same problem.
--   - Future tenant-scoped queries (e.g. analytics, RLS lifts) would
--     full-scan instead of using a tenant index.

CREATE INDEX IF NOT EXISTS scheduled_session_exercises_exercise_id_idx
    ON scheduled_session_exercises (exercise_id);

CREATE INDEX IF NOT EXISTS scheduled_session_exercises_tenant_host_idx
    ON scheduled_session_exercises (tenant_host);

-- scheduled_session_exercise_sets (migration 094) already has the parent
-- FK index from 094 line 36; only the tenant_host needs one.
CREATE INDEX IF NOT EXISTS scheduled_session_exercise_sets_tenant_host_idx
    ON scheduled_session_exercise_sets (tenant_host);
