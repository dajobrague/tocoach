# Microciclo: multi-session per day + start_date propagation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `scheduled_sessions` per `(client, date, session_id)` instead of per `(client, date)` so clients can train multiple sessions on the same day without log corruption; derive the daily prescription live from the microcycle + trainer per-date pins so changing a microcycle's `start_date` propagates forward.

**Architecture:** Two SQL migrations rewire the data layer: 113 dedupes existing rows + widens the uniqueness key + updates `upsert_scheduled_session`; 114 rewrites `replace_scheduled_session_overrides` for per-session keying with stale-pin reconciliation. Three API endpoints (`/api/client/scheduled-sessions/[date]`, `/api/clients/[clientId]/scheduled-sessions/trainer`, `/api/clients/[clientId]/microcycle`) and two frontend hooks/components (`use-week-metrics`, `microcycle-config`) get updated to support multiple sessions per date and to handle the `start_date` cascade. The cascade is scoped by `microcycleId` so multi-program clients don't lose unrelated pins. No automated test framework exists in this repo; verification is via SQL queries against the live database and manual UI flows in the dev server.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Supabase (Postgres + RLS), React Query, HeroUI v2 + Tailwind v4. Spec: `docs/superpowers/specs/2026-05-23-microcycle-multi-session-and-start-date-design.md`.

**Verification convention:** Every task ends with concrete SQL or curl/browser steps you can run yourself plus the expected result. If your output diverges, fix before moving on. Commits are bite-sized but landable independently — each one leaves the app in a working state.

**Edge cases stress-tested before writing this plan:**

1. Client opens session A, logs, finalizes (single-session day) → behaves the same as today.
2. Client opens A then B on same day, logs from both → after Task 1, two rows, two correct status calculations.
3. Trainer pins X, client trains X → row already exists as 'trainer', client's upsert preserves `prescribed_by='trainer'`. Status completes when client finishes X.
4. Trainer pins X, client trains Y (different) → trainer pin row stays, new client row created for Y. Both adherence-scored independently.
5. Trainer pins X, then changes pin to Y (no client activity yet) → Task 1b's RPC deletes the stale X pin and inserts/updates Y.
6. Trainer pins X, client trains X (logs attached), trainer changes pin to Y → Task 1b demotes X row to `prescribed_by='client'` (preserving logs), inserts Y as the new trainer pin.
7. Trainer changes `start_date` only → Task 6 clears future trainer pins scoped to this microcycle's session set. Past untouched, client activity untouched.
8. Trainer changes `start_date` AND swaps slots in same save → scoping is by union of old+new slot session_ids, so pins for removed sessions also get cleared.
9. Trainer changes one microcycle's `start_date` while client has a second active program with its own microcycle → scoping is per-microcycle's session set, so the other program's pins are untouched.
10. Production data already has 13 duplicate `(client, date, session_id)` groups (~16 excess rows) — Task 1's preflight dedupe handles them before adding the constraint.
11. `replace_scheduled_session_overrides` callers (`scheduled-sessions/trainer/day/route.ts:442`) and `upsert_scheduled_session` callers (`exercise-logs/route.ts:222`, `scheduled-sessions/route.ts:136`) all pass `p_session_id` non-null today, so the new NOT NULL + required-arg checks won't surprise any path.
12. Cron sidecar (`cron-service/`) has zero references to `scheduled_sessions` — no migration risk there.

---

## Task 1: Migration 113 — widen `scheduled_sessions` uniqueness + update `upsert_scheduled_session` RPC

**Files:**

- Create: `supabase/migrations/113_scheduled_sessions_per_session_uniqueness.sql`

**Context:** Today one `scheduled_sessions` row per `(client_id, scheduled_date)` is enforced by the `upsert_scheduled_session` RPC's SELECT (`migrations/111_drop_old_upsert_scheduled_session_overload.sql:56-60`). Migration 106 added a hard UNIQUE constraint with the same shape but production no longer has it in `pg_constraint` (only the PK on `id` remains) — likely it was dropped or never applied. The new shape is `(client_id, scheduled_date, session_id)`.

**Pre-flight: production has duplicates already.** A `GROUP BY (client_id, scheduled_date, session_id) HAVING COUNT(*) > 1` returns 13 groups, ~16 excess rows. Migration 113 must dedupe them inside the same transaction before `ADD CONSTRAINT`, otherwise the `ADD CONSTRAINT` fails. Strategy per group: keep the row with the most attached `exercise_logs` (tiebreak by oldest `created_at`), repoint that group's logs to the survivor, drop the losers' per-exercise overrides, delete the loser rows.

- [ ] **Step 0: Snapshot the current duplicate count for verification**

```sql
SELECT
  COUNT(*) AS dup_groups,
  COALESCE(SUM(n), 0) - COUNT(*) AS excess_rows_to_dedupe
FROM (
  SELECT client_id, scheduled_date, session_id, COUNT(*) AS n
  FROM scheduled_sessions
  WHERE session_id IS NOT NULL
  GROUP BY client_id, scheduled_date, session_id
  HAVING COUNT(*) > 1
) t;
```

Expected at time of writing: `dup_groups=13, excess_rows_to_dedupe=16`. Note these numbers — Step 4's post-migration verification will assert they're 0.

- [ ] **Step 1: Create the migration file**

Write the file `supabase/migrations/113_scheduled_sessions_per_session_uniqueness.sql` with this exact content:

