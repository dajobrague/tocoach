# Fix: Exercise logs falsely showing "done" — per-slot attribution

> Execute subagent-driven. Gate per unit: `npm run type-check` (only the 2 untracked nutrition specs may error) + `npm run lint:check` clean on touched files. No automated test runner; final manual smoke.

**Bug (Carlos Torres, prod):** In the CLIENT app, an exercise shows "Hecho"/done before the client does it. **Root cause:** logs are attributed to a planned exercise by `exercise_id` alone. That was unique-per-slot before; the library-selector change makes the same `exercise_id` legitimately reused across slots/sessions/days, so one log fans out to every occurrence. Regression from the library work.

**Decision (user 2026-06-08):** Thorough fix — add `session_exercise_id` to `exercise_logs` (precise per-slot attribution) AND session-scope the reads. Fixes cross-session bleed and the same-exercise-twice-in-one-session case.

**Branch:** `fix/exercise-log-slot-attribution` (off `main`).

**Key facts (verified):**

- `exercise_logs` has `scheduled_session_id` (nullable), `exercise_id` (NOT NULL), `training_date`, `finalized_at` — **no** `session_exercise_id`.
- Single writer: `app/api/clients/[clientId]/exercise-logs/route.ts` POST — manual SELECT-then-update/insert; dedup key `(scheduled_session_id, exercise_id, client_id)`; no DB unique constraint.
- Slot id availability client-side: template path → `WorkoutExercise.id` (= `session_exercises.id`); resolved path → server fetches `session_exercises(id,…)` but `makeResolvedDay` drops it and `ResolvedExercise` lacks it.
- Read feeds (`exercise-logs/route.ts` GET + `exercise-logs/trainer/route.ts` GET) use `select("*")` + `...log` spread → new column auto-flows, **no change needed**.
- Backfill path: `exercise_logs.scheduled_session_id → scheduled_sessions.session_id → session_exercises (match exercise_id)`; assign only when exactly one slot matches.

---

## Unit 1 — Migration: add `session_exercise_id` + backfill

**File:** `supabase/migrations/<next-number>_add_session_exercise_id_to_exercise_logs.sql`

- [ ] Add a nullable column + FK + index:

```sql
ALTER TABLE public.exercise_logs
  ADD COLUMN IF NOT EXISTS session_exercise_id uuid;

ALTER TABLE public.exercise_logs
  ADD CONSTRAINT exercise_logs_session_exercise_id_fkey
  FOREIGN KEY (session_exercise_id)
  REFERENCES public.session_exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_exercise_id
  ON public.exercise_logs(session_exercise_id);

COMMENT ON COLUMN public.exercise_logs.session_exercise_id IS
  'The specific planned slot (session_exercises.id) this log was recorded against. NULL for legacy logs or when the slot was ambiguous/deleted; readers fall back to exercise_id matching.';
```

- [ ] Backfill ONLY unambiguous logs (exactly one matching slot in the log''s session):

```sql
UPDATE public.exercise_logs el
SET session_exercise_id = se.id
FROM public.scheduled_sessions ss
JOIN public.session_exercises se
  ON se.session_id = ss.session_id
WHERE el.session_exercise_id IS NULL
  AND el.scheduled_session_id = ss.id
  AND se.exercise_id = el.exercise_id
  AND (
    SELECT count(*) FROM public.session_exercises se2
    WHERE se2.session_id = ss.session_id
      AND se2.exercise_id = el.exercise_id
  ) = 1;
```

- [ ] Verify against local/dev DB if available (`\d exercise_logs` shows the column; spot-check backfill counts). If no local DB, note the migration ships to deploy. Determine `<next-number>` from the highest existing prefix in `supabase/migrations/`.
- [ ] Commit: `feat(training): add session_exercise_id to exercise_logs (migration + backfill)`.

---

## Unit 2 — Plumb the slot id into the log write

**Files:** `app/api/client/scheduled-sessions/[date]/route.ts`, `components/client-dashboard/workouts/hooks/use-resolved-day-prescription.ts`, `components/client-dashboard/workouts/active-session-view.tsx`, `components/client-dashboard/workouts/workouts-content.tsx`, `components/client-dashboard/exercise-log/exercise-log-modal.tsx`, `app/api/clients/[clientId]/exercise-logs/route.ts`.

