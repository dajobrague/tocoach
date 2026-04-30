-- Migración 083: Sistema de gráficas personalizables (Custom Charting System).
--
-- Contexto: hasta hoy, el dashboard del cliente renderizaba 6 gráficas
-- hard-coded (peso, sueño, calorías, proteína, macros, entrenamiento) en
-- components/client-dashboard/progress-charts.tsx. Esta migración introduce
-- un sistema configurable donde:
--   1) cada trainer tiene una "plantilla de gráficas" por defecto que
--      aplica a todos sus clientes
--   2) cada cliente puede tener un override propio (snapshot completo,
--      no diff)
--   3) la presencia de la fila de override es lo que distingue "este
--      cliente está personalizado" vs "hereda la plantilla"
--
-- Diseño:
--  - trainer_chart_templates: una fila por (tenant_host, trainer_id)
--  - client_chart_configs: una fila por (tenant_host, client_id) — sólo
--    existe si el trainer ha personalizado a ese cliente
--  - chart_config_audit: trail "best-effort" de cada save / apply-to-all /
--    reset, para soporte y forensics
--
-- Decisiones que difieren del spec original (docs/superpowers/specs/...):
--  * Columna tenant_host (no tenant_slug) — convención del codebase; almacena
--    valores de slug pero el nombre legacy se mantiene.
--  * trainer_id REFERENCES trainers(id) (no auth.users(id)) — alineado con
--    lib/auth/session.ts que consulta directamente la tabla trainers.
--  * client_id BIGINT REFERENCES clients(id) (no UUID/auth.users) — alineado
--    con el resto del schema (form_responses, exercise_logs, etc. todos
--    usan BIGINT clients(id)).
--  * RLS permisiva (USING true) — alineado con migraciones recientes
--    (074_nutrition_option_selections.sql, 076_exercise_log_sets_and_video.sql).
--    La autorización se aplica en la capa de API (chequeo de
--    getTrainerSession + ownership de trainer_clients antes de cualquier
--    query). Esto NO debilita el modelo de seguridad: las rutas del API
--    son la única superficie de acceso, y todas validan tenant + ownership
--    antes de tocar la base.
--
-- Aditiva: 3 tablas nuevas, no toca tablas existentes, no migra datos
-- de usuarios. Idempotente (IF NOT EXISTS + ON CONFLICT DO NOTHING en el
-- seed). Toda la migración va en una transacción.

BEGIN;

-- ============================================================================
-- TABLA 1: trainer_chart_templates
-- Plantilla por defecto que el trainer configura una vez. Aplica a todos
-- sus clientes salvo que el cliente tenga un override en client_chart_configs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_chart_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants (host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers (id) ON DELETE CASCADE,
    -- Documento JSONB con shape { version: 1, charts: ChartConfig[] }
    -- Validación de shape en la capa zod (lib/charts/validation.ts), no en SQL
    -- (el spec evoluciona y CHECKs sobre jsonb son frágiles).
    charts JSONB NOT NULL DEFAULT jsonb_build_object('version', 1, 'charts', '[]'::jsonb),
    -- Cuando true (default), los clientes nuevos creados después de hoy
    -- heredan esta plantilla automáticamente. Mismo patrón que
    -- form_templates.auto_apply_to_new_clients (migración 081).
    auto_apply_to_new_clients BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trainer_chart_templates_unique_per_trainer UNIQUE (tenant_host, trainer_id),
    CONSTRAINT trainer_chart_templates_charts_is_object CHECK (jsonb_typeof(charts) = 'object')
);

CREATE INDEX IF NOT EXISTS trainer_chart_templates_tenant_idx
    ON trainer_chart_templates (tenant_host);

CREATE INDEX IF NOT EXISTS trainer_chart_templates_updated_at_idx
    ON trainer_chart_templates (updated_at DESC);

COMMENT ON TABLE trainer_chart_templates IS
    'Default chart template per trainer. Clients fall back to this when no row exists in client_chart_configs.';
