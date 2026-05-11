# Dated Prescriptions Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the trainer override the microcycle template for a specific date — change the assigned session, edit prescribed sets/reps/weight per exercise, add/remove exercises — without touching any other date or the template itself. The client app reads overrides via a new resolved-by-date endpoint.

**Architecture:** A new `scheduled_session_exercises` table stores per-date overrides keyed to a `scheduled_sessions` row. Read precedence: override → `session_exercises` → microcycle template. Every Save in the inline editor is a delete + full insert (override always represents the complete plan for the day, never partial diffs). The Phase 2 read paths gain an override leg; the Phase 1/2 template flow stays intact for dates without an override.

**Tech Stack:** Next.js 15 App Router · React 19 · HeroUI v2 · Tailwind v4 · `@iconify/react` · `@dnd-kit` (already present) · Supabase. No new dependencies.

**Reference:** Spec at `docs/superpowers/specs/2026-05-11-dated-prescriptions-design.md`.

---

## File Structure

### Create

```
supabase/migrations/093_scheduled_session_exercises.sql
                                  Per-date override table + index + RLS

app/api/clients/[clientId]/scheduled-sessions/trainer/day/route.ts
                                  PUT (save override) + DELETE (reset to template)

app/api/client/scheduled-sessions/[date]/route.ts
                                  Client-auth resolved prescription per date

components/dashboard/client-profile/tabs/microcycle/day-editor.tsx
                                  Inline editor orchestrator (form state, save/cancel, restore)

components/dashboard/client-profile/tabs/microcycle/day-editor-row.tsx
                                  Single editable exercise row (drag, inputs, delete)

components/dashboard/client-profile/tabs/microcycle/day-editor-session-picker.tsx
                                  Dropdown of available sessions for the swap

components/dashboard/client-profile/tabs/microcycle/day-editor-exercise-picker.tsx
                                  Library autocomplete for "Añadir ejercicio"

components/dashboard/client-profile/tabs/microcycle/use-day-editor.ts
                                  Form state + save/delete mutations

components/dashboard/client-profile/tabs/microcycle/use-trainer-sessions.ts
                                  Cached fetch of trainer sessions for the swap dropdown
```

### Modify

```
components/dashboard/client-profile/tabs/microcycle/types.ts
                                  Add OverrideExerciseRow + extend ScheduledSessionRow

app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts
                                  Phase 2 endpoint also surfaces overrides (precedence merge)

components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts
                                  Expose invalidate(weekStartYmd) so editor can refresh metrics

components/dashboard/client-profile/tabs/microcycle/day-detail.tsx
                                  Pencil button + mode toggle + render <DayEditor />
```

### Do not touch

- `MicrocycleConfig` and the slot editor.
- `sessions` / `session_exercises` schema or routes.
- The trainer's program editor (workouts-tab, cardio-tab).
- Phase 1 history components.

All new files target <250 lines. The largest is `day-editor.tsx`.

---

## Task 1: Migration 093 — `scheduled_session_exercises`

**Files:**

- Create: `supabase/migrations/093_scheduled_session_exercises.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-date override of a scheduled session's prescription.
--
-- The microcycle template (microcycles + microcycle_slots → sessions →
-- session_exercises) defines the recurring weekly pattern. When the trainer
-- needs to deviate for a single date — change the assigned session, tweak
-- sets/reps/weight, add or remove an exercise — they save a row per
-- exercise here. Read precedence: override → session_exercises →
-- microcycle template.
--
-- Every Save in the editor is a delete + full insert: this table always
-- represents the complete plan for the day when present, never partial
-- diffs. That invariant keeps the read logic trivial.

CREATE TABLE IF NOT EXISTS scheduled_session_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    scheduled_session_id UUID NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    exercise_order INTEGER NOT NULL,
    sets INTEGER,
    reps TEXT,                          -- "10-12", "AMRAP", etc.
    weight_kg DECIMAL,
    duration_seconds INTEGER,
    distance_meters DECIMAL,
    rest_seconds INTEGER,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_scheduled_session_exercise_order
        UNIQUE (scheduled_session_id, exercise_order)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_session_exercises_session
    ON scheduled_session_exercises(scheduled_session_id);

ALTER TABLE scheduled_session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage scheduled session exercises"
    ON scheduled_session_exercises FOR ALL TO anon USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply migration locally**

Run via your Supabase workflow (Supabase MCP `apply_migration`, the `supabase` CLI, or whatever method this project uses for migrations 091/092). Verify the table exists:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scheduled_session_exercises'
ORDER BY ordinal_position;
```

Expected: 14 columns matching the CREATE TABLE.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/093_scheduled_session_exercises.sql
git commit -m "feat(db): scheduled_session_exercises for per-date overrides"
```

---

## Task 2: Extend types module

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle/types.ts`

Add the override row type and extend `ScheduledSessionRow` so the API + hook + UI all share one shape.

- [ ] **Step 1: Append the override types**

Open the file and append (do not remove existing types):

```ts
/** A row from scheduled_session_exercises — the per-date override. */
export interface OverrideExerciseRow {
  id: string;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise: { id: string; name: string; category: string };
}
```

Then update `ScheduledSessionRow` to include `override_exercises`. Find:

```ts
export interface ScheduledSessionRow {
  id: string;
  scheduled_date: string;
  status: "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
  completion_date: string | null;
  session: {
    id: string;
    name: string;
    session_exercises: Array<{ ... }>;
  } | null;
}
```

Replace with:

```ts
export interface ScheduledSessionRow {
  id: string;
  scheduled_date: string;
  status: "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
  completion_date: string | null;
  session: {
    id: string;
    name: string;
    session_exercises: Array<{
      id: string;
      exercise_order: number;
      sets: number | null;
      reps: string | null;
      weight_kg: number | null;
      exercise: { id: string; name: string; category: string };
    }>;
  } | null;
  /** Override rows — when present, they win over session.session_exercises. */
  override_exercises: OverrideExerciseRow[];
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/types.ts
git commit -m "feat(trainer): override types for dated prescriptions"
```

---

## Task 3: PUT endpoint — save day override

**Files:**

- Create: `app/api/clients/[clientId]/scheduled-sessions/trainer/day/route.ts`

Single file containing PUT (save) + DELETE (reset). Only PUT in this task; DELETE in Task 4.