```sql
-- Widen scheduled_sessions uniqueness from (client, date) to (client, date,
-- session_id) and update upsert_scheduled_session accordingly.
--
-- Background (ver spec 2026-05-23 §Problem evidence):
--   Migration 106 introdujo UNIQUE (client_id, scheduled_date) para
--   colapsar duplicados de concurrencia. Esa decisión accidentalmente
--   forzó "una sesión por día por cliente" en el modelo. En la práctica
--   los clientes a veces tocan o entrenan varias sesiones el mismo día,
--   y todos sus logs quedaban pegados al primer scheduled_session creado
--   ese día — con session_id equivocado para los demás logs.
--
-- Esta migración:
--   1. Asegura session_id no nulo (todas las filas hoy ya lo tienen).
--   2. Reemplaza UNIQUE (client_id, scheduled_date) por
--      UNIQUE (client_id, scheduled_date, session_id).
--   3. Reescribe upsert_scheduled_session para que el lock advisory y el
--      SELECT incluyan session_id en su key, permitiendo múltiples filas
--      por (client, date), una por sesión tocada.
--
-- No backfill: las filas históricas polucionadas se quedan donde están.
-- A partir de esta migración, cada (client, date, session_id) tendrá su
-- propia fila — ver spec §7.
--
-- Aditiva en el sentido de "no destruye datos": solo cambia constraints
-- y la función RPC. Las filas existentes siguen siendo válidas bajo la
-- nueva UNIQUE (cada fila tiene un session_id único dentro de su par
-- (client, date) porque la UNIQUE vieja lo garantizaba).

BEGIN;

-- 0. Dedupe existing (client_id, scheduled_date, session_id) duplicates.
--    Producción tiene ~13 grupos con duplicados (revisar antes con
--    `GROUP BY ... HAVING COUNT(*) > 1`). Sin este paso, el ADD CONSTRAINT
--    de la sección 3 falla con "could not create unique index".
--
--    Estrategia: por cada grupo duplicado, elegir un "sobreviviente"
--    (más logs adjuntos; tiebreak por created_at más antiguo). Re-apuntar
--    sus exercise_logs al sobreviviente. Borrar los loser rows
--    (scheduled_session_exercises de los losers cascadean por FK).
WITH ranked AS (
  SELECT
    ss.id,
    ss.client_id,
    ss.scheduled_date,
    ss.session_id,
    ss.created_at,
    (SELECT COUNT(*) FROM exercise_logs el
       WHERE el.scheduled_session_id = ss.id) AS log_count,
    ROW_NUMBER() OVER (
      PARTITION BY ss.client_id, ss.scheduled_date, ss.session_id
      ORDER BY
        (SELECT COUNT(*) FROM exercise_logs el
           WHERE el.scheduled_session_id = ss.id) DESC,
        ss.created_at ASC,
        ss.id ASC
    ) AS rn
  FROM scheduled_sessions ss
  WHERE ss.session_id IS NOT NULL
),
survivors AS (
  SELECT client_id, scheduled_date, session_id, id AS survivor_id
  FROM ranked
  WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, s.survivor_id
  FROM ranked r
  JOIN survivors s
    ON s.client_id = r.client_id
   AND s.scheduled_date = r.scheduled_date
   AND s.session_id = r.session_id
  WHERE r.rn > 1
)
UPDATE exercise_logs el
SET scheduled_session_id = l.survivor_id
FROM losers l
WHERE el.scheduled_session_id = l.loser_id;

-- Preservar la "intención del trainer" del grupo: si CUALQUIER fila del
-- grupo era prescribed_by='trainer', el survivor también lo es. Evita
-- que un duplicado client+trainer (de los ~16 históricos) pierda la
-- atribución de prescripción al haber sido elegido el survivor por
-- log_count cuando el client row tenía logs y el trainer row no.
UPDATE scheduled_sessions ss
SET prescribed_by = 'trainer',
    updated_at = NOW()
FROM (
  SELECT
    client_id, scheduled_date, session_id, id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, scheduled_date, session_id
      ORDER BY
        (SELECT COUNT(*) FROM exercise_logs el
           WHERE el.scheduled_session_id = scheduled_sessions.id) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM scheduled_sessions
  WHERE session_id IS NOT NULL
) s
WHERE ss.id = s.id
  AND s.rn = 1
  AND ss.prescribed_by != 'trainer'
  AND EXISTS (
    SELECT 1 FROM scheduled_sessions other
    WHERE other.client_id = s.client_id
      AND other.scheduled_date = s.scheduled_date
      AND other.session_id = s.session_id
      AND other.id != s.id
      AND other.prescribed_by = 'trainer'
  );

-- Borrar las filas loser (sus overrides + exercise_sets cascadean por FK
-- a través de scheduled_session_exercises ON DELETE CASCADE).
DELETE FROM scheduled_sessions ss
WHERE ss.id IN (
  SELECT r.id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, scheduled_date, session_id
        ORDER BY
          (SELECT COUNT(*) FROM exercise_logs el
             WHERE el.scheduled_session_id = scheduled_sessions.id) DESC,
          created_at ASC,
          id ASC
      ) AS rn
    FROM scheduled_sessions
    WHERE session_id IS NOT NULL
  ) r
  WHERE r.rn > 1
);

-- 1. session_id NOT NULL — todas las filas en producción ya tienen valor;
--    el modelo nuevo exige que cada fila represente actividad contra una
--    sesión concreta.
ALTER TABLE scheduled_sessions
  ALTER COLUMN session_id SET NOT NULL;

-- 2. Drop la UNIQUE vieja (idempotente — si el constraint no existe el
--    DROP IF EXISTS no rompe).
ALTER TABLE scheduled_sessions
  DROP CONSTRAINT IF EXISTS scheduled_sessions_client_date_unique;

-- 3. Add la UNIQUE nueva. Si el paso 0 dejó algún duplicado por error,
--    falla loudly acá — preferible romper la migración que aceptar data
--    inconsistente.
ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_client_date_session_unique
  UNIQUE (client_id, scheduled_date, session_id);

-- 4. Reescribir upsert_scheduled_session: el advisory lock key y el
--    SELECT ahora incluyen session_id. Misma signature, mismo retorno —
--    los 2 callers (exercise-logs route + scheduled-sessions trainer
--    route) no necesitan cambios.
DROP FUNCTION IF EXISTS upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB
);

CREATE OR REPLACE FUNCTION upsert_scheduled_session(
  p_tenant_host TEXT,
  p_client_id BIGINT,
  p_trainer_id UUID,
  p_session_id UUID,
  p_scheduled_date DATE,
  p_caller_role TEXT,
  p_status TEXT DEFAULT 'scheduled',
  p_client_program_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_lock_key BIGINT;
BEGIN
  IF p_caller_role NOT IN ('trainer', 'client') THEN
    RAISE EXCEPTION 'p_caller_role inválido: %', p_caller_role
      USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'p_session_id no puede ser NULL'
      USING ERRCODE = '22023';
  END IF;

  -- Lock por (client, date, session). Antes era por (client, date) y
  -- serializaba todos los inserts del día sin importar la sesión, lo
  -- que tenía dos efectos: serializaba sin necesidad, y devolvía la
  -- fila del primer caller para los demás (de ahí la corrupción).
  v_lock_key := hashtextextended(
    p_client_id::text || ':' || p_scheduled_date::text || ':' || p_session_id::text, 0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_id
  FROM scheduled_sessions
  WHERE client_id = p_client_id
    AND scheduled_date = p_scheduled_date
    AND session_id = p_session_id
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    -- Existe ya. No tocamos status ni prescribed_by para no pisar un
    -- override del trainer si lo había.
    RETURN v_id;
  END IF;

  INSERT INTO scheduled_sessions(
    tenant_host, client_id, trainer_id, session_id,
    scheduled_date, status, client_program_id, metadata,
    prescribed_by
  )
  VALUES (
    p_tenant_host, p_client_id, p_trainer_id, p_session_id,
    p_scheduled_date,
    COALESCE(p_status, 'scheduled'),
    p_client_program_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_caller_role
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_scheduled_session(
  TEXT, BIGINT, UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB
) TO anon, authenticated;

COMMIT;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with project `ydqhndnvrkvycnkaghro` and the contents of `113_scheduled_sessions_per_session_uniqueness.sql` (name the migration `113_scheduled_sessions_per_session_uniqueness`). Or via psql equivalent if the user prefers.

Expected: success message, no errors.

- [ ] **Step 2b: Verify dedupe was clean**

```sql
SELECT
  COUNT(*) AS dup_groups,
  COALESCE(SUM(n), 0) - COUNT(*) AS excess_rows_to_dedupe
FROM (
  SELECT client_id, scheduled_date, session_id, COUNT(*) AS n
  FROM scheduled_sessions
  WHERE session_id IS NOT NULL
  GROUP BY client_id, scheduled_date, session_id
  HAVING COUNT(*) > 1
) t;
```

Expected: `dup_groups=0, excess_rows_to_dedupe=0`. If non-zero, the migration didn't run the dedupe block — open it and reapply.

```sql
-- Also verify no logs were orphaned by the dedupe (every log still has a valid scheduled_session_id):
SELECT COUNT(*) AS orphan_logs
FROM exercise_logs el
LEFT JOIN scheduled_sessions ss ON ss.id = el.scheduled_session_id
WHERE el.scheduled_session_id IS NOT NULL AND ss.id IS NULL;
```

Expected: `orphan_logs=0`.

- [ ] **Step 3: Verify the constraint and the function exist**

Run via Supabase MCP `execute_sql`:

```sql
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN (
  'scheduled_sessions_client_date_unique',
  'scheduled_sessions_client_date_session_unique'
);
```

Expected: one row, `scheduled_sessions_client_date_session_unique`, def `UNIQUE (client_id, scheduled_date, session_id)`.

```sql
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'upsert_scheduled_session';
```

Expected: one row only (the new 9-arg signature). If two rows appear, an old overload still exists — re-run the DROP FUNCTION step.

- [ ] **Step 4: Smoke test the RPC — two distinct sessions same date should produce two rows**

```sql
-- Pedro is client 179, trainer f35d7800-6181-4bd3-8b5c-2c9cc364220a.
-- Pick a future date that doesn't already have rows: 2026-06-15.
-- Use two distinct session_ids from his microcycle slots (Torso Fuerza
-- and Bíceps y Pierna Fuerza):

SELECT upsert_scheduled_session(
  'ydqhndnvrkvycnkaghro.supabase.co'::text,
  179::bigint,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a'::uuid,
  'e7c1ac45-6443-4132-987b-ca8754c99f21'::uuid,  -- Torso Fuerza
  '2026-06-15'::date,
  'client'::text
);

SELECT upsert_scheduled_session(
  'ydqhndnvrkvycnkaghro.supabase.co'::text,
  179::bigint,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a'::uuid,
  '2518e241-e97b-49bf-960b-8c8880676a0c'::uuid,  -- Bíceps y Pierna F
  '2026-06-15'::date,
  'client'::text
);

SELECT id, session_id, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-06-15';
```

Expected: two distinct rows, one per session_id, both `prescribed_by='client'`.

- [ ] **Step 5: Clean up the smoke-test rows**

```sql
DELETE FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-06-15';
```

Expected: 2 rows deleted.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/113_scheduled_sessions_per_session_uniqueness.sql
git commit -m "feat(microcycle): widen scheduled_sessions uniqueness to (client, date, session_id)

Drops UNIQUE (client_id, scheduled_date) and replaces it with
UNIQUE (client_id, scheduled_date, session_id). Updates the
upsert_scheduled_session RPC to lock and SELECT on the triple, so two
sessions touched the same day no longer collapse into one row.

See docs/superpowers/specs/2026-05-23-microcycle-multi-session-and-start-date-design.md.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 1b: Migration 114 — rewrite `replace_scheduled_session_overrides` for per-session keying

**Files:**

- Create: `supabase/migrations/114_replace_overrides_per_session_keying.sql`

**Context:** The current override RPC (migration 110) locks on `(client_id, scheduled_date)`, SELECTs the row by `(client_id, scheduled_date)` (single-row assumption), and `UPDATE`s `session_id` on the existing row to the trainer's new choice. Under the new per-(client, date, session_id) model this breaks two ways:

1. **UNIQUE violation:** if the trainer changes their pin from session X → Y and a client-created row for Y already exists, the UPDATE `SET session_id = Y` collides with the existing Y row.
2. **Stale pin retention:** if the trainer pinned X yesterday and pins Y today, the X row stays around (with `prescribed_by='trainer'`) and the resolver now sees two trainer pins — undefined behavior.

The new RPC must:

- Lock on `(client_id, scheduled_date)` (still coarse — trainer override is an infrequent operation, no need for fine-grained).
- Upsert the row for `(client_id, scheduled_date, p_session_id)` — flip `prescribed_by='trainer'` if it was 'client' (the spec's "trainer ratifies what the client trained" case).
- Replace `scheduled_session_exercises` rows on the target row.
- Reconcile **stale trainer pins** for the same `(client, date)` on _different_ session_ids:

  - If the stale pin has no `exercise_logs` → DELETE it.
  - If the stale pin has logs → demote it to `prescribed_by='client'` (preserve activity, just no longer the prescription anchor).

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/114_replace_overrides_per_session_keying.sql` with this exact content:

```sql
-- Update replace_scheduled_session_overrides to key per (client, date, session_id).
--
-- Antes: SELECT por (client, date), UPDATE session_id en la fila
-- encontrada. Bajo el modelo nuevo (migration 113) puede haber N filas
-- por (client, date) — una por sesión tocada. Esa lógica:
--   1. Choca con la UNIQUE nueva si el trainer cambia su pin a una
--      sesión donde ya existe una fila prescribed_by='client'.
--   2. Deja stale trainer pins en sesiones distintas a la elegida,
--      creando "doble prescripción" para una misma fecha.
--
-- Comportamiento nuevo:
--   - Upsert la fila (client, date, p_session_id) con prescribed_by='trainer'.
--     Si la fila existía como 'client' (cliente entrenó esa sesión sin
--     prescripción previa), se flippea — el trainer ratifica.
--   - Reemplaza per-exercise overrides en la fila target.
--   - Reconcilia stale trainer pins en OTRAS session_ids del mismo
--     (client, date): si no tienen exercise_logs, DELETE; si tienen
--     logs, demote a 'client' (preserva actividad, deja de ser anchor
--     de prescripción). Los overrides per-exercise en esas filas se
--     dejan como snapshot histórico.

DROP FUNCTION IF EXISTS replace_scheduled_session_overrides(
    TEXT, BIGINT, UUID, DATE, UUID, JSONB, JSONB
);

CREATE OR REPLACE FUNCTION replace_scheduled_session_overrides(
    p_tenant_host TEXT,
    p_client_id BIGINT,
    p_trainer_id UUID,
    p_scheduled_date DATE,
    p_session_id UUID,
    p_exercises JSONB,
    p_sets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_scheduled_session_id UUID;
    v_lock_key BIGINT;
    v_ex_orders INT[];
    v_set_orders INT[];
    v_missing INT[];
BEGIN
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'p_session_id no puede ser NULL'
            USING ERRCODE = '22023';
    END IF;

    -- Validación cruzada exerciseOrder p_sets vs p_exercises (igual que 110).
    IF jsonb_array_length(p_sets) > 0 THEN
        SELECT array_agg(DISTINCT (e->>'exerciseOrder')::INT)
        INTO v_ex_orders
        FROM jsonb_array_elements(p_exercises) AS e;

        SELECT array_agg(DISTINCT (s->>'exerciseOrder')::INT)
        INTO v_set_orders
        FROM jsonb_array_elements(p_sets) AS s;

        SELECT array_agg(o) INTO v_missing
        FROM unnest(COALESCE(v_set_orders, ARRAY[]::INT[])) AS o
        WHERE NOT (o = ANY(COALESCE(v_ex_orders, ARRAY[]::INT[])));

        IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
            RAISE EXCEPTION
                'replace_scheduled_session_overrides: p_sets refers to exerciseOrder(s) % not present in p_exercises',
                v_missing
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Lock coarse-grained sobre (client, date) — el RPC toca múltiples
    -- filas potenciales (target + stale pins), conviene serializar todo
    -- el RPC para esa fecha.
    v_lock_key := hashtextextended(
        p_client_id::text || ':' || p_scheduled_date::text, 0
    );
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 1. Upsert la fila target (client, date, p_session_id).
    SELECT id INTO v_scheduled_session_id
    FROM scheduled_sessions
    WHERE client_id = p_client_id
      AND scheduled_date = p_scheduled_date
      AND session_id = p_session_id
    FOR UPDATE;

    IF v_scheduled_session_id IS NULL THEN
        INSERT INTO scheduled_sessions(
            tenant_host, client_id, trainer_id, session_id,
            scheduled_date, status, prescribed_by
        )
        VALUES (
            p_tenant_host, p_client_id, p_trainer_id, p_session_id,
            p_scheduled_date, 'scheduled', 'trainer'
        )
        RETURNING id INTO v_scheduled_session_id;
    ELSE
        UPDATE scheduled_sessions
        SET status = 'scheduled',
            prescribed_by = 'trainer',
            updated_at = NOW()
        WHERE id = v_scheduled_session_id;
    END IF;

    -- 2. Reconciliar stale trainer pins en OTRAS session_ids para esta
    --    (client, date). Si no tienen logs: DELETE; si tienen logs:
    --    demote a 'client'.
    WITH stale AS (
        SELECT ss.id,
               EXISTS(
                 SELECT 1 FROM exercise_logs el
                 WHERE el.scheduled_session_id = ss.id
               ) AS has_logs
        FROM scheduled_sessions ss
        WHERE ss.client_id = p_client_id
          AND ss.scheduled_date = p_scheduled_date
          AND ss.prescribed_by = 'trainer'
          AND ss.id != v_scheduled_session_id
    ),
    demoted AS (
        UPDATE scheduled_sessions ss
        SET prescribed_by = 'client',
            updated_at = NOW()
        FROM stale
        WHERE ss.id = stale.id AND stale.has_logs = true
        RETURNING ss.id
    )
    DELETE FROM scheduled_sessions ss
    USING stale
    WHERE ss.id = stale.id AND stale.has_logs = false;

    -- 3. Replace overrides en la fila target (DELETE + INSERT — idéntico
    --    al patrón de 110).
    DELETE FROM scheduled_session_exercises
    WHERE scheduled_session_id = v_scheduled_session_id;

    IF jsonb_array_length(p_exercises) > 0 THEN
        INSERT INTO scheduled_session_exercises(
            tenant_host, scheduled_session_id, exercise_id, exercise_order,
            sets, reps, weight_kg,
            duration_seconds, distance_meters, rest_seconds, notes
        )
        SELECT
            p_tenant_host,
            v_scheduled_session_id,
            (e->>'exerciseId')::UUID,
            (e->>'exerciseOrder')::INT,
            NULLIF(e->>'sets', '')::INT,
            NULLIF(e->>'reps', ''),
            NULLIF(e->>'weightKg', '')::DECIMAL,
            NULLIF(e->>'durationSeconds', '')::INT,
            NULLIF(e->>'distanceMeters', '')::DECIMAL,
            NULLIF(e->>'restSeconds', '')::INT,
            NULLIF(e->>'notes', '')
        FROM jsonb_array_elements(p_exercises) AS e;
    END IF;

    IF jsonb_array_length(p_sets) > 0 THEN
        INSERT INTO scheduled_session_exercise_sets(
            tenant_host, scheduled_session_exercise_id,
            set_number, reps, weight_kg
        )
        SELECT
            p_tenant_host,
            sse.id,
            (s->>'setNumber')::INT,
            NULLIF(s->>'reps', ''),
            NULLIF(s->>'weightKg', '')::DECIMAL
        FROM jsonb_array_elements(p_sets) AS s
        JOIN scheduled_session_exercises sse
            ON sse.scheduled_session_id = v_scheduled_session_id
           AND sse.exercise_order = (s->>'exerciseOrder')::INT;
    END IF;

    RETURN v_scheduled_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_scheduled_session_overrides(
    TEXT, BIGINT, UUID, DATE, UUID, JSONB, JSONB
) TO anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Same procedure as Task 1 — apply via Supabase MCP `apply_migration` with project `ydqhndnvrkvycnkaghro`.

Expected: success.

- [ ] **Step 3: Verify the new RPC handles stale pins**

```sql
-- Setup: simulate "trainer pinned X yesterday, client trained Y today"
-- for a fresh future date (use 2026-07-15 and Pedro client 179).
INSERT INTO scheduled_sessions(
  tenant_host, client_id, trainer_id, session_id, scheduled_date, status, prescribed_by
) VALUES (
  'ydqhndnvrkvycnkaghro.supabase.co', 179,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a',
  'e7c1ac45-6443-4132-987b-ca8754c99f21',  -- Torso Fuerza (stale pin, no logs)
  '2026-07-15', 'scheduled', 'trainer'
);

-- Now call the override RPC pinning a DIFFERENT session for the same
-- date — Bíceps y Pierna Fuerza:
SELECT replace_scheduled_session_overrides(
  'ydqhndnvrkvycnkaghro.supabase.co'::text,
  179::bigint,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a'::uuid,
  '2026-07-15'::date,
  '2518e241-e97b-49bf-960b-8c8880676a0c'::uuid,
  '[]'::jsonb,
  '[]'::jsonb
);

