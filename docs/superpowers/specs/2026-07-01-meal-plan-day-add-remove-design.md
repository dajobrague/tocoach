# Add / remove days in the meal-plan builder

**Date:** 2026-07-01
**Area:** `features/trainer/cycles/` (Plan de comidas), `lib/nutrition/cycles/`, `app/api/meal-cycles/`
**Status:** Approved — implementing

## Goal

Let a trainer add and remove days in a meal-cycle plan directly from the day
strip:

- Hovering a day tile reveals an **X** (circle, top-right). Clicking it opens a
  confirmation — _"¿Seguro que quieres quitar el día? La data de este día se
  perderá."_ — and on confirm removes the day.
- A trailing **+** tile at the far right of the day strip adds a new day. A
  confirmation lets the trainer add it **blank** or **copy from another day**.

## Decisions (from brainstorming)

- **Remove = renumber & shrink.** Removing Día 2 of a 4-day plan makes Día 3→2,
  Día 4→3, and `duration_days` becomes 3. No gaps.
- **Add = append at end.** The new day is always the last day. Copy-from may seed
  it from any existing day (verbatim, frozen snapshots preserved).
- **Minimum 1 day.** Removing is blocked when only one day remains.

## Architecture

Days are derived, not stored: a cycle has `duration_days`, and each `meal_slots`
row carries a `day_index` (0-based). `groupSlotsByDay` buckets slots by index.
So day operations are `duration_days` + `day_index` rewrites.

### Backend — two endpoints mirroring the existing `copy-day`

`MealCycleService` (`lib/nutrition/cycles/meal-cycle-service.ts`):

- **`removeDay(tenantHost, cycleId, dayIndex)`**
  1. Load cycle (tenant-scoped); `null` if not owned.
  2. Validate `dayIndex ∈ 0..duration_days-1`; throw `MealCycleValidationError`
     if `duration_days === 1` (min 1 day).
  3. Delete all slots with `day_index === dayIndex` (options cascade — same path
     `clearDay` already uses).
  4. Decrement `day_index` by 1 for every slot with `day_index > dayIndex`.
  5. Set `duration_days -= 1`.
- **`addDay(tenantHost, cycleId, copyFromDayIndex?)`**
  1. Load cycle; `null` if not owned.
  2. Set `duration_days += 1`; the new day index is the old `duration_days`.
  3. If `copyFromDayIndex` given (validated `0..oldDuration-1`), reuse the
     existing `copyDay(copyFromDayIndex, newIndex)` to seed the new day verbatim.

Routes (mirror `copy-day/route.ts`, `guardRecipeRequest` + tenant scoping):

- `POST /api/meal-cycles/[id]/remove-day` — body `{ day_index }`.
- `POST /api/meal-cycles/[id]/add-day` — body `{ copy_from_day_index? }`.

Validators `parseRemoveDay` / `parseAddDay` in `cycle-request.ts`, alongside
`parseCopyDay`.

### Client layer

- `cycle-api.ts`: `removeDay(cycleId, dayIndex)`, `addDay(cycleId, copyFromDayIndex?)`.
- `use-cycles.ts`: `removeDayM` / `addDayM` in `useCycleMutations`, invalidating
  the cycle tree (which carries `duration_days`) and the `["cycles"]` list.
- `cycle-builder-content.tsx`: `removeDayTarget` (dayIndex | null) and
  `addDayOpen` state; wire `DaySelector` callbacks + two modals. On remove, clamp
  `selectedDay` down when it was ≥ the removed index so the selection stays valid.

### UI components

- **`DaySelector`** (presentational): each tile wrapped in `relative group`; the
  day-select `<button>` stays, plus a sibling absolutely-positioned **X**
  `<button>` (top-right circle, `opacity-0 group-hover:opacity-100`, focus
  visible) that calls `onRequestRemoveDay(dayIndex)` with `stopPropagation`.
  A trailing dashed **+** tile calls `onRequestAddDay()`. New props:
  `onRequestAddDay`, `onRequestRemoveDay`, `disabled`.
- **`RemoveDayModal`** — HeroUI `Modal`, danger style, the confirmation copy above.
- **`AddDayModal`** — HeroUI `Modal`; radio/segmented choice **En blanco** vs
  **Copiar desde otro día** + a day `Select` (label `Día N · M comidas`). Emits
  `{ copyFromDayIndex?: number }`.

No native `confirm()`/`alert()` — they freeze HeroUI `onPress` (known bug); use
HeroUI `Modal` like the existing "Limpiar día" modal.

## Accepted behaviors / risks

- Renumber-and-shrink applies even on an **active** cycle. Structural slot edits
  are already allowed on active cycles (`clearDay` deletes slots there today), so
  slot deletion in `removeDay` is no riskier than the current behavior. The modal
  warning covers the data loss. Archived cycles remain read-only (`disabled`).
- `removeDay` shifts `day_index` per-row (matching the codebase's per-row loop
  style in `copyDay`); partial failure risk is the same as `copyDay` and accepted.

## Tests (TDD)

- **Unit** (`cycle-request` tests): `parseAddDay` / `parseRemoveDay` — valid,
  missing, negative, non-integer, out-of-range.
- **Integration** (`meal-cycle-service.integration.test.ts`): seed a 3-day cycle
  with slots+options.
  - `removeDay(1)`: day-1 slots gone, day-2 slots renumbered to index 1, options
    snapshots intact, `duration_days === 2`.
  - `removeDay` on a 1-day cycle throws `MealCycleValidationError`.
  - `addDay({copyFrom: 0})`: new last day mirrors day 0's slots + option
    snapshots; blank `addDay()` grows `duration_days` with no new slots.