- [ ] **Step 1: Create the route with PUT handler**

```ts
// PUT /api/clients/[clientId]/scheduled-sessions/trainer/day
// DELETE /api/clients/[clientId]/scheduled-sessions/trainer/day?date=YYYY-MM-DD
//
// Save / reset a per-date prescription override. Trainer-scoped: validates
// client.tenant === session.trainer_id. Edit lock: past dates with logs
// return 409 (the day is immutable history at that point).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Trainer Day Override API]";

interface PutBody {
  scheduledDate: string;
  sessionId: string | null;
  exercises: Array<{
    exerciseId: string;
    exerciseOrder: number;
    sets: number | null;
    reps: string | null;
    weightKg: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
  }>;
}

function todayYmd(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const body = (await request.json()) as PutBody;

    // ── Body validation ─────────────────────────────────────────────
    if (!isYmd(body.scheduledDate)) {
      return NextResponse.json(
        { success: false, error: "scheduledDate inválido" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.exercises)) {
      return NextResponse.json(
        { success: false, error: "exercises debe ser un array" },
        { status: 400 }
      );
    }

    const orders = body.exercises.map((e) => e.exerciseOrder);
    const orderSet = new Set(orders);

    if (orderSet.size !== orders.length) {
      return NextResponse.json(
        { success: false, error: "exerciseOrder duplicado" },
        { status: 400 }
      );
    }

    // ── Tenant + client ownership ──────────────────────────────────
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // ── Lock check: past + has logs ────────────────────────────────
    if (body.scheduledDate < todayYmd()) {
      const { count } = await supabase
        .from("exercise_logs")
        .select("scheduled_sessions!inner(id, scheduled_date, client_id)", {
          count: "exact",
          head: true,
        })
        .eq("scheduled_sessions.client_id", clientId)
        .eq("scheduled_sessions.scheduled_date", body.scheduledDate);

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Día con registros — no se puede editar",
            code: "DAY_LOCKED",
          },
          { status: 409 }
        );
      }
    }

    // ── Validate referenced sessionId belongs to tenant ────────────
    if (body.sessionId) {
      const { data: sess, error: sessError } = await supabase
        .from("sessions")
        .select("id, tenant_host")
        .eq("id", body.sessionId)
        .single();

      if (sessError || !sess || sess.tenant_host !== session.trainer_id) {
        return NextResponse.json(
          { success: false, error: "sessionId inválido" },
          { status: 400 }
        );
      }
    }

    // ── Validate referenced exercise_ids belong to tenant ──────────
    if (body.exercises.length > 0) {
      const exerciseIds = body.exercises.map((e) => e.exerciseId);
      const { data: foundEx, error: exError } = await supabase
        .from("exercises")
        .select("id, tenant_host")
        .in("id", exerciseIds);

      if (exError || !foundEx) {
        return NextResponse.json(
          { success: false, error: "Error validando ejercicios" },
          { status: 500 }
        );
      }

      const validIds = new Set(
        foundEx
          .filter((e) => e.tenant_host === session.trainer_id)
          .map((e) => e.id)
      );

      for (const id of exerciseIds) {
        if (!validIds.has(id)) {
          return NextResponse.json(
            { success: false, error: `exerciseId inválido: ${id}` },
            { status: 400 }
          );
        }
      }
    }

    // ── Upsert scheduled_sessions row ──────────────────────────────
    let scheduledSessionId: string;

    const { data: existing } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("client_id", clientId)
      .eq("scheduled_date", body.scheduledDate)
      .maybeSingle();

    if (existing) {
      scheduledSessionId = existing.id;
      await supabase
        .from("scheduled_sessions")
        .update({
          session_id: body.sessionId,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduledSessionId);
    } else {
      const { data: created, error: createError } = await supabase
        .from("scheduled_sessions")
        .insert({
          tenant_host: session.trainer_id,
          client_id: clientId,
          trainer_id: session.trainer_id,
          session_id: body.sessionId,
          scheduled_date: body.scheduledDate,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (createError || !created) {
        console.error(`${LOG_PREFIX} create scheduled_sessions:`, {
          correlationId,
          error: createError?.message,
        });

        return NextResponse.json(
          { success: false, error: "Error creando sesión programada" },
          { status: 500 }
        );
      }
      scheduledSessionId = created.id;
    }

    // ── Replace scheduled_session_exercises (delete + insert) ─────
    const { error: delError } = await supabase
      .from("scheduled_session_exercises")
      .delete()
      .eq("scheduled_session_id", scheduledSessionId);

    if (delError) {
      console.error(`${LOG_PREFIX} delete overrides:`, {
        correlationId,
        error: delError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error reemplazando override" },
        { status: 500 }
      );
    }

    if (body.exercises.length > 0) {
      const rows = body.exercises.map((e) => ({
        tenant_host: session.trainer_id,
        scheduled_session_id: scheduledSessionId,
        exercise_id: e.exerciseId,
        exercise_order: e.exerciseOrder,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        weight_kg: e.weightKg ?? null,
        duration_seconds: e.durationSeconds ?? null,
        distance_meters: e.distanceMeters ?? null,
        rest_seconds: e.restSeconds ?? null,
        notes: e.notes ?? null,
      }));

      const { error: insError } = await supabase
        .from("scheduled_session_exercises")
        .insert(rows);

      if (insError) {
        console.error(`${LOG_PREFIX} insert overrides:`, {
          correlationId,
          error: insError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error guardando override" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, scheduledSessionId });
  } catch (error) {
    console.error(`${LOG_PREFIX} PUT unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/api/clients/[clientId]/scheduled-sessions/trainer/day/route.ts"