SELECT id, session_id, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-07-15';
```

Expected: ONE row only, `session_id='2518e241...'`, `prescribed_by='trainer'`. The stale Torso Fuerza pin was deleted because it had no logs.

- [ ] **Step 4: Verify stale pins WITH logs get demoted not deleted**

```sql
-- Setup: pin X with a log attached, then trainer pins Y.
INSERT INTO scheduled_sessions(
  tenant_host, client_id, trainer_id, session_id, scheduled_date, status, prescribed_by
) VALUES (
  'ydqhndnvrkvycnkaghro.supabase.co', 179,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a',
  '93a349f4-b60f-4e63-a26a-86ec456f7796',  -- Torso Hipertrofia (stale pin with log)
  '2026-07-16', 'scheduled', 'trainer'
) RETURNING id;
-- Use the returned id below as :pin_id. Attach a synthetic log:
-- (replace :pin_id with the actual UUID from the RETURNING above)

-- For simplicity, use Pedro's existing exercise + log_set pattern; we
-- can borrow any exercise_id from his template:
INSERT INTO exercise_logs(
  tenant_host, scheduled_session_id, exercise_id, client_id, trainer_id, completed_at
) VALUES (
  'ydqhndnvrkvycnkaghro.supabase.co',
  (SELECT id FROM scheduled_sessions WHERE client_id=179 AND scheduled_date='2026-07-16'),
  'fd8a3cfe-b9b1-449c-b157-94e158c45456',  -- Hip thrust unilateral
  179,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a',
  NOW()
);

-- Now trainer pins a DIFFERENT session for 2026-07-16:
SELECT replace_scheduled_session_overrides(
  'ydqhndnvrkvycnkaghro.supabase.co'::text,
  179::bigint,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a'::uuid,
  '2026-07-16'::date,
  'e7c1ac45-6443-4132-987b-ca8754c99f21'::uuid,
  '[]'::jsonb,
  '[]'::jsonb
);

SELECT session_id, prescribed_by,
  (SELECT COUNT(*) FROM exercise_logs WHERE scheduled_session_id = ss.id) AS logs
FROM scheduled_sessions ss
WHERE client_id = 179 AND scheduled_date = '2026-07-16'
ORDER BY prescribed_by;
```

Expected: TWO rows.

- `(session_id=93a349f4..., prescribed_by='client', logs=1)` — the old pin demoted because it had a log.
- `(session_id=e7c1ac45..., prescribed_by='trainer', logs=0)` — the new pin.

- [ ] **Step 5: Clean up the smoke-test data**

```sql
DELETE FROM exercise_logs WHERE scheduled_session_id IN (
  SELECT id FROM scheduled_sessions
  WHERE client_id = 179 AND scheduled_date IN ('2026-07-15','2026-07-16')
);
DELETE FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date IN ('2026-07-15','2026-07-16');
```

Expected: all smoke-test rows gone.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/114_replace_overrides_per_session_keying.sql
git commit -m "feat(microcycle): rewrite replace_scheduled_session_overrides for per-session keying

Locks coarse on (client, date) but operates per session_id. When the
trainer pins a new session for a date that already had a different
trainer pin, the stale pin is deleted if it has no logs, or demoted to
prescribed_by='client' (preserving client activity) if it does. Avoids
UNIQUE violations under the new (client, date, session_id) constraint
and eliminates lingering double-prescription rows.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 2: Client resolver — derive prescription live from microcycle + trainer pin

**Files:**

- Modify: `app/api/client/scheduled-sessions/[date]/route.ts`

**Context:** Today this route does `.maybeSingle()` on `(client_id, scheduled_date)`, then uses `ssRow.session_id` for the visible day. After Task 1 there can be N rows per (client, date) — one per session touched. The resolver must (a) pick the prescription anchor (a `prescribed_by='trainer'` row's session_id, or fall through to the microcycle slot), (b) read state/exercises from the matching row when present, (c) ignore `prescribed_by='client'` rows for prescription decisions.

- [ ] **Step 1: Replace the single-row fetch with a per-date listing + prescription decision**

In `app/api/client/scheduled-sessions/[date]/route.ts`, replace the block starting at line 132 (`const { data: ssRow } = await supabase ... .maybeSingle();`) through line 197 (end of the "Compute trainer's recommendation" block) with the following:

```typescript
// 1. All real scheduled_sessions rows for this date. After
//    migration 113 there can be multiple — one per session the
//    client (or trainer-override) touched. We need:
//    - which one is the prescription anchor (trainer-pinned row if
//      any, else the microcycle slot),
//    - the row's own status/source/exercise overrides if that
//      session has a matching row.
const { data: ssRowsRaw } = await supabase
  .from("scheduled_sessions")
  .select(
    `id, prescribed_by, session_id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes, metadata,
             exercise:exercises(id, name, category, image_url, video_url)
           )
         ),
         override_exercises:scheduled_session_exercises(
           id, exercise_order, sets, reps, weight_kg,
           duration_seconds, distance_meters, rest_seconds, notes,
           exercise:exercises(id, name, category, image_url, video_url),
           prescribed_sets:scheduled_session_exercise_sets(
             id, set_number, reps, weight_kg, notes
           )
         )`
  )
  .eq("client_id", clientId)
  .eq("scheduled_date", date);

const ssRows = (ssRowsRaw ?? []) as any[];
// El "pin del trainer" para esta fecha es la fila con
// prescribed_by='trainer'. La UI ya gates "un override por fecha".
const trainerPin = ssRows.find((r) => r.prescribed_by === "trainer") ?? null;

// Cache las queries de programas/microciclo: el cómputo de
// trainer_recommended_session_id puede necesitarlo, y el fallback
// template también. Cargamos a demanda para no pagar el costo si la
// ssRow ya satisface ambos lados.
let programsCache: Awaited<
  ReturnType<typeof loadAllActiveOwnedPrograms>
> | null = null;
const loadPrograms = async () => {
  if (programsCache === null) {
    programsCache = await loadAllActiveOwnedPrograms(
      supabase,
      clientId,
      null,
      correlationId
    );
  }

  return programsCache;
};

// ── Compute trainer's recommendation for this date ────────────────
// Trainer pin > microcycle slot. Filas creadas por el cliente
// NUNCA participan en esta decisión (son actividad, no prescripción).
let trainerRecommendedSessionId: string | null = null;

if (trainerPin && typeof trainerPin.session_id === "string") {
  trainerRecommendedSessionId = trainerPin.session_id;
} else {
  const programs = await loadPrograms();
  const slotMatch = await resolveMicrocycleSlot(
    supabase,
    programs,
    date,
    correlationId
  );

  trainerRecommendedSessionId = slotMatch?.sessionId ?? null;
}
```

- [ ] **Step 2: Adjust the "compute current state" block to read from the prescription anchor**

Immediately below the block you just inserted, replace lines 200-240 (the old `if (ssRow) { ... }` block that checked overrides and session-with-exercises) with:

```typescript
// ── Compute current state for the PRESCRIBED session ──────────────
// Antes leíamos cualquier fila que existiera; ahora distinguimos:
//   - Si hay pin del trainer: la prescripción se construye desde
//     ese row (sus override_exercises ganan; si no hay overrides,
//     usamos los session_exercises del session referenciado).
//   - Si no hay pin pero el microciclo apunta a una sesión para
//     este día: cargamos esa sesión y la mostramos como prescripción.
if (trainerPin) {
  const overrides = (trainerPin.override_exercises ?? []) as any[];

  if (overrides.length > 0) {
    const day = makeResolvedDay(
      date,
      "override",
      trainerPin.session as any,
      overrides,
      trainerRecommendedSessionId
    );

    return NextResponse.json({
      success: true,
      day: await enrichWithLastUsedWeights(supabase, clientId, day),
    });
  }

  const sessionRow = trainerPin.session as any;
  const sessExercises = (sessionRow?.session_exercises ?? []) as any[];

  if (sessionRow && sessExercises.length > 0) {
    const day = makeResolvedDay(
      date,
      "session",
      sessionRow,
      sessExercises,
      trainerRecommendedSessionId
    );

    return NextResponse.json({
      success: true,
      day: await enrichWithLastUsedWeights(supabase, clientId, day),
    });
  }
}
```

- [ ] **Step 3: Verify the file still type-checks**

Run from repo root:

```bash
npm run type-check
```

Expected: exits 0, no new TS errors in `app/api/client/scheduled-sessions/[date]/route.ts`. If there are errors elsewhere from your editor's auto-imports or the like, fix them.

- [ ] **Step 4: Manual verification — client resolver returns prescription for Pedro's REST day**

Start the dev server (`npm run dev`) and hit:

```bash
curl -s "http://localhost:3000/api/client/scheduled-sessions/2026-05-25" \
  -H "Cookie: client-session=<get-from-browser>" | jq '.day | {date, source, session, trainer_recommended_session_id}'
