-- Meal-cycle templates (Jul 28 call): a trainer saves a client's plan as a
-- reusable tenant-wide template ("Dieta 2500 kcal") and instantiates it for
-- other clients. The full days → meals → options tree (frozen snapshots
-- included) lives in `document` JSONB, so instantiation is a pure copy and
-- templates survive later recipe edits/deletions exactly like cycles do.

CREATE TABLE IF NOT EXISTS meal_cycle_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL,
    trainer_id UUID,
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days >= 1),
    document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_cycle_templates_tenant_idx
    ON meal_cycle_templates (tenant_host, created_at DESC);

ALTER TABLE meal_cycle_templates ENABLE ROW LEVEL SECURITY;

-- Permissive like every nutrition-v2 table: isolation is app-layer via
-- tenant_host filters in the service (see docs/architecture note in
-- 20260603052805_meal_cycles.sql).
CREATE POLICY "Allow anon to manage meal_cycle_templates" ON meal_cycle_templates
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage meal_cycle_templates" ON meal_cycle_templates
    TO authenticated USING (true) WITH CHECK (true);