- [ ] **Resolved feed:** in `makeResolvedDay` (scheduled-sessions/[date] route), add `id` to the `raws` type and emit `session_exercise_id: raw.id` on each resolved exercise (the select already fetches `session_exercises(id,…)`). Add `session_exercise_id: string | null` to `ResolvedExercise` (use-resolved-day-prescription.ts).
- [ ] **ExerciseLike (active-session-view):** add `session_exercise_id?: string` to the `ExerciseLike` interface. In `toExerciseLike`, map `r.session_exercise_id`. In `findExercisesForSession` (template path), the `WorkoutExercise.id` IS the slot id — normalize so each exercise in `allExercises` exposes `session_exercise_id` (set it from `we.id` for template-path items). Goal: every exercise object passed to `onLogExercise` carries `session_exercise_id` when known.
- [ ] **workouts-content.tsx:** where it derives `exerciseId` from `selectedExercise.exercise.exercise_id`, also derive `sessionExerciseId` from `selectedExercise.exercise.session_exercise_id` and pass it to the modal.
- [ ] **exercise-log-modal.tsx:** add a `sessionExerciseId?: string | null` prop; include `sessionExerciseId` in `buildRequestBody`.
- [ ] **POST route (`exercise-logs/route.ts`):** destructure `sessionExerciseId` from the body. Add `session_exercise_id: sessionExerciseId ?? null` to `logData`. **Update the dedup lookup** (the `.eq("scheduled_session_id",…).eq("exercise_id",…).eq("client_id",…).maybeSingle()`): when `sessionExerciseId` is provided, add `.eq("session_exercise_id", sessionExerciseId)` so autosave+finalize update the SAME slot row and two slots of the same exercise get separate rows. (When absent — legacy clients — keep the old 3-key lookup.)
- [ ] Verify type-check + lint. Commit: `feat(training): record session_exercise_id when a client logs an exercise`.

---

## Unit 3 — Slot-aware "done" attribution (the actual fix)

**Files:** `components/client-dashboard/workouts/active-session-view.tsx` (C1, client — the reported surface), `components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs.ts` + `workouts-tab.tsx` (T1, trainer).

Attribution rule (use everywhere): a finalized log L marks planned slot S as done when:

- `L.session_exercise_id === S.session_exercise_id` (precise, new logs), **OR**
- `L.session_exercise_id == null` AND `L.exercise_id === S.exercise_id` (legacy fallback). For the client view, additionally require the legacy fallback to be session-scoped (`L.session_id == null || L.session_id === session.id`) to avoid cross-session bleed from legacy logs.

- [ ] **C1 — active-session-view.tsx:** rework `finalizedIds`/per-row `existingLog` (lines ~164-265). Match by `session_exercise_id` first, falling back to exercise_id (null-slot, session-scoped) per the rule. Each rendered planned exercise has `session_exercise_id` (Unit 2); the extra/off-plan logged exercises keep exercise_id matching. Recompute `completed`/`total` so "X de Y hechos" reflects per-slot done.
- [ ] **T1 — use-client-exercise-logs.ts + workouts-tab.tsx:** add a slot-aware accessor (e.g. `getLogsForSlot(sessionExerciseId, exerciseId)`) that returns logs where `session_exercise_id === sessionExerciseId`, falling back to the `exercise_id`-keyed map for legacy null-slot logs. In `workouts-tab.tsx` line ~1533, pass the slot id (`exercise.id`) so `ExerciseProgressCard` shows per-slot history. Keep `getLogsForExercise` for the orphan/off-plan section (it's correct there). Keep the swap-warning using exercise_id (it asks "any log for this library exercise" — correct as-is, or tighten to slot if trivial).
- [ ] Verify type-check + lint. Commit: `fix(training): attribute exercise logs to the specific planned slot`.

---

## Unit 4 — Verify + manual smoke

- [ ] `npm run type-check` clean (only 2 nutrition specs); `npm run lint:check` clean (pre-existing only).
- [ ] Manual smoke (user): build a client program where the SAME exercise appears in two sessions (or twice in one session). Client logs it in ONE place → the OTHER occurrence must show NOT done. Trainer view: the other slot must NOT show phantom history. Confirm autosave→finalize on one slot updates one row. Confirm a legacy client (no slot id sent) still records + displays correctly.
- [ ] Note: applying the migration to prod is a deploy step (out of band).

## Out of scope

- `maybeMarkScheduledCompleted` session-completion heuristic (separate refinement).
- The `scheduled_sessions!inner` feed dropping null-`scheduled_session_id` logs (pre-existing, separate).