```

(Get a valid client-session cookie for Pedro by logging in as him in a private browser window; on his microcycle 5-25 = D15 = REST, so we expect no session, but the trainer_recommended_session_id should be null since the slot is null.)

Expected for 2026-05-25 (REST in template, no rows in DB): `{date: "2026-05-25", source: "rest", session: null, trainer_recommended_session_id: null}`.

For 2026-05-26 (D16 = Torso Fuerza, trainer has a pin with overrides): `{date: "2026-05-26", source: "override", session: {id: "e7c1ac45...", name: "Torso Fuerza"}, trainer_recommended_session_id: "e7c1ac45..."}`.

For 2026-05-14 (REST template, Pedro has a `prescribed_by='client'` polluted row): `{date: "2026-05-14", source: "rest", session: null, trainer_recommended_session_id: null}` — the client row is correctly ignored as a prescription source even though it exists.

- [ ] **Step 5: Commit**

```bash
git add app/api/client/scheduled-sessions/[date]/route.ts
git commit -m "fix(microcycle): derive day prescription live, ignore client-created rows

After widening scheduled_sessions to per-(client, date, session_id),
the day resolver must pick the prescription anchor from either a
trainer-pinned row or the microcycle slot — never from a client-created
activity row. Filas prescribed_by='client' ya no influyen en lo que se
muestra como recomendado/prescripción del día.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 3: Trainer endpoint — return multiple rows per date

**Files:**

- Modify: `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`

**Context:** Today this endpoint keys `realByDate` on `scheduled_date` (line 206-217) and merges one real row per date with one template row. With multiple rows per date possible, the response shape changes from `scheduledSessions: Array<{ date, ... }>` (one entry per date) to `scheduledSessions: Array<{ date, session_id, ... }>` (one entry per (date, session_id)). The week-metrics hook will be updated in Task 4 to consume the new shape.

- [ ] **Step 1: Re-key the real-rows map and merge over the triple**

In `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`, replace the block from line 206 (`const realByDate = new Map...`) through line 294 (the `merged.sort` call before the `NextResponse.json` at line 296) with:

```typescript
// Key real rows on (date, session_id). Multiple rows per date are
// now first-class — one per session the client/trainer touched.
const realByKey = new Map<string, ScheduledSessionResponse>();
const realRowsTyped = (realRows ?? []) as unknown as ScheduledSessionResponse[];

for (const row of realRowsTyped) {
  row.originally_prescribed_session = null;
  const key = `${row.scheduled_date}|${row.session?.id ?? ""}`;

  realByKey.set(key, row);
}

// 2. Materialize from the microcycle template — unchanged from
//    before, indexed by date (one template row per date).
let templateByDate = new Map<string, ScheduledSessionResponse>();

if (startDate && endDate) {
  templateByDate = await materializeTemplate(
    supabase,
    clientId,
    session.trainer_id,
    startDate,
    endDate,
    correlationId
  );
}

// 3. Merge. Política por fecha:
//    - Cada fila real (real, real, ...) se incluye tal cual; las
//      prescribed_by='client' aparecen como actividad off-plan
//      cuando su session_id diverge del template, o como sesión
//      recomendada cuando coincide.
//    - Si para la fecha existe slot de template y NO hay ninguna
//      fila real con ese mismo session_id, agregamos la fila virtual
//      del template (la prescripción pendiente).
//    - Cuando hay divergencia entre fila real (cliente) y template,
//      el real lleva `originally_prescribed_session` con la sesión
//      del template para que la UI muestre el chip "Recomendado: X".

const merged: ScheduledSessionResponse[] = [];
const allDates = new Set<string>();

for (const row of realRowsTyped) allDates.add(row.scheduled_date);
for (const date of templateByDate.keys()) allDates.add(date);

for (const date of allDates) {
  const template = templateByDate.get(date) ?? null;
  const realsForDate = realRowsTyped.filter((r) => r.scheduled_date === date);

  // Determinar la "sesión recomendada" para la fecha: el pin del
  // trainer (real con prescribed_by='trainer') si existe; si no, el
  // session_id del template.
  const trainerPin =
    realsForDate.find((r) => r.prescribed_by === "trainer") ?? null;
  const recommendedSessionId = trainerPin
    ? (trainerPin.session?.id ?? null)
    : (template?.session?.id ?? null);

  // Emitir cada fila real con anotación de divergencia.
  for (const row of realsForDate) {
    if (
      row.prescribed_by === "client" &&
      recommendedSessionId != null &&
      row.session?.id !== recommendedSessionId
    ) {
      // Cliente entrenó algo distinto a lo recomendado: anotar la
      // sesión recomendada como "originalmente prescrito" para que
      // la UI le ponga el chip.
      row.originally_prescribed_session =
        trainerPin?.session ?? template?.session ?? null;
    }
    merged.push(row);
  }

  // Si el template recomienda una sesión y ninguna fila real la
  // cubre, agregar la fila virtual del template (prescripción
  // pendiente, sin actividad).
  if (
    template &&
    recommendedSessionId != null &&
    !realsForDate.some((r) => r.session?.id === recommendedSessionId)
  ) {
    // Si hay trainerPin con un session_id distinto al template, no
    // emitimos el template — el pin ya manda. Esto solo dispara
    // cuando no hay pin y el template recomienda una sesión que el
    // cliente no ha tocado todavía.
    if (!trainerPin) merged.push(template);
  }
}

merged.sort((a, b) => {
  if (a.scheduled_date !== b.scheduled_date) {
    return a.scheduled_date.localeCompare(b.scheduled_date);
  }

  // Estable dentro del día: trainer pin/prescripción primero,
  // actividad del cliente después.
  const aRank = a.prescribed_by === "trainer" ? 0 : 1;
  const bRank = b.prescribed_by === "trainer" ? 0 : 1;

  return aRank - bRank;
});

return NextResponse.json({ success: true, scheduledSessions: merged });
```

(Remove the original `NextResponse.json({ success: true, scheduledSessions: merged });` line that lived at the bottom — the new block ends with it.)

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: exits 0.

- [ ] **Step 3: Manual verification — endpoint returns per-(date, session) entries**

With the dev server running, hit:

```bash
curl -s "http://localhost:3000/api/clients/179/scheduled-sessions/trainer?startDate=2026-05-11&endDate=2026-05-23" \
  -H "Cookie: trainer-session=<get-from-browser-as-Carlos-Torres>" \
  | jq '.scheduledSessions | map({date: .scheduled_date, session: .session.name, prescribed_by, originally: .originally_prescribed_session.name})'
```

Expected behavior:

- For 5-13 (template Bíceps y Pierna F, real Bíceps y Pierna F, prescribed_by trainer): one entry, `originally: null`.
- For 5-15 (template Torso Hipertrofia, real prescribed_by='client' same session): one entry, `originally: null` (matches template, not divergent).
- For 5-12 (template Torso Fuerza, real Bíceps y Pierna F prescribed_by='client'): TWO entries — the client's "Bíceps y Pierna F" with `originally: "Torso Fuerza"`, AND a virtual template entry for "Torso Fuerza" (since no real row covers it).
- For 5-26+ (future trainer pins): one entry per pin, plus virtual template entries for dates without a pin.

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts
git commit -m "fix(microcycle): trainer endpoint returns one entry per (date, session)

Drops the dedupe-by-date logic. Each real scheduled_sessions row is
emitted with its own session/state. Template-derived virtual entries
fill gaps where the recommended session has no activity yet.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 4: Trainer week-metrics — index by (date, session_id), delete `toPrescribedFromLogs`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts`
- Modify: `components/dashboard/client-profile/tabs/microcycle/types.ts`

**Context:** Today `buildWeekMetrics` does `scheduledByDate.set(row.scheduled_date, row)` (line 145-147), collapsing the response to one row per date. After Task 3 each date can have N rows. `toPrescribedFromLogs` (lines 92-138) was the band-aid that rebuilt the prescription from raw logs when divergence was detected — it's no longer needed because each row's `session_exercises` is correct.

- [ ] **Step 1: Update `DayMetrics` type to carry an array of sessions**

In `components/dashboard/client-profile/tabs/microcycle/types.ts`, find the `DayMetrics` interface and replace its `scheduledSession`/`prescribed`/`adherence`/`classification` fields with a per-session entry list. Use Grep first to locate the type:

```bash
grep -n "interface DayMetrics" components/dashboard/client-profile/tabs/microcycle/types.ts
```

Open the file at that line and replace the existing `DayMetrics` interface with:

```typescript
export interface SessionEntry {
  scheduledSession: ScheduledSessionRow;
  prescribed: PrescribedExercise[];
  logs: ExerciseLog[];
  adherence: DayAdherence;
  classification: DayClassification;
}

