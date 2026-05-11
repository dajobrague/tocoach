# Dated Prescriptions — Design Spec (Phase 3)

**Status:** Approved 2026-05-11 — ready for implementation plan.

## Goal

Let the trainer override the microcycle template for a specific date — change the assigned session, edit prescribed sets/reps/weight per exercise, and add or remove exercises — without affecting any other date or the template itself. The client app sees overrides automatically.

This is Phase 3 of the trainer progress merge (see `2026-05-11-trainer-progress-merge.md` and the Phase 2 metrics spec). Phase 2 surfaced metrics by date; Phase 3 makes the underlying prescription editable per date.

## Architecture

A new "scheduled session override" concept layers on top of the existing template. The microcycle template still defines the recurring weekly pattern; when the trainer creates an override for a date, that override wins for read; otherwise the template applies as before.

### Read precedence (trainer + client share the same logic)

For each date in a query range:

```
if scheduled_session_exercises rows exist for the date's scheduled_session
    → use those (full per-date override)
else if scheduled_sessions row exists with a session_id
    → use session.session_exercises (template, possibly with a swapped session_id)
else
    → derive from microcycle template (Phase 2 fallback)
```

### Write semantics

Every Save in the editor performs **delete + full insert** on `scheduled_session_exercises` for that day. The table always represents the complete plan for the day when present — never partial diffs. This invariant kills any ambiguity between "edited" and "inherited from template".

### Coexistence with existing systems

- `microcycles` and `microcycle_slots` are unchanged. The slot editor (Configuración sub-tab) keeps its current behaviour.
- `sessions` and `session_exercises` are unchanged. The trainer's program editor still writes to `session_exercises` as today.
- Phase 2's `useWeekMetrics` hook and the trainer schedule endpoint are extended to read overrides; their fallback chain remains intact.
- Client app gets a new (or extended) endpoint that reads overrides and falls back to template.

Phase 3 is strictly additive: a date with no override behaves exactly like Phase 2.

## Data Model

### New table: `scheduled_session_exercises`

```sql
CREATE TABLE scheduled_session_exercises (
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

CREATE INDEX idx_scheduled_session_exercises_session
  ON scheduled_session_exercises(scheduled_session_id);

ALTER TABLE scheduled_session_exercises ENABLE ROW LEVEL SECURITY;
-- RLS policy mirrors the project's pattern for session_exercises (anon-permissive
-- with app-side validation, as in migration 076 / 091).
```

### Unchanged tables

- `scheduled_sessions` keeps its current schema. `session_id` stays nullable and serves as the "label source" for the day (template session, swapped session, or null for fully custom).
- `session_exercises`, `microcycles`, `microcycle_slots` untouched.

### Edit lock semantics

- Future + today: always editable.
- Past with no `exercise_logs` for the date: editable.
- Past with `exercise_logs`: locked — the API returns 409 Conflict and the UI hides the editor entry point.

## API Surface

### NEW · `PUT /api/clients/[clientId]/scheduled-sessions/trainer/day`

Trainer save of a per-date override.

**Body:**

```ts
{
  scheduledDate: string; // YYYY-MM-DD
  sessionId: string | null; // session label (template/swapped/null)
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
```

**Pipeline:**

1. Validate trainer session and `client.tenant === session.trainer_id`.
2. **Lock check:** if `scheduledDate < today`, query for any `exercise_logs` joined to `scheduled_sessions` on this `(client_id, scheduled_date)`. If any → 409 Conflict.
3. Validate exercise_ids exist and belong to the trainer's tenant.
4. Validate `sessionId` (when given) belongs to the trainer's tenant.
5. Validate `exerciseOrder` is unique within the payload.
6. Upsert `scheduled_sessions` row keyed on `(client_id, scheduled_date)` with the given `session_id`, `status='scheduled'`.
7. `DELETE` all `scheduled_session_exercises` for that scheduled_session_id.
8. `INSERT` all rows from the body in a single statement.
9. Return `{ success: true, scheduledSessionId }`.

### NEW · `DELETE /api/clients/[clientId]/scheduled-sessions/trainer/day?date=YYYY-MM-DD`

Trainer reset to template — removes the override for a date.

**Pipeline:**

1. Auth + tenant check.
2. Lock check.
3. Find the `scheduled_sessions` row for this date.
4. If `exercise_logs` exist for it (defensive — lock check should have caught past-with-logs): delete only `scheduled_session_exercises` rows; keep `scheduled_sessions` so logs stay referenced.
5. Otherwise: delete `scheduled_sessions` row → cascade drops `scheduled_session_exercises`.
6. Return `{ success: true }`.