COMMENT ON COLUMN trainer_chart_templates.charts IS
    'Document of the form { version: 1, charts: ChartConfig[] }. Schema validated in app layer (lib/charts/validation.ts), not in SQL.';
COMMENT ON COLUMN trainer_chart_templates.auto_apply_to_new_clients IS
    'When true, newly-created clients of this trainer have NO override row by default — they inherit this template live. Future template edits propagate automatically.';

-- ============================================================================
-- TABLA 2: client_chart_configs
-- Override por cliente. La AUSENCIA de fila significa "hereda la plantilla
-- del trainer en vivo". La PRESENCIA significa "este cliente está
-- personalizado y los cambios futuros del trainer en su plantilla NO se
-- propagan a este cliente hasta que se invoque apply-to-all (delete) o
-- reset-to-template (delete específico)".
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_chart_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants (host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    charts JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT client_chart_configs_unique_per_client UNIQUE (tenant_host, client_id),
    CONSTRAINT client_chart_configs_charts_is_object CHECK (jsonb_typeof(charts) = 'object')
);

CREATE INDEX IF NOT EXISTS client_chart_configs_tenant_idx
    ON client_chart_configs (tenant_host);

CREATE INDEX IF NOT EXISTS client_chart_configs_client_idx
    ON client_chart_configs (client_id);

CREATE INDEX IF NOT EXISTS client_chart_configs_updated_at_idx
    ON client_chart_configs (updated_at DESC);

COMMENT ON TABLE client_chart_configs IS
    'Per-client override for charts. Row absence => inherit trainer template live. Row presence => snapshot frozen to whatever was last saved here.';
COMMENT ON COLUMN client_chart_configs.charts IS
    'Full snapshot, not a diff. Same shape as trainer_chart_templates.charts.';