export interface DayMetrics {
  date: string;
  /**
   * One entry per (date, session) the client or trainer touched. Empty
   * when the day is rest both in template and activity.
   */
  sessions: SessionEntry[];
  /**
   * Sesión que el trainer recomienda para el día (microciclo o pin
   * trainer). null = rest day. Se usa para anotar "Recomendado: X" en
   * el header del día cuando no aparece en `sessions`.
   */
  recommendedSessionName: string | null;
  isToday: boolean;
  isFuture: boolean;
}
```

If `DayAdherence` and `DayClassification` aren't already exported from this file, ensure they are (`grep -n "DayAdherence\|DayClassification"` and add `export` if missing).

- [ ] **Step 2: Rewrite `buildWeekMetrics` to materialize one `SessionEntry` per scheduled row**

In `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts`, replace `buildWeekMetrics` (lines 140-227) and delete `toPrescribedFromLogs` (lines 92-138) with:

```typescript
function buildWeekMetrics(
  weekStart: Date,
  scheduled: ScheduledSessionRow[],
  logs: ExerciseLog[]
): WeekMetrics {
  // Index scheduled rows por fecha (cada fecha tiene N filas, una por
  // sesión tocada o template virtual).
  const scheduledByDate = new Map<string, ScheduledSessionRow[]>();

  for (const row of scheduled) {
    const arr = scheduledByDate.get(row.scheduled_date) ?? [];

    arr.push(row);
    scheduledByDate.set(row.scheduled_date, arr);
  }

  const logsByDateSession = new Map<string, ExerciseLog[]>();

  for (const log of logs) {
    // Logs llegan con scheduled_date y session_id (vía
    // scheduled_sessions.session_id). Agrupamos por la composite key.
    const key = `${log.scheduled_date}|${log.session_id ?? ""}`;
    const arr = logsByDateSession.get(key) ?? [];

    arr.push(log);
    logsByDateSession.set(key, arr);
  }

  const todayYmd = getLocalYmd(new Date());
  const days: DayMetrics[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const ymd = getLocalYmd(date);
    const rows = scheduledByDate.get(ymd) ?? [];
    const isFuture = ymd > todayYmd;

    // recommendedSessionName: la fila de template (sin id real — los IDs
    // virtuales del template arrancan con "template:") o el pin trainer
    // si lo hay. Si no hay nada, null = rest.
    const trainerPinRow =
      rows.find((r) => r.prescribed_by === "trainer") ?? null;
    const templateVirtualRow =
      rows.find((r) => r.id.startsWith("template:")) ?? null;
    const recommendedSessionName =
      trainerPinRow?.session?.name ?? templateVirtualRow?.session?.name ?? null;

    const sessions: SessionEntry[] = rows.map((row) => {
      const sessionId = row.session?.id ?? "";
      const sessionLogs = logsByDateSession.get(`${ymd}|${sessionId}`) ?? [];
      const prescribed = toPrescribed(row);
      const adherence = computeDayAdherence(prescribed, sessionLogs);
      const classification = classifyDay(
        prescribed.length > 0,
        adherence,
        isFuture
      );

      return {
        scheduledSession: row,
        prescribed,
        logs: sessionLogs,
        adherence,
        classification,
      };
    });

    days.push({
      date: ymd,
      sessions,
      recommendedSessionName,
      isToday: ymd === todayYmd,
      isFuture,
    });
  }

  // Orphans (logs sin row scheduled correspondiente): después de la
  // migración 113 estos deberían ser raros — un log siempre tiene su
  // scheduled_session_id apuntando a una fila concreta. Mantenemos el
  // accumulator vacío para no romper consumers.
  const orphansByDate = new Map<string, ExerciseLog[]>();

  return { days, orphansByDate };
}
```

- [ ] **Step 3: Update the trainer logs endpoint to carry `session_id`**

The trainer logs endpoint at `app/api/clients/[clientId]/exercise-logs/trainer/route.ts` line 84-85 currently does:

```ts
.select(`*, exercises(id, name, category, muscle_groups), scheduled_sessions!inner(scheduled_date), exercise_log_sets(id, set_number, reps, weight_kg, video_url)`)
```

Change the join to include `session_id`:

```ts
.select(`*, exercises(id, name, category, muscle_groups), scheduled_sessions!inner(scheduled_date, session_id), exercise_log_sets(id, set_number, reps, weight_kg, video_url)`)
```

Then in the flatten step (around line 120-121, where `scheduled_date` is hoisted onto the log), add `session_id`:

```ts
scheduled_sessions: undefined,
scheduled_date: log.scheduled_sessions?.scheduled_date,
session_id: log.scheduled_sessions?.session_id ?? null,
```

Find the `ExerciseLog` type with:

```bash
grep -rn "interface ExerciseLog" components/dashboard/client-profile/
```

Add `session_id?: string | null;` to the interface.

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Expected: errors will appear in any component still consuming the old `DayMetrics.scheduledSession` shape. Fix the call sites — there will be one (the day card component, covered in Task 5).

- [ ] **Step 5: Commit (with Task 5 changes — these go together)**

Hold the commit for after Task 5; the type-check won't be clean until the day card renderer is updated. If you must commit incrementally, push a placeholder commit but the next task is required to make the build green.

---

## Task 5: Trainer day-card UI — render N session entries per date

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx` (single-day view)
- Modify: `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx` (week overview)
- Possibly modify: `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx` and `day-editor.tsx` if they consume the old `DayMetrics` shape — check via grep below.

**Context:** The week view currently renders one `DayMetrics` per date with one prescription card. After Task 4, each day carries `sessions: SessionEntry[]` and a `recommendedSessionName`. The renderer must loop over sessions and show one card per entry; when `sessions.length === 0` and `recommendedSessionName === null`, render a "REST" pill; when `sessions.length === 0` and `recommendedSessionName != null`, render a placeholder "Recomendado: X (sin actividad aún)".

- [ ] **Step 1: Confirm the consumers**

```bash
grep -rln "DayMetrics\|day\.scheduledSession\|day\.prescribed\|day\.adherence" components/dashboard/client-profile/tabs/microcycle/
```

Expected hits: `day-detail.tsx`, `week-strip.tsx`, and `use-week-metrics.ts` (already done in Task 4). If `metrics-section.tsx` or `day-editor.tsx` also appear, treat them as part of this task.

- [ ] **Step 2: Update the day-card render**

Open the file from Step 1 and adapt the JSX. The render block should look like:

```tsx
{
  day.sessions.length === 0 ? (
    <div className="rounded-md border border-default-200 bg-content1 p-3 text-sm text-default-500">
      {day.recommendedSessionName
        ? `Descanso · recomendado: ${day.recommendedSessionName}`
        : "Descanso"}
    </div>
  ) : (
    <div className="space-y-2">
      {day.sessions.map((entry) => (
        <SessionCard
          key={`${day.date}-${entry.scheduledSession.id}`}
          entry={entry}
        />
      ))}
      {day.recommendedSessionName != null &&
        !day.sessions.some(
          (s) => s.scheduledSession.session?.name === day.recommendedSessionName
        ) && (
          <p className="text-xs text-default-500">
            Recomendado: {day.recommendedSessionName}
          </p>
        )}
    </div>
  );
}
```

Adjust the existing single-card renderer into the new `SessionCard` component (extract it as a local component or update the existing one to accept a `SessionEntry` instead of the old prop shape). Keep the styling identical to the current one-card design — each card shows session name, adherence ring, prescribed/finalized counts, originally_prescribed_session chip when the entry's row has one.

- [ ] **Step 3: Type-check + dev-server smoke**

```bash
npm run type-check
```

Expected: exits 0.

Run `npm run dev` and open the client profile → Microciclo tab as trainer Carlos Torres, for client Pedro (179). Navigate to week of 2026-05-11:

- 5-12: should show two cards (Bíceps y Pierna F as client activity with chip "Recomendado: Torso Fuerza", PLUS a Torso Fuerza placeholder with 0 adherence).
- 5-14 (REST template, multi-session client activity): should show one card per session Pedro touched.
- 5-13: one card (Bíceps y Pierna F matches template).
- 5-26 (future trainer pin, no client activity yet): one card.

- [ ] **Step 4: Commit Tasks 4 + 5 together**