git commit -m "feat(api): trainer PUT to save dated prescription override"
```

---

## Task 4: DELETE endpoint — reset day to template

**Files:**

- Modify: `app/api/clients/[clientId]/scheduled-sessions/trainer/day/route.ts`

Append a `DELETE` handler beneath the `PUT`.

- [ ] **Step 1: Append the DELETE handler**

Add at the end of the file (after the closing `}` of `PUT`):

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!isYmd(date)) {
      return NextResponse.json(
        { success: false, error: "date inválido" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    if (date! < todayYmd()) {
      const { count } = await supabase
        .from("exercise_logs")
        .select("scheduled_sessions!inner(id, scheduled_date, client_id)", {
          count: "exact",
          head: true,
        })
        .eq("scheduled_sessions.client_id", clientId)
        .eq("scheduled_sessions.scheduled_date", date!);

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Día con registros — no se puede resetear",
            code: "DAY_LOCKED",
          },
          { status: 409 }
        );
      }
    }

    const { data: ss } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("client_id", clientId)
      .eq("scheduled_date", date!)
      .maybeSingle();

    if (!ss) {
      // Nothing to reset; return success idempotently.
      return NextResponse.json({ success: true });
    }

    // Defensive: check for logs even if today/future (shouldn't happen but
    // protects historical referential integrity).
    const { count: logsCount } = await supabase
      .from("exercise_logs")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_session_id", ss.id);

    if ((logsCount ?? 0) > 0) {
      // Logs exist: keep scheduled_sessions row, only delete the override
      // exercises so the day falls back to session.session_exercises.
      const { error: delExError } = await supabase
        .from("scheduled_session_exercises")
        .delete()
        .eq("scheduled_session_id", ss.id);

      if (delExError) {
        console.error(`${LOG_PREFIX} delete overrides only:`, {
          correlationId,
          error: delExError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error reseteando override" },
          { status: 500 }
        );
      }
    } else {
      // No logs: drop the scheduled_sessions row → cascade removes overrides.
      const { error: delSsError } = await supabase
        .from("scheduled_sessions")
        .delete()
        .eq("id", ss.id);

      if (delSsError) {
        console.error(`${LOG_PREFIX} delete scheduled_session:`, {
          correlationId,
          error: delSsError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error eliminando sesión programada" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add "app/api/clients/[clientId]/scheduled-sessions/trainer/day/route.ts"
git commit -m "feat(api): trainer DELETE to reset dated prescription override"
```

---

## Task 5: Modify trainer GET endpoint — read overrides

**Files:**

- Modify: `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`

The Phase 2 endpoint currently selects `session.session_exercises`. Add `override_exercises` to the SELECT and update the response shape so the hook can read either.

- [ ] **Step 1: Edit the SELECT in `GET`**

Find the `realQuery` block (around the `select(...)` call building the trainer schedule). Replace its select string with:

```ts
.select(
  `id, scheduled_date, status, completion_date,
   session:sessions(
     id, name,
     session_exercises(
       id, exercise_order, sets, reps, weight_kg,
       exercise:exercises(id, name, category)
     )
   ),
   override_exercises:scheduled_session_exercises(
     id, exercise_order, sets, reps, weight_kg,
     duration_seconds, distance_meters, rest_seconds, notes,
     exercise:exercises(id, name, category)
   )`
)
```

- [ ] **Step 2: Update the materialize-template response shape**

The materialized template entries (created in `materializeTemplate`) need to include `override_exercises: []` so the type matches.

Find the `out.set(date, { ... })` call inside `materializeTemplate` and add `override_exercises: []` to the object literal:

```ts
out.set(date, {
  id: `template:${cycle.startDate}:${dayIndex}:${date}`,
  scheduled_date: date,
  status: "scheduled",
  completion_date: null,
  session: sessionDetail,
  override_exercises: [],
});
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
git add "app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts"
git commit -m "feat(api): trainer schedule endpoint surfaces dated overrides"
```

---

## Task 6: Hook — apply override precedence inside `useWeekMetrics`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts`

The `toPrescribed` helper currently reads `row.session.session_exercises`. Update it to prefer `row.override_exercises` when present, and add an `invalidate(weekStartYmd)` method to the hook so the editor can refresh after Save.

- [ ] **Step 1: Update `toPrescribed` to honour overrides**

Replace the current `toPrescribed`:

```ts
function toPrescribed(row: ScheduledSessionRow): PrescribedExercise[] {
  // Override wins when present.
  if (row.override_exercises && row.override_exercises.length > 0) {
    return [...row.override_exercises]
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((oe) => ({
        exerciseId: oe.exercise.id,
        name: oe.exercise.name,
        category: oe.exercise.category,
        prescribedSets: oe.sets ?? 0,
        prescribedReps: oe.reps,
        prescribedWeightKg: oe.weight_kg,
      }));
  }

  if (!row.session) return [];

  return [...row.session.session_exercises]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((se) => ({
      exerciseId: se.exercise.id,
      name: se.exercise.name,
      category: se.exercise.category,
      prescribedSets: se.sets ?? 0,
      prescribedReps: se.reps,
      prescribedWeightKg: se.weight_kg,
    }));
}
```

- [ ] **Step 2: Expose `invalidate` from the hook**

Find the `return` at the bottom of `useWeekMetrics` and update it. Also add an `invalidate` callback above the return:

```ts
const invalidate = useCallback(
  (weekStartYmdToFlush?: string) => {
    if (weekStartYmdToFlush) {
      cacheRef.current.delete(weekStartYmdToFlush);
    } else {
      cacheRef.current.clear();
    }
    refetch();
  },
  [refetch]
);

return { data, loading, error, refetch, invalidate };
```

Update the `UseWeekMetrics` interface:

```ts
interface UseWeekMetrics {
  data: WeekMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  invalidate: (weekStartYmd?: string) => void;
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts
git commit -m "feat(trainer): apply override precedence in useWeekMetrics + invalidate"
```

---

## Task 7: `useTrainerSessions` — load sessions for the swap dropdown

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/use-trainer-sessions.ts`

Hook that fetches all sessions belonging to the trainer's active programs for this client. Used by the `DayEditorSessionPicker`. Cached at module level so it's reused across editor opens within a session.

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

interface TrainerSession {
  id: string;
  name: string;
}

const cacheByClient = new Map<string, TrainerSession[]>();

export function useTrainerSessions(clientId: string): {
  sessions: TrainerSession[];
  loading: boolean;
  error: string | null;
} {
  const cached = cacheByClient.get(clientId) ?? null;
  const [sessions, setSessions] = useState<TrainerSession[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (cacheByClient.has(clientId)) {
      setSessions(cacheByClient.get(clientId) ?? []);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError(null);
    try {
      // The existing /api/clients/[clientId]/programs returns the active
      // programs with their sessions. We flatten into a unique session list.
      const res = await fetch(`/api/clients/${clientId}/programs`);
      const json = await res.json();

      if (!json.success) {
        setError("No se pudieron cargar las sesiones disponibles.");
        setLoading(false);

        return;
      }

      const out: TrainerSession[] = [];
      const seen = new Set<string>();

      for (const program of json.programs ?? []) {
        for (const sess of program.sessions ?? []) {
          if (!sess.id || seen.has(sess.id)) continue;
          seen.add(sess.id);
          out.push({ id: sess.id, name: sess.name });
        }
      }

      cacheByClient.set(clientId, out);
      setSessions(out);
      setLoading(false);
    } catch {
      setError("Error de conexión.");
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { sessions, loading, error };
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/use-trainer-sessions.ts
git commit -m "feat(trainer): hook to load trainer sessions for the day editor"
```

