# Microciclo Metrics — Design Spec

**Status:** Approved 2026-05-11 — ready for implementation plan.

## Goal

Give the trainer a per-date view of execution and adherence inside the Microciclo tab, without disrupting the existing slot-based microcycle editor. The trainer should be able to answer "what did my client do this week, and how does it compare to what I prescribed" in one screen.

This is Phase 2 of the trainer progress merge (see `2026-05-11-trainer-progress-merge.md`). Phase 1 delivered per-exercise progress cards inside Entrenamientos/Cardio and removed the standalone Progress tab. Phase 2 adds the date-based view inside Microciclo.

## Architecture

The Microciclo tab becomes a two-section tab using the same segmented-control pattern that already groups Microciclo / Entrenamientos / Cardio in `training-tabs.tsx`:

- **Métricas** (default sub-tab) — the new view.
- **Configuración** (secondary sub-tab) — the existing `MicrocycleConfig` slot editor, untouched.

Default is Métricas because it's the daily-use surface; Configuración is occasional. The existing `MicrocycleConfig` component is rendered unchanged inside Configuración — no refactor of the slot editor.

## File Structure

### New components

```
components/dashboard/client-profile/tabs/microcycle/
├── metrics-section.tsx        Orchestrator: holds week + day state, mounts children
├── use-week-metrics.ts        Hook: parallel fetch of scheduled_sessions + exercise_logs
├── week-navigator.tsx         Prev/Next/Today + clickable week label (opens calendar popover)
├── week-strip.tsx             7-day grid with adherence symbol + % per cell
├── day-detail.tsx             Inline drill-down: prescribed vs executed per exercise
└── adherence.ts               Pure compute: ejercicios %, series %, carga %
```

### Modified

```
components/dashboard/client-profile/tabs/microcycle-tab.tsx
                              Two sub-tabs (Metricas default, Configuracion secondary)
```

### New API endpoint

```
app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts
                              Trainer-scoped variant of the existing client-auth endpoint
```

### Reused (no changes)

- `components/trainer/microcycle/microcycle-config.tsx` — rendered inside Configuración sub-tab.
- `components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx` — the calendar popover from Phase 1 is reused as the date jumper in `week-navigator`.
- `/api/clients/[clientId]/exercise-logs/trainer` (existing) — second leg of the parallel fetch.

All new files target <250 lines.

## Data Flow

```
weekStart change
    │
    ├──► GET /scheduled-sessions/trainer?startDate=Y&endDate=Y
    │       └─► [{ scheduled_date, session.name, session.exercises[prescribed], status }]
    │
    └──► GET /exercise-logs/trainer?startDate=Y&endDate=Y
            └─► [{ scheduled_date, exercise_id, sets[reps, weight_kg, video_url] }]
    │
    ▼
Index by date → Map<YYYY-MM-DD, { prescribed, logs }>
    │
    ▼
WeekStrip renders 7 days; each cell computes adherence on the fly.
DayDetail renders the selected day with three numbers + per-exercise breakdown.
```

- Both fetches are issued in parallel via `Promise.all`. State updates once when both resolve.
- An `AbortController` cancels stale fetches when `weekStart` changes mid-flight.
- No cross-mount caching. Returning to the sub-tab refetches the visible week. Data per week is small (<100 KB); we can add memoization later if needed (YAGNI).

## Adherence Semantics

Three percentages computed client-side in `adherence.ts`. All clamped to `[0, 1]`.

| Metric         | Formula                                                                                   | Question it answers                                |
| -------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Ejercicios** | `count(prescribed con ≥1 set loggeado) / count(prescribed)`                               | Did the client show up and start each exercise?    |
| **Series**     | `sum(set count loggeado) / sum(prescribed.sets)`                                          | Did the client finish each exercise or stop short? |
| **Carga**      | `sum(set.reps × set.weight) / sum(prescribed.sets × prescribed.reps × prescribed.weight)` | Did the client lift the prescribed load?           |

Where each metric appears:

- **Week strip (bird's-eye):** only "% ejercicios" appears under the day symbol. The other two would saturate the grid.
- **Day detail (drill-down):** a summary line shows all three (`Ejercicios 80% · Series 67% · Carga 94%`), and each prescribed exercise inside the day shows its own breakdown.

### Day classification (drives the symbol on the strip)

Based exclusively on "% ejercicios":

| Symbol | Meaning                | Color |
| ------ | ---------------------- | ----- |
| `●`    | Complete               | green |
| `◐`    | Partial (1–99%)        | amber |
| `○`    | Pending (0%)           | gray  |
| `—`    | Rest (no prescription) | muted |

Color is supporting only. Symbol + numeric % are the primary signal — daltonism-safe.

## Edge Cases (explicit)

- **Session prescribed with zero exercises** → ejercicios 0/0, treated as `—` rest (de facto rest day).
- **Logs without a scheduled_session** (off-plan logging) → don't affect adherence. They surface in the day detail under a "También registró:" sub-section, no metrics attached.
- **Prescription without weight** (carga prescrita = 0 or null) → that exercise doesn't contribute to the carga calculation. The metric uses only exercises whose prescribed weight is `> 0`.
- **Future scheduled day** → no symbol. Cell renders muted with `scheduled_date` + session name only, no adherence (not pending, just upcoming).
- **No client_program active** → metrics section displays a single message: _"Este cliente no tiene sesiones programadas. Asígnale un microciclo en la pestaña Configuración."_ with a link that switches to the Configuración sub-tab. No empty strip.
- **Network error on either fetch** → banner "No se pudieron cargar las métricas" + retry button. Both fetches retry together.

## Components — Detailed Responsibility

### `metrics-section.tsx`

Orchestrator. Owns `weekStart: Date` (Monday of visible week) and `selectedDate: string` (YYYY-MM-DD). Mounts `WeekNavigator`, `WeekStrip`, `DayDetail`. Resets state on `clientId` change.

### `use-week-metrics.ts`

Custom hook `useWeekMetrics(clientId, weekStart, weekEnd)`. Returns `{ data, loading, error, refetch }` where `data` is the indexed Map and a flat list of orphan logs. Aborts in-flight fetches when inputs change.

### `week-navigator.tsx`

Three controls: `[←]` previous week, label "Semana del 19 – 25 may 2026" (clicking opens the existing `HistoryDateFilter` calendar popover anchored to any date — selecting a date jumps to that week), `[Hoy]`, `[→]` next week. Keyboard: ← / → arrows when navigator has focus.

### `week-strip.tsx`

7 cells in a CSS grid. Each cell shows: day-of-week label (LUN/MAR/...), day-of-month, session name (truncated to 1 line), adherence symbol, "% ejercicios". Hover dims the cell. Selected cell has blue border (not fill — fill is reserved for today). Today's cell has a subtle blue ring.

### `day-detail.tsx`

Inline panel that renders when a day is selected. Header: full date + session name + three percentages. Body: ordered list of prescribed exercises; each row shows `Prescrito 4×8 @ 60kg | Ejecutado 4×8 · 60·60·58·58kg | E 100% · S 100% · C 96%`. Followed by a "También registró:" section listing orphan logs for the same date (if any), without adherence numbers.

### `adherence.ts`

Pure functions:

```ts
computeDayAdherence(
  prescribed: PrescribedExercise[],
  logs: ExerciseLog[]
): { ejercicios: number; series: number; carga: number; classification: DayClass }
```

Plus `classifyDay(adherence, hasPrescribed)`. No React imports. Easy to unit-test if a runner is added.

## API: `/scheduled-sessions/trainer` endpoint

Mirrors the existing `/exercise-logs/trainer` route's auth pattern:

1. Validate `getTrainerSession()`.
2. Look up `clients.tenant`; require `client.tenant === session.trainer_id` or 404.
3. Query `scheduled_sessions` joined to `sessions` and `session_exercises` (each exercise prescribed in that session), filtered by `client_id` and the date range.
4. Return `{ success: true, scheduledSessions: [...] }` with each row carrying the nested prescription.

The exact nested select path needs to match the live `session_exercises` schema; the implementation plan task will read `types/supabase.ts` to confirm before writing the select.

## UX States

- **Initial load:** skeleton week strip (7 gray cells with shimmer) while parallel fetches resolve. No global spinner.
- **Week-to-week navigation:** keep the current strip visible but at 50% opacity until new data arrives. Avoids the "blink" of swapping to skeleton.
- **Empty week (no prescribed sessions):** strip renders all `— Descanso`. Day detail says "Día de descanso — sin sesión programada."
- **No client_program:** the message described in Edge Cases — no strip.
- **Error:** retry banner.

## Accessibility

- Week strip cells are buttons with `aria-selected`, `aria-current="date"` for today, and descriptive `aria-label` ("Lunes 19 mayo, sesión completa, 4 de 5 ejercicios").
- Arrow keys move selection within the strip; Enter selects; Tab moves focus to day detail.
- Symbols (`●` `◐` `○` `—`) plus numeric % are present in every cell. Color is supporting.
- Transitions are `transition-colors 150ms`; respects `prefers-reduced-motion` implicitly via Tailwind tokens.

## Responsive

- `≥ 640px`: 7-column grid fills width.
- `< 640px`: strip becomes horizontally scrollable; each cell keeps a minimum width to stay legible.
- Day detail always renders full-width below the strip.

## Performance

- Two parallel fetches per week change, no cross-week caching.
- Per-fetch payload: <100 KB for a typical week.
- `AbortController` cancels stale fetches.
- Adherence computation is O(prescribed × logs) per day, run only when the user interacts — negligible at this scale.

## Scope

### In

- Sub-tabs Métricas / Configuración with Métricas default.
- Weekly calendar navigator (Mon–Sun) with the existing date-picker popover for fast jumps to any week.
- Three adherence metrics calculated client-side; the headline metric ("ejercicios") on the strip, all three on the detail.
- Inline day detail with per-exercise breakdown and orphan logs section.
- Trainer-scoped `scheduled-sessions` endpoint.
- Loading skeletons, error banner, empty-state messages.
- Keyboard navigation of the strip with arrow keys.

### Out (deferred, documented in plan)

- "Ver →" cross-tab navigation that auto-expands the exercise card in Entrenamientos.
- Dated prescriptions (Phase 3 of the original roadmap — per-day overrides of the template).
- Week-over-week comparison views.
- CSV/PDF export of adherence reports.
- Filters (by category, intensity, etc.) inside the metrics view.
- Any modification to the existing `MicrocycleConfig` editor.

## Open Implementation Questions (for the plan)

1. The nested SELECT for `scheduled_sessions` → `session_exercises` → `exercises` needs to match live schema; first task in the plan should read `types/supabase.ts` and `lib/services/program-service.ts` to confirm exact column names before writing the route.
2. `HistoryDateFilter` currently expects `datesWithSessions: string[]` to gate clickable cells. For the navigator we want every date clickable (jump to any week). We will pass a flag `allowAnyDate?: boolean` to the existing component, or branch by checking if the array is empty. Decide at implementation time.

---

**Approved by:** David Bracho · 2026-05-11.
**Next step:** writing-plans skill to produce the task-by-task implementation plan.