```bash
git add components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts \
        components/dashboard/client-profile/tabs/microcycle/types.ts \
        components/dashboard/client-profile/progress/types.ts \
        app/api/clients/[clientId]/exercise-logs/trainer/route.ts \
        components/dashboard/client-profile/tabs/microcycle/microcycle-tab.tsx \
        # plus any other day-card files you touched
git commit -m "feat(microcycle): trainer week view renders one card per (date, session)

Indexes the week's scheduled rows by (date, session_id) and walks logs
grouped by the same composite key. Each card holds its own prescription
+ adherence; the day header shows 'Recomendado: X' when the trainer's
recommendation has no card of its own.

Deletes toPrescribedFromLogs — no longer needed because each row's
session_exercises are now accurate.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 6: Microcycle PUT endpoint — `start_date` change cascade

**Files:**

- Modify: `app/api/clients/[clientId]/microcycle/route.ts`
- Modify: `lib/microcycles/db.ts`

**Context:** When the trainer changes `microcycle.start_date`, future per-date trainer pins (rows with `prescribed_by='trainer'` and no logs attached) need to be deleted so the resolver re-derives them from the new alignment. Past rows (before the new `start_date`) stay untouched — they represent history. Rows that have client logs attached also stay — that's preserved client activity.

**Multi-program scoping**: a client can have several active `client_programs` simultaneously (e.g. fuerza + cardio), each with its own microcycle. Changing `start_date` on ONE microcycle must NOT wipe trainer pins derived from a different microcycle. We scope the cascade by "the session is referenced in the changed microcycle's slots — both before and after this save". The pre-save slots union ensures pins for sessions the trainer just _removed_ from the microcycle also get cleared (otherwise they'd linger as ghost overrides). The post-save slots ensure new-alignment pins clear too. Either union is local to this microcycle, so multi-program is untouched. Edge case: if a session is shared between two microcycles, the cascade clears its pin (acceptable — trainer can re-pin; this is a deliberate `start_date` change with a confirmation modal).

- [ ] **Step 1: Add the cleanup helper in `lib/microcycles/db.ts`**

Open `lib/microcycles/db.ts` and append at the bottom:

```typescript
/**
 * Borra las filas scheduled_sessions del cliente desde `fromDate`
 * inclusive que cumplan TODAS:
 *   - prescribed_by='trainer' (no tocamos actividad del cliente).
 *   - No tienen exercise_logs ligados (preservamos historia entrenada).
 *   - session_id está en `scopedSessionIds` (las sesiones del microciclo
 *     que cambió — unión de slots pre-save y post-save para limpiar
 *     tanto pins de la alineación vieja como de la nueva).
 *
 * Use case: trainer cambia microcycle.start_date y quiere que las
 * prescripciones futuras pre-cargadas se re-deriven con la nueva
 * alineación, sin colateral en otros microciclos activos del cliente.
 */