-- ============================================================================
-- TABLA 3: chart_config_audit
-- Trail best-effort de modificaciones. NO bloqueante: si el insert falla,
-- el save principal ya hizo commit. Útil para soporte y para deshacer
-- "apply to all" accidentales (before_charts trae el snapshot deleted).
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_config_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL,
    -- actor_user_id es auth.uid() del trainer que disparó la acción.
    -- No usamos FK a auth.users(id) porque el actor podría haber sido
    -- baja antes de que se consulte el audit (queremos preservar el
    -- registro histórico).
    actor_user_id UUID NOT NULL,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('template','client')),
    -- Para target_kind='template': trainer_chart_templates.id.
    -- Para target_kind='client': el id BIGINT del cliente, casteado a TEXT
    -- (porque el id de la tabla es UUID pero el target puede ser BIGINT —
    -- guardamos como TEXT para tolerar ambas formas).
    target_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('save','apply_to_all','reset_to_template')),
    before_charts JSONB,
    after_charts JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chart_config_audit_target_idx
    ON chart_config_audit (tenant_host, target_kind, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chart_config_audit_actor_idx
    ON chart_config_audit (actor_user_id, created_at DESC);

COMMENT ON TABLE chart_config_audit IS
    'Best-effort audit trail of chart config changes. Non-blocking: a failed insert here MUST NOT roll back the underlying save. Retention: 12 months (cleanup TODO not in this scope).';

-- ============================================================================
-- TRIGGERS: updated_at
-- Reusa la función update_updated_at_column() ya definida en migración 001.
-- ============================================================================

DROP TRIGGER IF EXISTS update_trainer_chart_templates_updated_at ON trainer_chart_templates;
CREATE TRIGGER update_trainer_chart_templates_updated_at
    BEFORE UPDATE ON trainer_chart_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_chart_configs_updated_at ON client_chart_configs;
CREATE TRIGGER update_client_chart_configs_updated_at
    BEFORE UPDATE ON client_chart_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS
-- Patrón permisivo + autorización en capa de app (alineado con migraciones
-- 074, 076, etc.). La superficie de acceso a estas tablas es exclusivamente
-- las rutas /api/charts/*, todas las cuales:
--   1) verifican getTrainerSession() o getClientSession() según corresponda
--   2) validan que el trainer es dueño del cliente vía trainer_clients
--   3) validan tenant ownership
-- antes de cualquier query.
-- ============================================================================

ALTER TABLE trainer_chart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_chart_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_config_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_chart_templates_app_layer ON trainer_chart_templates;
CREATE POLICY trainer_chart_templates_app_layer ON trainer_chart_templates
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS client_chart_configs_app_layer ON client_chart_configs;
CREATE POLICY client_chart_configs_app_layer ON client_chart_configs
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS chart_config_audit_app_layer ON chart_config_audit;
CREATE POLICY chart_config_audit_app_layer ON chart_config_audit
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY trainer_chart_templates_app_layer ON trainer_chart_templates IS
    'Permissive RLS — authorization enforced in /api/charts/* routes. See migration 074 for the same pattern.';
COMMENT ON POLICY client_chart_configs_app_layer ON client_chart_configs IS
    'Permissive RLS — authorization enforced in /api/charts/* routes.';
COMMENT ON POLICY chart_config_audit_app_layer ON chart_config_audit IS
    'Permissive RLS — audit writes happen from server routes only; reads are gated by app-layer admin check.';

-- ============================================================================
-- SEED: starter template para todos los trainers existentes.
-- Reproduce las 6 gráficas que el dashboard muestra hoy. ON CONFLICT DO NOTHING
-- preserva cualquier plantilla ya personalizada al re-aplicar la migración.
-- ============================================================================

INSERT INTO trainer_chart_templates (tenant_host, trainer_id, charts, auto_apply_to_new_clients)
SELECT
    t.tenant_host,
    t.id,
    jsonb_build_object(
        'version', 1,
        'charts', jsonb_build_array(
            -- 0. PESO: AreaChart con gradiente, fuente checkin weight, sin avg line
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 0,
                'label', 'PESO',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'weight'),
                'chart_type', 'area',
                'color', 'weight-amber',
                'aggregation', 'checkin_period'
            ),
            -- 1. SUEÑO: BarChart con target zone 7-9h y margen amarillo de 1h
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 1,
                'label', 'SUEÑO',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'sleep_hours'),
                'chart_type', 'bar',
                'color', 'sleep-emerald',
                'target_zone', jsonb_build_object('min', 7, 'max', 9, 'margin', 1),
                'aggregation', 'checkin_period'
            ),
            -- 2. CALORÍAS: BarChart con avg line
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 2,
                'label', 'CALORÍAS',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'calories'),
                'chart_type', 'bar',
                'color', 'calorie-coral',
                'aggregation', 'checkin_period',
                'show_average_line', true
            ),
            -- 3. PROTEÍNA: AreaChart con avg line
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 3,
                'label', 'PROTEÍNA',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'protein'),
                'chart_type', 'area',
                'color', 'protein-indigo',
                'aggregation', 'checkin_period',
                'show_average_line', true
            ),
            -- 4. MACROS: ring multi-serie sobre todo el rango (range_total)
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 4,
                'label', 'MACROS',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'macros_breakdown'),
                'chart_type', 'ring',
                'color', jsonb_build_array('protein-indigo', 'carbs-emerald-deep', 'fats-amber-deep'),
                'aggregation', 'range_total'
            ),
            -- 5. ENTRENAMIENTO: stacked_bar (fuerza + cardio)
            jsonb_build_object(
                'id', gen_random_uuid(),
                'position', 5,
                'label', 'ENTRENAMIENTO',
                'source', jsonb_build_object('kind', 'catalog', 'id', 'training_breakdown'),
                'chart_type', 'stacked_bar',
                'color', jsonb_build_array('training-blue', 'cardio-rose'),
                'aggregation', 'checkin_period'
            )
        )
    ),
    true
FROM trainers t
ON CONFLICT (tenant_host, trainer_id) DO NOTHING;

COMMIT;