### MODIFIED · `GET /api/clients/[clientId]/scheduled-sessions/trainer`

Phase 2 endpoint now also returns overrides:

```sql
SELECT
  scheduled_sessions.*,
  session:sessions(id, name, session_exercises(...)),
  override_exercises:scheduled_session_exercises(
    id, exercise_order, sets, reps, weight_kg,
    duration_seconds, distance_meters, rest_seconds, notes,
    exercise:exercises(id, name, category)
  )
```

Mapping in `materializeTemplate`:

```
for each scheduled_session row:
  if override_exercises has rows
      → use those as the date's prescription
  else if session has session_exercises
      → use those
  else
      → fall through to microcycle template
```

The Phase 2 microcycle-template fallback path stays identical for dates without a `scheduled_sessions` row.

### NEW · `GET /api/client/scheduled-sessions/[date]` (or extension of existing client endpoint)

Client-auth endpoint that returns the resolved prescription for one date with the same precedence (override → session_exercises → microcycle template).

**Implementation note:** at plan time, audit existing client endpoints first. If `/api/client/microcycle` or a session-detail endpoint already serves the same purpose, extend it instead of adding a new route.

### Server-side validation rules (applied to both PUT and DELETE)

- All `exerciseId`s exist in `exercises` table and `exercises.tenant_host === client.tenant_host`.
- `exerciseOrder` is a unique positive integer within the payload.
- `sessionId`, when provided, exists in `sessions` and belongs to the client's tenant.
- `sets > 0` if provided. `weightKg >= 0` if provided. `reps` non-empty string if provided.
- `exercises` array can be empty (means "custom rest day for this date").

### Cache invalidation

After a successful PUT or DELETE the editor calls `useWeekMetrics.invalidate(weekStartYmd)` (new method on the hook) which removes the cache entry and triggers a refetch. The new override appears in metrics within one tick.

## UI

### DayDetail gains an edit mode

Same component, two modes — `read` (Phase 2) and `edit` (new). A pencil button in the header toggles. State lives in DayDetail.

### Read mode (no visual change from Phase 2)

Header carries the new pencil button on the right, next to the date. The pencil is:

- **Active** when the day is editable (future / today / past-without-logs).
- **Disabled with tooltip** "Día con registros — solo lectura" when past + has logs.
- **Hidden** when the day is a rest day (`classification === "rest"`).

### Edit mode

Header swaps to: date + session selector dropdown + Cancel/Save buttons. A blue ring or border on the section communicates "editing".

Body becomes a list of editable rows, each with: drag handle, exercise name (read-only), sets/reps/weight inputs, delete button. An "Añadir ejercicio" button below opens an exercise picker.

A "Restaurar al template" button is visible only when a `scheduled_session_exercises` override already exists for this date — calls the DELETE endpoint.

### Components (all new under `microcycle/`)

| File                             | Responsibility                                                            | Approx. lines |
| -------------------------------- | ------------------------------------------------------------------------- | ------------- |
| `day-editor.tsx`                 | Edit-mode body. Form state, save/cancel/restore wiring.                   | ~250          |
| `day-editor-row.tsx`             | One editable exercise row. Drag handle + inputs + delete.                 | ~80           |
| `day-editor-session-picker.tsx`  | Dropdown for session swap.                                                | ~60           |
| `day-editor-exercise-picker.tsx` | Autocomplete for "añadir ejercicio". Reuses workouts-tab library pattern. | ~100          |
| `use-day-editor.ts`              | Form state, validation, save / delete mutations.                          | ~150          |
| `use-trainer-sessions.ts`        | Fetches available sessions for the picker; small in-memory cache.         | ~60           |

### Modified

- `day-detail.tsx` — add `mode: "read" \| "edit"` state and the pencil button. When edit mode, render `<DayEditor />` instead of the read body.
- `use-week-metrics.ts` — expose an `invalidate(weekStartYmd)` method so the editor can flush its week's cache after a successful save.

### Behaviour details

