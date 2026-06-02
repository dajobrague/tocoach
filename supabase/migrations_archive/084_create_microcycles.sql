-- Migración 084: Microciclos del cliente.
--
-- Contexto: hasta ahora la vista del cliente calculaba "próximos
-- entrenamientos" matcheando session.metadata.day_of_week con la fecha
-- actual (workouts-content.tsx:464-545). Esta migración introduce el
-- concepto de "microciclo" — secuencia ordenada de N días que el
-- entrenador arma sobre el client_program activo, y que el cliente ve
-- como referencia mientras elige libremente qué sesión hacer.
--
-- Diseño:
--   1) microcycles: una fila por client_program. UNIQUE(client_program_id)
--      impone "un microciclo por programa de cliente" — si más adelante
--      se quieren microciclos progresivos, se quita el constraint y se
--      añade cycle_index/effective_from.
--   2) microcycle_slots: cada día del microciclo apunta a una session
--      (session_id) o representa un día de descanso explícito (session_id
--      NULL). Días no listados (day_index ausente) también son descanso,
--      pero implícito — la expansión a "todos los días" la hace el
--      endpoint GET /api/client/microcycle, no la BD.
--
-- Decisiones alineadas con el resto del repo:
--  * tenant_host TEXT REFERENCES tenants(host) ON DELETE CASCADE — patrón
--    canónico desde la migración 008.
--  * Naming de índices con sufijo _idx (no prefijo idx_) — patrón
--    consistente desde 008 hasta 083.
--  * Trigger updated_at reutilizando update_updated_at_column() definida
--    en migración 001.
--  * RLS permisiva (FOR ALL TO anon, authenticated USING true) — alineado
--    con migraciones 017, 074, 076, 083. La autorización real se aplica
--    en la capa API: todos los endpoints del microciclo verifican
--    tenant + ownership con withTenantProtection + getTrainerSession /
--    getClientSession antes de tocar la base. Ver §7.1 de bloque-1-spec.md
--    para el razonamiento completo.
--
-- Aditiva: 2 tablas nuevas, no toca tablas existentes, no migra datos.
-- Idempotente (IF NOT EXISTS + DROP TRIGGER IF EXISTS antes del CREATE).
-- Toda la migración va en una transacción.

BEGIN;

-- ============================================================================
-- TABLA 1: microcycles
-- Una fila por client_program. UNIQUE(client_program_id) impone
-- "un microciclo por programa de cliente".
-- ============================================================================

CREATE TABLE IF NOT EXISTS microcycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants (host) ON DELETE CASCADE,
    client_program_id UUID NOT NULL REFERENCES client_programs (id) ON DELETE CASCADE,
    duration_days INTEGER NOT NULL DEFAULT 7 CHECK (duration_days BETWEEN 1 AND 28),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT microcycles_unique_per_client_program UNIQUE (client_program_id)
);

CREATE INDEX IF NOT EXISTS microcycles_client_program_idx
    ON microcycles (client_program_id);

CREATE INDEX IF NOT EXISTS microcycles_tenant_host_idx
    ON microcycles (tenant_host);

COMMENT ON TABLE microcycles IS
    'Secuencia ordenada de N días que estructura el plan de un cliente sobre un client_program. Se repite igual cada vuelta hasta que el entrenador la modifique.';
COMMENT ON COLUMN microcycles.duration_days IS
    'Cantidad de días del microciclo. Default 7. Rango 1–28 como guardrail; nadie debería querer microciclos de meses.';
COMMENT ON COLUMN microcycles.client_program_id IS
    'FK a client_programs. UNIQUE: un microciclo por programa de cliente. Si más adelante se quieren microciclos progresivos (semana 1 ≠ semana 2), se quita este constraint y se añade cycle_index/effective_from.';

-- ============================================================================
-- TABLA 2: microcycle_slots
-- Cada slot representa un día del microciclo. session_id NULL = descanso
-- explícito. Días sin slot son descanso implícito (lo expande el endpoint
-- GET /api/client/microcycle, no la BD).
-- ============================================================================

CREATE TABLE IF NOT EXISTS microcycle_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microcycle_id UUID NOT NULL REFERENCES microcycles (id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL CHECK (day_index >= 1),
    session_id UUID REFERENCES sessions (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT microcycle_slots_unique_day_per_microcycle UNIQUE (microcycle_id, day_index)
);

CREATE INDEX IF NOT EXISTS microcycle_slots_microcycle_idx
    ON microcycle_slots (microcycle_id);

COMMENT ON TABLE microcycle_slots IS
    'Slots ordenados (day_index 1..N) que apuntan a una session, o representan un día de descanso explícito si session_id es NULL.';
COMMENT ON COLUMN microcycle_slots.session_id IS
    'NULL = día de descanso explícito. Días sin slot también son descanso (descanso automático, ver decisión c en §1 de bloque-1-spec.md). ON DELETE SET NULL: si la session referenciada se borra, el slot pasa a descanso en lugar de eliminarse.';
COMMENT ON COLUMN microcycle_slots.day_index IS
    'Posición 1-based dentro del microciclo. UNIQUE(microcycle_id, day_index) impide duplicados. La validación day_index <= duration_days vive en la capa API (no en SQL para no acoplar las dos tablas con un trigger).';

-- ============================================================================
-- TRIGGERS: updated_at
-- Reusa la función update_updated_at_column() ya definida en migración 001.
-- microcycle_slots no necesita updated_at: las ediciones se hacen por
-- DELETE + INSERT desde la capa API (ver §4.2 de bloque-1-spec.md).
-- ============================================================================

DROP TRIGGER IF EXISTS update_microcycles_updated_at ON microcycles;
CREATE TRIGGER update_microcycles_updated_at
    BEFORE UPDATE ON microcycles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS
-- Patrón permisivo + autorización en capa de app (alineado con migraciones
-- 017, 074, 076, 083). La superficie de acceso a estas tablas es exclusiva
-- de las rutas /api/trainer/clients/:id/microcycle y /api/client/microcycle,
-- todas con verificación de getTrainerSession() / getClientSession() +
-- ownership antes de cualquier query.
-- ============================================================================

ALTER TABLE microcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE microcycle_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS microcycles_app_layer ON microcycles;
CREATE POLICY microcycles_app_layer ON microcycles
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS microcycle_slots_app_layer ON microcycle_slots;
CREATE POLICY microcycle_slots_app_layer ON microcycle_slots
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY microcycles_app_layer ON microcycles IS
    'Permissive RLS — authorization enforced in /api/trainer/clients/:id/microcycle and /api/client/microcycle routes. See migration 083 for the same pattern.';
COMMENT ON POLICY microcycle_slots_app_layer ON microcycle_slots IS
    'Permissive RLS — authorization enforced in API routes via parent microcycle ownership check.';

COMMIT;