---

## Task 8: `useDayEditor` — form state and mutations

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/use-day-editor.ts`

Hook that owns the editor's form state, validates, calls PUT/DELETE, and reports loading/error.

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useCallback, useMemo, useState } from "react";

import type { PrescribedExercise } from "./types";

export interface EditorRow {
  /** Stable React key — preserved across reorders. */
  key: string;
  exerciseId: string;
  name: string;
  category: string;
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
}

interface UseDayEditor {
  rows: EditorRow[];
  sessionId: string | null;
  hasChanges: boolean;
  isValid: boolean;
  saving: boolean;
  resetting: boolean;
  error: string | null;
  setSessionId: (id: string | null) => void;
  updateRow: (key: string, patch: Partial<EditorRow>) => void;
  reorderRows: (next: EditorRow[]) => void;
  addRow: (input: {
    exerciseId: string;
    name: string;
    category: string;
  }) => void;
  removeRow: (key: string) => void;
  /** Replace the whole list — used when the trainer swaps session. */
  replaceFromPrescribed: (
    prescribed: PrescribedExercise[],
    sessionId: string | null
  ) => void;
  save: () => Promise<{ ok: boolean; locked?: boolean }>;
  reset: () => Promise<{ ok: boolean; locked?: boolean }>;
}

function rowKey(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromPrescribed(p: PrescribedExercise): EditorRow {
  return {
    key: rowKey(),
    exerciseId: p.exerciseId,
    name: p.name,
    category: p.category,
    sets: p.prescribedSets > 0 ? p.prescribedSets : null,
    reps: p.prescribedReps,
    weightKg: p.prescribedWeightKg,
  };
}

interface UseDayEditorParams {
  clientId: string;
  scheduledDate: string;
  initialPrescribed: PrescribedExercise[];
  initialSessionId: string | null;
  /** Called after a successful save or reset. Editor closes & metrics refresh. */
  onSaved: () => void;
}

export function useDayEditor({
  clientId,
  scheduledDate,
  initialPrescribed,
  initialSessionId,
  onSaved,
}: UseDayEditorParams): UseDayEditor {
  const initialRows = useMemo(
    () => initialPrescribed.map(fromPrescribed),
    [initialPrescribed]
  );
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((key: string, patch: Partial<EditorRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const reorderRows = useCallback((next: EditorRow[]) => {
    setRows(next);
  }, []);

  const addRow = useCallback(
    (input: { exerciseId: string; name: string; category: string }) => {
      setRows((prev) => [
        ...prev,
        {
          key: rowKey(),
          exerciseId: input.exerciseId,
          name: input.name,
          category: input.category,
          sets: null,
          reps: null,
          weightKg: null,
        },
      ]);
    },
    []
  );

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const replaceFromPrescribed = useCallback(
    (prescribed: PrescribedExercise[], nextSessionId: string | null) => {
      setRows(prescribed.map(fromPrescribed));
      setSessionId(nextSessionId);
    },
    []
  );

  const isValid = useMemo(() => {
    for (const r of rows) {
      if (r.sets != null && r.sets <= 0) return false;
      if (r.sets != null && r.sets > 0 && (!r.reps || r.reps.trim() === ""))
        return false;
      if (r.weightKg != null && r.weightKg < 0) return false;
    }

    return true;
  }, [rows]);

  const hasChanges = useMemo(() => {
    if (sessionId !== initialSessionId) return true;
    if (rows.length !== initialRows.length) return true;

    for (let i = 0; i < rows.length; i++) {
      const a = rows[i]!;
      const b = initialRows[i]!;

      if (
        a.exerciseId !== b.exerciseId ||
        a.sets !== b.sets ||
        a.reps !== b.reps ||
        a.weightKg !== b.weightKg
      ) {
        return true;
      }
    }

    return false;
  }, [rows, sessionId, initialRows, initialSessionId]);

  const save = useCallback(async (): Promise<{
    ok: boolean;
    locked?: boolean;
  }> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/scheduled-sessions/trainer/day`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledDate,
            sessionId,
            exercises: rows.map((r, idx) => ({
              exerciseId: r.exerciseId,
              exerciseOrder: idx + 1,
              sets: r.sets,
              reps: r.reps,
              weightKg: r.weightKg,
            })),
          }),
        }
      );

      if (res.status === 409) {
        setError("Día con registros — no se puede editar.");
        setSaving(false);

        return { ok: false, locked: true };
      }

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Error al guardar.");
        setSaving(false);

        return { ok: false };
      }

      setSaving(false);
      onSaved();

      return { ok: true };
    } catch {
      setError("Error de conexión.");
      setSaving(false);

      return { ok: false };
    }
  }, [clientId, scheduledDate, sessionId, rows, onSaved]);

  const reset = useCallback(async (): Promise<{
    ok: boolean;
    locked?: boolean;
  }> => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/scheduled-sessions/trainer/day?date=${scheduledDate}`,
        { method: "DELETE" }
      );

      if (res.status === 409) {
        setError("Día con registros — no se puede resetear.");
        setResetting(false);

        return { ok: false, locked: true };
      }

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Error al resetear.");
        setResetting(false);

        return { ok: false };
      }

      setResetting(false);
      onSaved();

      return { ok: true };
    } catch {
      setError("Error de conexión.");
      setResetting(false);

      return { ok: false };
    }
  }, [clientId, scheduledDate, onSaved]);

  return {
    rows,
    sessionId,
    hasChanges,
    isValid,
    saving,
    resetting,
    error,
    setSessionId,
    updateRow,
    reorderRows,
    addRow,
    removeRow,
    replaceFromPrescribed,
    save,
    reset,
  };
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/use-day-editor.ts
git commit -m "feat(trainer): useDayEditor hook for form state and mutations"
```

---

## Task 9: `DayEditorRow` — single editable row

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-editor-row.tsx`

Presentational row with drag handle, exercise name, three numeric/text inputs, delete button.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Input } from "@heroui/react";
import { Icon } from "@iconify/react";

import type { EditorRow } from "./use-day-editor";

interface Props {
  row: EditorRow;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onChange: (patch: Partial<EditorRow>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function DayEditorRow({
  row,
  dragHandleProps,
  onChange,
  onRemove,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-md bg-white">
      {dragHandleProps ? (
        <div
          aria-label="Reordenar"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
          {...dragHandleProps}
        >
          <Icon icon="solar:hamburger-menu-linear" width={16} />
        </div>
      ) : null}

      <p className="flex-1 min-w-0 text-sm text-gray-900 truncate">
        {row.name}
      </p>

      <Input
        aria-label="Series"
        className="w-16"
        isDisabled={disabled}
        placeholder="Sets"
        size="sm"
        type="number"
        value={row.sets != null ? String(row.sets) : ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value);

          onChange({ sets: Number.isNaN(v) ? null : v });
        }}
      />

      <Input
        aria-label="Reps"
        className="w-20"
        isDisabled={disabled}
        placeholder="Reps"
        size="sm"
        value={row.reps ?? ""}
        onChange={(e) =>
          onChange({ reps: e.target.value === "" ? null : e.target.value })
        }
      />

      <Input
        aria-label="Peso en kilos"
        className="w-20"
        endContent={<span className="text-[11px] text-gray-400">kg</span>}
        isDisabled={disabled}
        placeholder="Kg"
        size="sm"
        step="0.5"
        type="number"
        value={row.weightKg != null ? String(row.weightKg) : ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseFloat(e.target.value);

          onChange({ weightKg: Number.isNaN(v) ? null : v });
        }}
      />

      <button
        aria-label={`Eliminar ${row.name}`}
        className="shrink-0 text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
        disabled={disabled}
        type="button"
        onClick={onRemove}
      >
        <Icon icon="solar:trash-bin-trash-linear" width={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/day-editor-row.tsx
git commit -m "feat(trainer): DayEditorRow for inline exercise editing"
```

---

## Task 10: `DayEditorSessionPicker` — swap session dropdown

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-editor-session-picker.tsx`

HeroUI Select that lists sessions from `useTrainerSessions`. Calling `onSelect` triggers the parent (DayEditor) to confirm + repopulate.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Select, SelectItem, Spinner } from "@heroui/react";

import { useTrainerSessions } from "./use-trainer-sessions";

interface Props {
  clientId: string;
  value: string | null;
  onSelect: (sessionId: string) => void;
  disabled?: boolean;
}

export function DayEditorSessionPicker({
  clientId,
  value,
  onSelect,
  disabled,
}: Props) {
  const { sessions, loading } = useTrainerSessions(clientId);

  if (loading && sessions.length === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Spinner size="sm" />
        Cargando sesiones…
      </div>
    );
  }

  return (
    <Select
      aria-label="Sesión asignada al día"
      className="w-56"
      isDisabled={disabled}
      placeholder="Selecciona sesión"
      selectedKeys={value ? [value] : []}
      size="sm"
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0];

        if (typeof next === "string") onSelect(next);
      }}
    >
      {sessions.map((s) => (
        <SelectItem key={s.id}>{s.name}</SelectItem>
      ))}
    </Select>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/day-editor-session-picker.tsx
git commit -m "feat(trainer): DayEditorSessionPicker for swap dropdown"
```

---

## Task 11: `DayEditorExercisePicker` — autocomplete to add an exercise

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-editor-exercise-picker.tsx`

Autocomplete that searches the trainer's exercise library (server-side) and emits the chosen exercise.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface LibraryExercise {
  id: string;
  name: string;
  category: string;
}

interface Props {
  onPick: (exercise: LibraryExercise) => void;
  disabled?: boolean;
}

export function DayEditorExercisePicker({ onPick, disabled }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial browse list (capped) so the dropdown opens with content.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/exercises?limit=100`);
        const json = await res.json();

        if (!cancelled && json.success) {
          setResults(json.exercises ?? []);
        }
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced server-side search when the user types.
  useEffect(() => {
    const term = search.trim();

    if (!term) return;

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term, limit: "50" });
        const res = await fetch(`/api/exercises?${params}`);
        const json = await res.json();

        if (json.success) setResults(json.exercises ?? []);
      } catch {
        /* leave previous results */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [search]);

  return (
    <Autocomplete
      aria-label="Añadir ejercicio"
      className="w-full"
      defaultItems={results}
      inputValue={search}
      isDisabled={disabled}
      isLoading={loading}
      placeholder="Añadir ejercicio…"
      size="sm"
      startContent={<Icon icon="solar:add-circle-linear" width={16} />}
      onInputChange={setSearch}
      onSelectionChange={(key) => {
        if (typeof key !== "string") return;
        const ex = results.find((e) => e.id === key);

        if (ex) {
          onPick(ex);
          setSearch("");
        }
      }}
    >
      {(item) => (
        <AutocompleteItem key={item.id} textValue={item.name}>
          {item.name}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/day-editor-exercise-picker.tsx
git commit -m "feat(trainer): DayEditorExercisePicker for adding exercises"
```

---

## Task 12: `DayEditor` — orchestrator with drag-and-drop

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-editor.tsx`

Owns the form state via `useDayEditor`, wires the picker / session swap / DnD reorder / Save / Cancel / Restore actions.

- [ ] **Step 1: Write the orchestrator**

```tsx
"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import type { PrescribedExercise } from "./types";

import { DayEditorExercisePicker } from "./day-editor-exercise-picker";
import { DayEditorRow } from "./day-editor-row";
import { DayEditorSessionPicker } from "./day-editor-session-picker";
import { useDayEditor, type EditorRow } from "./use-day-editor";

function SortableEditorItem({
  id,
  children,
}: {
  id: string;
  children: (p: { dragHandleProps: Record<string, any> }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

interface Props {
  clientId: string;
  scheduledDate: string;
  initialPrescribed: PrescribedExercise[];
  initialSessionId: string | null;
  /** Whether an override row already exists (controls "Restaurar al template" visibility). */
  hasExistingOverride: boolean;
  onClose: () => void;
  /** Called after a successful save or reset so the parent can invalidate cache. */
  onCommitted: () => void;
}

export function DayEditor({
  clientId,
  scheduledDate,
  initialPrescribed,
  initialSessionId,
  hasExistingOverride,
  onClose,
  onCommitted,
}: Props) {
  const editor = useDayEditor({
    clientId,
    scheduledDate,
    initialPrescribed,
    initialSessionId,
    onSaved: () => {
      onCommitted();
      onClose();
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = editor.rows.findIndex((r) => r.key === active.id);
    const newIndex = editor.rows.findIndex((r) => r.key === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(editor.rows, oldIndex, newIndex);

    editor.reorderRows(next);
  };

  const handleSessionPick = (nextSessionId: string) => {
    if (editor.hasChanges) {
      const ok = window.confirm(
        "Cambiar de sesión descartará tus cambios sin guardar. ¿Continuar?"
      );

      if (!ok) return;
    }

    // Pre-fill with the picked session's exercises by re-fetching its
    // session_exercises. We hit the existing programs endpoint to find them.
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/programs`);
        const json = await res.json();

        if (!json.success) return;

        let pickedExercises: PrescribedExercise[] = [];

        for (const program of json.programs ?? []) {
          for (const sess of program.sessions ?? []) {
            if (sess.id === nextSessionId) {
              pickedExercises = (sess.exercises ?? []).map((e: any) => ({
                exerciseId: e.exercise_id ?? e.exerciseId ?? e.id,
                name: e.name,
                category: e.category ?? "strength",
                prescribedSets: e.sets ?? 0,
                prescribedReps: e.reps ?? null,
                prescribedWeightKg: e.weight_kg ?? null,
              }));
              break;
            }
          }
        }

        editor.replaceFromPrescribed(pickedExercises, nextSessionId);
      } catch {
        /* swallow — at worst the editor keeps its current rows */
      }
    })();
  };

  const handleReset = async () => {
    const ok = window.confirm(
      "¿Quitar el plan personalizado de este día? Volverá a usar el template."
    );

    if (!ok) return;

    await editor.reset();
  };

  const showRestore = hasExistingOverride;

  return (
    <section className="rounded-lg border-2 border-blue-300 bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50/40 border-b border-blue-200 flex-wrap">
        <div className="flex items-center gap-2">
          <DayEditorSessionPicker
            clientId={clientId}
            disabled={editor.saving || editor.resetting}
            value={editor.sessionId}
            onSelect={handleSessionPick}
          />
        </div>

        <div className="flex items-center gap-2">
          {showRestore ? (
            <Button
              isDisabled={editor.saving || editor.resetting}
              isLoading={editor.resetting}
              size="sm"
              variant="flat"
              onPress={handleReset}
            >
              Restaurar al template
            </Button>
          ) : null}
          <Button
            isDisabled={editor.saving || editor.resetting}
            size="sm"
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={
              !editor.isValid ||
              !editor.hasChanges ||
              editor.saving ||
              editor.resetting
            }
            isLoading={editor.saving}
            size="sm"
            onPress={() => {
              void editor.save();
            }}
          >
            Guardar
          </Button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-3">
        <p className="text-[11px] text-blue-700 inline-flex items-center gap-1">
          <Icon icon="solar:info-circle-linear" width={12} />
          Editando — los cambios se aplicarán solo al {scheduledDate}.
        </p>

        {editor.error ? (
          <div className="text-[11px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-2 py-1">
            {editor.error}
          </div>
        ) : null}

        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={editor.rows.map((r) => r.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {editor.rows.map((row: EditorRow) => (
                <SortableEditorItem key={row.key} id={row.key}>
                  {({ dragHandleProps }) => (
                    <DayEditorRow
                      disabled={editor.saving || editor.resetting}
                      dragHandleProps={dragHandleProps}
                      row={row}
                      onChange={(patch) => editor.updateRow(row.key, patch)}
                      onRemove={() => editor.removeRow(row.key)}
                    />
                  )}
                </SortableEditorItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {editor.rows.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Sin ejercicios. Añade uno para empezar.
          </p>
        ) : null}

        <DayEditorExercisePicker
          disabled={editor.saving || editor.resetting}
          onPick={editor.addRow}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/day-editor.tsx
git commit -m "feat(trainer): DayEditor inline orchestrator with drag-reorder"
```

---

## Task 13: `DayDetail` integration — pencil button + mode toggle

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx`
- Modify: `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx`

DayDetail gains an `editable` prop (whether pencil is enabled), a `mode` state, and renders `<DayEditor />` when in edit mode. MetricsSection passes the editable boolean and an `onCommitted` that flushes the cache via `useWeekMetrics.invalidate`.

- [ ] **Step 1: Update `DayDetail` Props**

In `day-detail.tsx`, change the `Props` interface:

```ts
interface Props {
  clientId: string;
  day: DayMetrics;
  orphanLogs: ExerciseLog[];
  /** True when editor entry is allowed (today/future, or past with no logs). */
  editable: boolean;
  /** Called after a successful save / reset so MetricsSection can refetch. */
  onCommitted: () => void;
  onPlayVideo?: ((url: string, name: string) => void) | undefined;
}
```

Inside the `DayDetail` component body, add mode state at the top:

```tsx
const [mode, setMode] = useState<"read" | "edit">("read");

// Whether an explicit per-date override exists today.
const hasExistingOverride =
  (day.scheduledSession?.override_exercises?.length ?? 0) > 0;
```

(`useState` import: ensure it's already in the imports list at the top of the file.)

- [ ] **Step 2: Add the pencil button to the header in read mode**

Find the existing read-mode header (`<header className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">`). Wrap its content in a flex row that includes the pencil button on the right:

```tsx
<header className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
  <div className="flex items-center justify-between gap-2">
    <p className="text-sm font-semibold text-gray-900 capitalize">
      {formatDateLong(day.date)}
      {day.scheduledSession?.session
        ? ` · ${day.scheduledSession.session.name}`
        : ""}
    </p>
    <button
      aria-label={`Editar día ${day.date}`}
      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      disabled={!editable}
      title={
        editable ? "Editar día" : "Día con registros — solo lectura"
      }
      type="button"
      onClick={() => setMode("edit")}
    >
      <Icon icon="solar:pen-linear" width={16} />
    </button>
  </div>
  {/* Existing future / KPI block stays right below */}
  {showFuture ? (
    /* ...existing future markup... */
  ) : (
    /* ...existing KPI grid markup... */
  )}
</header>
```

- [ ] **Step 3: Render `<DayEditor />` when `mode === "edit"`**

Right after the rest day early-return block, add a guard for edit mode. Place this _before_ the regular `<section>` return:

```tsx
if (mode === "edit") {
  return (
    <DayEditor
      clientId={clientId}
      hasExistingOverride={hasExistingOverride}
      initialPrescribed={day.prescribed}
      initialSessionId={day.scheduledSession?.session?.id ?? null}
      scheduledDate={day.date}
      onClose={() => setMode("read")}
      onCommitted={onCommitted}
    />
  );
}
```

Add the imports at the top of the file:

```ts
import { useState } from "react";
import { DayEditor } from "./day-editor";
```

- [ ] **Step 4: Compute `editable` in `MetricsSection` and pass through**

In `metrics-section.tsx`, find the `<DayDetail …/>` call. Replace it with:

```tsx
<DayDetail
  clientId={clientId}
  day={selectedDay}
  editable={
    !selectedDay.isFuture
      ? selectedDay.adherence.completedExercises === 0 || !selectedDay.isFuture
      : true
  }
  // The simpler intent: editable = future || today || past-without-logs.
  // Past-without-logs is when adherence.completedExercises === 0 on a past day.
  onCommitted={() => invalidate(getLocalYmd(weekStart))}
  onPlayVideo={openVideo}
  orphanLogs={data.orphansByDate.get(selectedDate) ?? []}
/>
```

Replace the inline editable expression with a clean computation above the JSX:

```tsx
const todayYmd = useMemo(() => getLocalYmd(new Date()), []);

const isPast = selectedDay && selectedDay.date < todayYmd;
const editable = !!selectedDay && (!isPast || selectedDay.logs.length === 0);
```

Then in the JSX, just `editable={editable}`.

Also destructure `invalidate` from the hook usage:

```tsx
const { data, loading, error, refetch, invalidate } = useWeekMetrics(
  clientId,
  weekStart
);
```

- [ ] **Step 5: Type-check + lint**

```bash
npm run type-check
npm run lint:check 2>&1 | grep -E "day-detail|metrics-section|day-editor" || true
```

Expected: clean.

- [ ] **Step 6: Browser verification — happy path**

```bash
npm run dev
```

Open the trainer dashboard → client → Microciclo → Métricas. Click any day with a prescription. Verify:

1. Pencil button visible in the day header.
2. Click pencil → editor takes over: blue ring, session dropdown, exercise rows with editable inputs.
3. Edit a sets value → Save button enables.
4. Hit Save → spinner → editor closes → strip + day detail refresh and reflect the new value.
5. Click pencil again → "Restaurar al template" button now visible.
6. Hit Restaurar → confirm → returns to template values.
7. Add an exercise via the picker → row appears at the end.
8. Drag the new row to position 1 → order updates.
9. Delete a row → row disappears.
10. Cancel → discards all edits, returns to read mode.

- [ ] **Step 7: Browser verification — edge cases**

11. Navigate to a past date with no logs → pencil enabled.
12. Navigate to a past date with logs → pencil disabled, tooltip shows.
13. Navigate to a future date with prescription → pencil enabled.
14. Open editor, change session in dropdown without unsaved changes → exercises repopulate from new session.
15. Open editor, edit a value, then change session → confirm dialog appears.
16. Force a 409 (manually log via the cliente app on a past day, then try editing past) → inline danger banner with "Día con registros".
17. Force a network error (offline DevTools) → inline error banner; Save can be retried after reconnect.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/day-detail.tsx \
        components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx
git commit -m "feat(trainer): wire DayEditor into DayDetail with pencil toggle"
```

---

## Task 14: Client endpoint — resolved prescription per date

**Files:**

- Create: `app/api/client/scheduled-sessions/[date]/route.ts`

Client-auth endpoint that returns the resolved prescription for one date with the same precedence as the trainer side.

This task makes the override data available to the client app. Updating the client app's UI to consume this endpoint is out of scope for this plan — the client team can switch over once this endpoint exists. The endpoint mirrors the trainer side's read precedence so behaviour is identical.

- [ ] **Step 1: Write the route**

```ts
// GET /api/client/scheduled-sessions/[date]
// Returns the resolved prescription for one date applying the override
// precedence: scheduled_session_exercises → session.session_exercises →
// microcycle template. Used by the client app when opening a workout for
// a specific date.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadAllActiveOwnedPrograms,
  loadMicrocycleWithSlots,
} from "@/lib/microcycles/db";

const LOG_PREFIX = "[Client Scheduled Session API]";

interface ResolvedExercise {
  exercise_id: string;
  name: string;
  category: string;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

interface ResolvedDay {
  date: string;
  source: "override" | "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function diffDays(fromYmd: string, toYmd: string): number {
  const from = new Date(fromYmd + "T00:00:00").getTime();
  const to = new Date(toYmd + "T00:00:00").getTime();

  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { date } = await params;

    if (!isYmd(date)) {
      return NextResponse.json(
        { success: false, error: "date inválido" },
        { status: 400 }
      );
    }

    const clientId = String(session.client_id);

    // 1. Real scheduled_sessions row for this date (with override + template).
    const { data: ssRow } = await supabase
      .from("scheduled_sessions")
      .select(
        `id,
         session:sessions(id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes,
             exercise:exercises(id, name, category)
           )
         ),
         override_exercises:scheduled_session_exercises(
           id, exercise_order, sets, reps, weight_kg,
           duration_seconds, distance_meters, rest_seconds, notes,
           exercise:exercises(id, name, category)
         )`
      )
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .maybeSingle();

    if (ssRow) {
      const overrides = (ssRow.override_exercises ?? []) as any[];

      if (overrides.length > 0) {
        return NextResponse.json({
          success: true,
          day: makeResolvedDay(
            date,
            "override",
            ssRow.session as any,
            overrides
          ),
        });
      }

      const sessionRow = ssRow.session as any;
      const sessExercises = (sessionRow?.session_exercises ?? []) as any[];

      return NextResponse.json({
        success: true,
        day: makeResolvedDay(date, "session", sessionRow, sessExercises),
      });
    }

    // 2. No real row — derive from microcycle template.
    const programs = await loadAllActiveOwnedPrograms(
      supabase,
      clientId,
      null,
      correlationId
    );

    for (const program of programs) {
      if (!program.start_date) continue;
      const microcycle = await loadMicrocycleWithSlots(
        supabase,
        program.id,
        correlationId
      );

      if (!microcycle) continue;
      if (date < program.start_date) continue;

      const offset = diffDays(program.start_date, date);
      const dayIndex = (offset % microcycle.duration_days) + 1;
      const slot = microcycle.slots.find((s) => s.day_index === dayIndex);

      if (!slot?.session_id) continue;

      const { data: sessionDetail } = await supabase
        .from("sessions")
        .select(
          `id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             duration_seconds, distance_meters, rest_seconds, notes,
             exercise:exercises(id, name, category)
           )`
        )
        .eq("id", slot.session_id)
        .maybeSingle();

      if (!sessionDetail) continue;

      return NextResponse.json({
        success: true,
        day: makeResolvedDay(
          date,
          "template",
          sessionDetail as any,
          ((sessionDetail as any).session_exercises ?? []) as any[]
        ),
      });
    }

    // 3. No prescription at all → rest day.
    return NextResponse.json({
      success: true,
      day: {
        date,
        source: "rest",
        session: null,
        exercises: [],
      } satisfies ResolvedDay,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function makeResolvedDay(
  date: string,
  source: ResolvedDay["source"],
  session: { id: string; name: string } | null,
  raws: Array<{
    exercise_order: number;
    sets: number | null;
    reps: string | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    rest_seconds: number | null;
    notes: string | null;
    exercise: { id: string; name: string; category: string };
  }>
): ResolvedDay {
  const exercises = [...raws]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((r) => ({
      exercise_id: r.exercise.id,
      name: r.exercise.name,
      category: r.exercise.category,
      exercise_order: r.exercise_order,
      sets: r.sets,
      reps: r.reps,
      weight_kg: r.weight_kg,
      duration_seconds: r.duration_seconds,
      distance_meters: r.distance_meters,
      rest_seconds: r.rest_seconds,
      notes: r.notes,
    }));

  return {
    date,
    source,
    session: session ? { id: session.id, name: session.name } : null,
    exercises,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: clean. (Casts via `as any` are intentional — Supabase's nested-join inference treats single foreign-key joins as arrays in TS.)

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

In another terminal with a valid client session cookie:

```bash
curl --cookie "client-session=<JWT>" \
  "http://localhost:3000/api/client/scheduled-sessions/2026-05-20" | jq .
```

Verify three cases:

1. A date with a saved override → `source: "override"` and exercises match what the trainer saved.
2. A date the trainer hasn't touched but is in the microcycle template → `source: "template"` and exercises match the slot's session.
3. A date that's a rest in the template → `source: "rest"` with empty exercises.

- [ ] **Step 4: Commit**

```bash
git add "app/api/client/scheduled-sessions/[date]/route.ts"
git commit -m "feat(api): client resolved prescription endpoint with override precedence"
```

---

## Final manual QA

- [ ] **End-to-end Phase 3 walkthrough**

Pick a real client with an active microcycle. From the trainer side:

1. Navigate to Métricas → click a future date → pencil enabled → edit.
2. Save with a tweaked sets value → strip refreshes → day shows new value.
3. Reopen editor → "Restaurar al template" appears → click → confirm → values revert.
4. Open editor on a future date → swap session via dropdown → confirm exercises repopulate from new session → tweak something → save.
5. Verify `/api/client/scheduled-sessions/<date>` returns `source: "override"` with the saved data.
6. Verify the trainer's metrics adherence updates correctly when overrides change the prescribed totals.
7. Negative case: log on a past date as the cliente, then try to edit that date as trainer → pencil disabled.

If anything fails, fix it inline before declaring Phase 3 done.

---

## Self-Review Notes

**Spec coverage:**

- Override table → Task 1.
- Read precedence (override → session → template) → Task 5 + Task 6 (toPrescribed) + Task 14.
- Save = delete + full insert → Task 3.
- Reset to template → Task 4.
- Lock check (past + logs → 409) → Task 3 + Task 4.
- Modified trainer GET → Task 5.
- Hook + invalidate → Task 6.
- Inline editor → Tasks 8–13.
- Session swap dropdown → Task 10.
- Add exercise via library → Task 11.
- Drag-reorder → Task 12 (uses @dnd-kit).
- Delete row → Task 9 (button) + Task 12 (wired).
- Restore-to-template button → Task 12.
- Cache invalidation after save → Task 13 step 4.
- Client endpoint → Task 14.
- Empty exercises = custom rest → handled implicitly (PUT accepts `exercises: []`).

**No placeholders.** All code blocks are complete; the plan never says "implement later". Tasks 7 and 11 hit the existing `/api/exercises` and `/api/clients/[clientId]/programs` endpoints (no new dependencies).

**Type consistency:**

- `EditorRow`, `OverrideExerciseRow`, `PrescribedExercise` shapes consistent across hook, components, and types module.
- `useDayEditor` exposes `save()` and `reset()` returning `{ ok, locked? }` consistently called by `DayEditor` and DayDetail wiring.
- `useWeekMetrics` adds `invalidate(weekStartYmd?)` consistently consumed in `metrics-section.tsx`.
- API field names: `weightKg` in body / `weight_kg` in DB — translation done explicitly in Task 3 and Task 8.

**Out of scope (per spec):**

- Bulk operations.
- Template propagation to existing overrides.
- Custom session names per date.
- Multi-program override per date.
- Override-vs-template diff visualization.
- Push notifications.
- Audit log of changes.
- Client-app UI consumption of the new endpoint (data layer only — UI integration is a follow-up).