- **Entering edit:** `DayEditor` receives the current resolved `prescribed` list and copies it into local form state.
- **Cancel:** discards local edits, returns to read mode.
- **Save:** validates form, fires PUT, on success invalidates cache + returns to read mode showing the now-applied override.
- **Session swap:** changing the dropdown re-populates the form with the new session's `session_exercises`. If there are pending edits, `window.confirm` warns first.
- **Reorder:** `@dnd-kit` (already in the project). Reassign `exerciseOrder` when the user drops.
- **Add exercise:** the picker is an inline autocomplete that lists exercises from the trainer's library; selecting one appends it with empty values.
- **Delete exercise:** removes the row locally, no confirmation (Cancel is the undo).
- **Restore to template:** confirm with `window.confirm` "¿Quitar el plan personalizado de este día?" then DELETE.

### Loading + error states

- **Save in flight:** Save button shows spinner; form inputs disabled.
- **409 from PUT:** inline banner "No se puede editar — el día tiene registros".
- **Network error:** banner "No se pudo guardar — Reintentar" with retry.
- **Loading sessions for the dropdown:** the dropdown shows a spinner placeholder; user can still type/edit other rows.

### Form validation (client-side)

- `sets`: integer > 0 or empty.
- `reps`: non-empty when `sets > 0`.
- `weightKg`: number >= 0 or empty.
- Save disabled when form invalid OR no changes detected.

### Responsive

- `<sm`: inputs stack full-width within each row, save/cancel sticky at the top of the editor section.
- iframe context: header buttons remain reachable; no horizontal overflow.

### Accessibility

- All inputs have visible labels (or aria-label when label is icon-only).
- Save button has explicit text.
- Pencil button has descriptive aria-label "Editar día YYYY-MM-DD".
- Disabled state on pencil includes aria-disabled and tooltip via title.
- Reorder via drag is paired with keyboard alternative (arrow keys move row up/down when handle is focused) — `@dnd-kit` supports this out of the box.

## Edge Cases (explicit)

- **Override on a date the cliente already logged (race):** lock check at PUT time prevents this; if logs landed between editor open and Save, return 409 and instruct user to reload.
- **Override with empty exercises:** allowed — interpreted as "custom rest" for this date. The metrics view shows it as descanso.
- **Exercise removed from library after override exists:** ON DELETE CASCADE on `exercise_id` removes the row from `scheduled_session_exercises`. The day's prescription loses that exercise gracefully; rest of the override is preserved.
- **Microcycle template later changed:** dated overrides are independent of the template — they survive any template edit. Phase 3 explicitly does NOT propagate template changes to existing overrides.
- **Trainer creates override on a date that microcycle classifies as rest:** allowed. The override creates a `scheduled_sessions` row + exercises; the day stops being a rest day for that date only.
- **Multiple programs (strength + cardio) on the same date:** today's microcycle materialization picks the first program by `start_date desc`. Same rule applies in Phase 3 — the override is for that single program's session. Multi-program days remain a future scope item.

## Scope

### In

- New `scheduled_session_exercises` table + migration.
- PUT and DELETE endpoints for trainer day overrides with full validation + lock check.
- Modified trainer schedule endpoint that surfaces overrides.
- New (or extended) client endpoint that surfaces overrides.
- Inline edit mode in `DayDetail` with session swap, add/remove, reorder, value editing.
- Cache invalidation hook for `useWeekMetrics`.
- Form validation + loading + error states.
- Keyboard / a11y support for the editor.

### Out

- Bulk operations (apply override to multiple dates at once).
- Template-level edits propagating to past overrides.
- Custom session names per date (free-text label distinct from any template session).
- Multi-program override on the same date.
- Diff visualization (template vs override) — out of scope for Phase 3.
- Push notifications to client when an override is saved.
- Audit log of who/when an override changed (relies on `updated_at` only).
- Client-app UX for showing "this is an override" indicator visually (cliente sees the values; differentiation from template is not required).

## Implementation Sequencing (preview)

The plan will likely sequence as: migration → API endpoints (PUT, DELETE, modified GET) → editor hooks → editor components → DayDetail integration → cache invalidation → client endpoint update → end-to-end QA.

## Open Implementation Questions

1. **Client endpoint shape**: at plan time, audit `/api/client/microcycle`, `/api/client/sessions`, `/api/client/exercises/[id]/history` to decide whether to extend or add a route for the resolved-by-date prescription.
2. **Exercise library RLS**: confirm that the trainer endpoint can SELECT from `exercises` filtered by `tenant_host`. The picker reuses the existing autocomplete pattern from workouts-tab.
3. **Optimistic update granularity**: simplest is a full week refetch after save. If perceptible latency appears, switch to optimistic patch of the cached week + background reconcile.

---

**Approved by:** David Bracho · 2026-05-11.
**Next step:** writing-plans skill to produce the task-by-task implementation plan.