export async function cleanFuturePrescribedRowsForReset(
  supabase: Supabase,
  clientId: string,
  fromDate: string,
  scopedSessionIds: string[],
  correlationId: string
): Promise<{ deletedCount: number; error: string | null }> {
  if (scopedSessionIds.length === 0) {
    // El microciclo cambiado no referencia sesiones (todo descanso) ni
    // tenía sesiones antes. Nada que limpiar.
    return { deletedCount: 0, error: null };
  }

  // 1. Buscar candidatos: trainer-pinned rows del cliente desde fromDate
  //    cuyo session_id pertenezca al scope.
  const { data: candidates, error: selectError } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("prescribed_by", "trainer")
    .gte("scheduled_date", fromDate)
    .in("session_id", scopedSessionIds);

  if (selectError) {
    console.error(`${LOG_PREFIX} clean reset select failed:`, {
      correlationId,
      clientId,
      fromDate,
      error: selectError.message,
    });

    return { deletedCount: 0, error: selectError.message };
  }

  const candidateIds = (candidates ?? []).map((r) => r.id);

  if (candidateIds.length === 0) return { deletedCount: 0, error: null };

  // 2. Filtrar a las que NO tengan exercise_logs ligados. Si tiene
  //    logs, no la tocamos (preservar actividad del cliente).
  const { data: withLogs, error: logsError } = await supabase
    .from("exercise_logs")
    .select("scheduled_session_id")
    .in("scheduled_session_id", candidateIds);

  if (logsError) {
    console.error(`${LOG_PREFIX} clean reset logs probe failed:`, {
      correlationId,
      clientId,
      error: logsError.message,
    });

    return { deletedCount: 0, error: logsError.message };
  }

  const withLogsSet = new Set(
    (withLogs ?? []).map((l) => l.scheduled_session_id)
  );
  const toDelete = candidateIds.filter((id) => !withLogsSet.has(id));

  if (toDelete.length === 0) return { deletedCount: 0, error: null };

  const { error: deleteError } = await supabase
    .from("scheduled_sessions")
    .delete()
    .in("id", toDelete);

  if (deleteError) {
    console.error(`${LOG_PREFIX} clean reset delete failed:`, {
      correlationId,
      clientId,
      deletedCount: toDelete.length,
      error: deleteError.message,
    });

    return { deletedCount: 0, error: deleteError.message };
  }

  console.log(`${LOG_PREFIX} clean reset deleted future trainer pins:`, {
    correlationId,
    clientId,
    fromDate,
    deletedCount: toDelete.length,
  });

  return { deletedCount: toDelete.length, error: null };
}
```

- [ ] **Step 2: Wire it into the PUT handler**

In `app/api/clients/[clientId]/microcycle/route.ts`, inside the PUT handler, find the line that calls `upsertMicrocycle` (around line 277). Before that call, detect whether the `start_date` is changing and remember the new effective `fromDate`:

```typescript
    // Detect start_date change to trigger the future-rows cascade.
    // Compare against the existing microcycle's start_date (if any).
    // Also capture the OLD slot session_ids — needed to clear pins of
    // sessions that get removed from the microcycle in this same save.
    const existingMicrocycle = await loadMicrocycleWithSlots(
      supabase,
      primary.id,
      correlationId
    );
    const previousStartDate = existingMicrocycle?.start_date ?? null;
    const startDateChanged =
      previousStartDate !== null &&
      previousStartDate !== validation.value.start_date;
    const previousSlotSessionIds = (existingMicrocycle?.slots ?? [])
      .map((s) => s.session_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const microcycleId = await upsertMicrocycle(
```

And after `replaceSlots` succeeds (around line 297-304), before reloading the microcycle, add:

```typescript
if (startDateChanged) {
  // Union of old + new slot session_ids. Old → para limpiar pins de
  // sesiones que el trainer acaba de remover del microciclo en este
  // mismo save (no quedan referenciadas pero igual tenían pins). New →
  // para limpiar pins alineados a la versión vieja del cronograma.
  // El cascade NO toca pins cuya session esté fuera de ambos sets
  // (esos vienen de otro microciclo activo del cliente — fuera de
  // scope).
  const newSlotSessionIds = validation.value.slots
    .map((s) => s.session_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const scopedSessionIds = Array.from(
    new Set([...previousSlotSessionIds, ...newSlotSessionIds])
  );

  const cleanup = await cleanFuturePrescribedRowsForReset(
    supabase,
    clientId,
    validation.value.start_date,
    scopedSessionIds,
    correlationId
  );

  if (cleanup.error) {
    // No fatal — el microciclo ya está guardado. Logueamos y
    // seguimos. La UI puede mostrar un toast de advertencia.
    console.warn(`${LOG_PREFIX} start_date cascade had errors:`, {
      correlationId,
      clientId,
      microcycleId,
      error: cleanup.error,
    });
  }
}
```

Add the import at the top:

```typescript
import {
  cleanFuturePrescribedRowsForReset,
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
  replaceSlots,
  upsertMicrocycle,
} from "@/lib/microcycles/db";
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: exits 0.

- [ ] **Step 4: Manual verification — start_date cascade**

Insert a future trainer pin row with no logs, then change start_date, then confirm it's gone.

```sql
-- Setup: create a fake future trainer pin for Pedro on 2026-07-01.
INSERT INTO scheduled_sessions(
  tenant_host, client_id, trainer_id, session_id,
  scheduled_date, status, prescribed_by
) VALUES (
  'ydqhndnvrkvycnkaghro.supabase.co', 179,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a',
  'e7c1ac45-6443-4132-987b-ca8754c99f21',  -- Torso Fuerza
  '2026-07-01', 'scheduled', 'trainer'
);
```

In a private browser, log in as Carlos Torres. Open Pedro's microcycle editor. Change start_date from 2026-05-11 to 2026-05-25. Save. Then query:

```sql
SELECT id, scheduled_date, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-07-01';
```

Expected: 0 rows. The pin you inserted was deleted because it's >= 2026-05-25, prescribed_by='trainer', and had no logs.

Also verify rows with logs survive:

```sql
-- Should still exist (it has logs):
SELECT id, scheduled_date, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-05-23';
```

Expected: row still exists (5-23 has logs from Pedro).

And the past pin (before new start_date) survives:

```sql
SELECT id, scheduled_date, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-05-13';
```

Expected: row still exists (5-13 is before new start_date 2026-05-25).

Reset Pedro's start_date back to 2026-05-11 via the editor to leave the system in a known state.

- [ ] **Step 4b: Verify multi-program scoping**

If Pedro has only one active program, you can't exercise this path live — but you can simulate it. Add a fake trainer pin for a future date pointing to a session that is NOT in Pedro's microcycle:

```sql
-- Pick any session that does NOT appear as a slot in Pedro's microcycle
-- d2b06fdb-85f3-41f1-86c7-6c45d49af595. Use SELECT * FROM sessions
-- WHERE trainer_id = 'f35d7800...' LIMIT 5 to find one outside his slot
-- list. Suppose its id is :foreign_session_id. Then:
INSERT INTO scheduled_sessions(
  tenant_host, client_id, trainer_id, session_id,
  scheduled_date, status, prescribed_by
) VALUES (
  'ydqhndnvrkvycnkaghro.supabase.co', 179,
  'f35d7800-6181-4bd3-8b5c-2c9cc364220a',
  ':foreign_session_id'::uuid,
  '2026-07-02', 'scheduled', 'trainer'
);
```

Now change Pedro's microcycle `start_date` again from 2026-05-11 → 2026-05-26 via the editor. Then:

```sql
SELECT scheduled_date, session_id, prescribed_by FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = '2026-07-02';
```

Expected: the row STILL EXISTS because its session_id isn't in the changed microcycle's slot set. The scoping correctly excluded it.

Clean up:

```sql
DELETE FROM scheduled_sessions WHERE client_id = 179 AND scheduled_date = '2026-07-02';
```

And reset Pedro's start_date back to 2026-05-11 again.

- [ ] **Step 5: Commit**

```bash
git add lib/microcycles/db.ts app/api/clients/[clientId]/microcycle/route.ts
git commit -m "feat(microcycle): cascade start_date change to future trainer pins

When the trainer changes microcycle.start_date, scheduled_sessions rows
from the new start_date forward that are prescribed_by='trainer' with
no exercise_logs attached get deleted, so the resolver re-derives them
from the new alignment. Past rows and rows with logs are preserved.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 7: Microcycle editor — confirmation modal on `start_date` change

**Files:**

- Modify: `components/trainer/microcycle/microcycle-config.tsx`

**Context:** The PUT handler now cascades automatically. The trainer needs a one-click confirmation so they can't change `start_date` accidentally.

- [ ] **Step 1: Track the originally-loaded `start_date`**

In `components/trainer/microcycle/microcycle-config.tsx`, add a ref to remember the loaded `start_date`:

```tsx
import { useRef, useState } from "react";
// ... existing imports

export default function MicrocycleConfig({ clientId }: Props) {
  const { data, isLoading, isError, error, isSuccess } =
    useTrainerMicrocycle(clientId);
  const save = useSaveMicrocycle(clientId);

  const editor = useMicrocycleEditor(data?.microcycle, isSuccess);

  // Remember the start_date that was loaded so we can detect changes.
  const loadedStartDateRef = useRef<string | null>(null);

  if (
    isSuccess &&
    loadedStartDateRef.current === null &&
    data?.microcycle?.start_date
  ) {
    loadedStartDateRef.current = data.microcycle.start_date;
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
```

- [ ] **Step 2: Split `handleSave` into "intent" + "confirmed"**

Replace the existing `handleSave` with:

```tsx
const performSave = () => {
  save.mutate(
    {
      duration_days: editor.durationDays,
      start_date: editor.startDate,
      slots: editor.toPayloadSlots(),
    },
    {
      onSuccess: () => {
        loadedStartDateRef.current = editor.startDate;
        setConfirmOpen(false);
        addToast({
          title: "Microciclo guardado",
          description: "Tu cliente ya puede verlo como referencia en su app.",
        });
      },
      onError: (e) => {
        setConfirmOpen(false);
        addToast({
          title: "Error al guardar",
          description:
            e instanceof Error
              ? e.message
              : "Error inesperado al guardar el microciclo",
        });
      },
    }
  );
};

const handleSave = () => {
  const previous = loadedStartDateRef.current;
  const startDateChanged = previous !== null && previous !== editor.startDate;

  if (startDateChanged) {
    setConfirmOpen(true);

    return;
  }

  performSave();
};
```

- [ ] **Step 3: Render the modal**

Add a HeroUI Modal at the bottom of the JSX (above the closing tag of the component's top-level element):

```tsx
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

// ... inside the JSX, near the bottom of the returned tree:
<Modal isOpen={confirmOpen} onOpenChange={(open) => setConfirmOpen(open)}>
  <ModalContent>
    <ModalHeader>Cambiar fecha de inicio</ModalHeader>
    <ModalBody>
      <p className="text-sm text-default-700">
        Esto borrará las prescripciones futuras pre-cargadas a partir del{" "}
        <strong>{editor.startDate}</strong> y las recalculará con la nueva
        alineación del microciclo. Las fechas en las que tu cliente ya entrenó
        no se tocan.
      </p>
    </ModalBody>
    <ModalFooter>
      <Button variant="light" onPress={() => setConfirmOpen(false)}>
        Cancelar
      </Button>
      <Button color="primary" isLoading={save.isPending} onPress={performSave}>
        Confirmar
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>;
```

- [ ] **Step 4: Type-check + manual flow**

```bash
npm run type-check
```

Expected: exits 0.

Run `npm run dev`, open Pedro's microcycle editor as Carlos Torres. Change just the duration (e.g. 21 → 14 days), Save — modal does NOT appear, save proceeds. Now change start_date — modal appears. Cancel → nothing changes. Change start_date again, Confirm → save proceeds, future trainer-only pins are cleared (verify with the SQL from Task 6, Step 4).

- [ ] **Step 5: Commit**

```bash
git add components/trainer/microcycle/microcycle-config.tsx
git commit -m "feat(microcycle): confirmation modal when changing start_date

The editor now prompts before saving when start_date differs from the
loaded value. Confirming triggers the server-side cascade that wipes
future trainer-only prescription rows so they re-derive from the new
alignment.

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

---

## Task 8: End-to-end manual verification

**Files:** none — verification only.

- [ ] **Step 1: Pedro-style multi-session day no longer corrupts logs**

In a private browser, log in as Pedro (client 179). On today's date, tap "Comenzar" on session A (e.g. Bíceps y Pierna F), log one exercise + finalize. Tap "Cambiar entrenamiento", pick session B (Torso Fuerza), log one exercise + finalize. Then query:

```sql
SELECT id, session_id, prescribed_by, status FROM scheduled_sessions
WHERE client_id = 179 AND scheduled_date = CURRENT_DATE
ORDER BY session_id;
```

Expected: **two rows**, one per session, both `prescribed_by='client'`. (Pre-migration this would have been one row.)

```sql
SELECT scheduled_session_id, exercise_id, finalized_at IS NOT NULL AS finalized
FROM exercise_logs
WHERE client_id = 179 AND completed_at::date = CURRENT_DATE;
```

Expected: two logs, each pointing at a different `scheduled_session_id` matching its session.

- [ ] **Step 2: Trainer view shows two cards for that day**

Switch to Carlos Torres's browser tab. Open Pedro's profile → Microciclo tab → today's week. The current day should render two session cards.

- [ ] **Step 3: start_date change wipes future pins and propagates**

Change Pedro's microcycle start_date from `2026-05-11` to `2026-06-01`. Confirm in the modal. After save, navigate to a date in the new cycle (e.g. `2026-06-02` which is now D2 = Torso Fuerza in the new alignment). The client app for Pedro should show "Torso Fuerza" as the recommendation. Check the DB: there should be no pre-existing trainer pin for any date >= `2026-06-01`.

Reset start_date back to `2026-05-11` (use the editor; you'll get the modal again — confirm to apply the cascade in reverse). Verify the dev experience is sane.

- [ ] **Step 4: Lint + build to ensure deploy-ready state**

```bash
npm run lint:check
npm run type-check
npm run build
```

Expected: all exit 0. (The build copies static assets into the standalone — required if you want to deploy preview.)

- [ ] **Step 5: Final summary commit (optional, only if you have unstaged docs updates)**

If you've made any incidental doc tweaks during verification:

```bash
git status
git add docs/...
git commit -m "docs(microcycle): minor notes from end-to-end verification

Co-Authored-By: RuFlo <ruv@ruv.net>"
```

If nothing else changed, skip this step.

---

## Post-implementation notes

- **No historical backfill.** Pedro's existing 5-12 through 5-23 polluted rows stay as-is per the spec's §7. The trainer view will surface them as best-effort one-card-per-row entries.
- **Backwards compatibility of `upsert_scheduled_session`.** The new signature has the same parameter list and ordering as the post-111 version. Existing callers (`app/api/clients/[clientId]/exercise-logs/route.ts:222-233`, and any other) require no changes.
- **Backwards compatibility of `replace_scheduled_session_overrides`.** Same signature as post-110; existing callers (the trainer per-date override flow) require no changes. The reconciliation of stale pins is internal to the RPC.
- **Existing duplicate rows are deduplicated in-place** by migration 113. We keep the row with most logs (tie-break by oldest), repoint other rows' logs to the survivor, and drop the losers. About 16 rows in production at time of writing. The dedupe is part of the same migration transaction — if it fails, the constraint isn't added and nothing changes.
- **`scheduled_sessions.session_id` becomes effectively required.** Migration 113 sets it NOT NULL. If any code path was relying on inserting NULL, it'll fail loudly — there shouldn't be any (the RPC has always required `p_session_id`).
- **Concurrency.** The advisory lock is now per (client, date, session_id), strictly finer-grained than before. Two clients (or two requests for the same client across different sessions) on the same date no longer serialize against each other. Wins.
