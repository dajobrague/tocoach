# Library-Driven Exercise Selection (client Training/Cardio tabs) — Design

**Date:** 2026-06-07
**Status:** Approved
**Branch:** `feat/exercise-library-selector`

## Problem

In the trainer-facing client training area, the **Training** (`workouts-tab.tsx`) and **Cardio** (`cardio-tab.tsx`) tabs let a trainer expand a session, see its exercises, and **edit** an exercise via a modal whose **name** and (strength) **video URL** are free-text inputs. The `PUT …/exercises` save handler **overwrites the shared `exercises` library row** (`exercises.name`, `exercises.video_url`). Because that library exercise is referenced (`session_exercises.exercise_id`) by every session/program/client using it, editing the name in one session silently mutates it everywhere — the bug trainers are hitting. The **Add** flow has the same root: it free-texts a name and implicitly creates/dedupes library rows, producing duplicates.

## Goal

Make the session tabs **pure library selection**: a trainer chooses _which_ library exercise fills a slot (`exercise_id`); name/video/image/category come from the library, read-only. All exercise authoring (name/video/category/defaults) happens in the Exercise Library screen. The per-session prescription stays fully editable. No data corruption, downstream views correct, production-ready.

## Decisions (locked with user 2026-06-07)

1. **Edit model — pick-only swap.** In a session, name/video are a read-only library selector. Global renames/video edits happen in the Exercise Library screen. Per-session prescription stays editable.
2. **Swap with existing logs — allow + warn.** Logs keep their `exercise_id`; old history stays under the old exercise. The Edit modal warns before saving when the client has logged the current exercise.
3. **Breadth — Edit + Add, both Training & Cardio tabs.** Templates editor is a separate follow-up.
4. **New exercises — Library-screen only.** Add/Edit are pure selection; no inline free-text creation. Brand-new exercises are created in the Exercise Library screen, then appear in the picker. Modals show a "Manage library" pointer.

## Key data facts (from impact analysis)

- `session_exercises.exercise_id` (FK → `exercises.id`) already exists. **No DB migration needed.**
- `exercise_logs` reference `exercise_id` (FK → `exercises.id`) directly — **not** `session_exercises.id`. Swapping a slot's `exercise_id` leaves existing logs attached to the old exercise (historically correct split).
- Downstream readers all resolve name/video via the `exercise_id → exercises` join: client `active-session-view.tsx`, `exercise-log-modal.tsx`, trainer `exercise-progress-card.tsx` / `exercise-history-table.tsx`, `programs/route.ts` + `lib/utils/training-utils.ts#transformToWorkoutProgram`. **No changes needed there** — they reflect a swap automatically.
- The Add-flow library picker already exists in both tabs (`handleSelectLibraryExercise` + HeroUI `Autocomplete`). Workouts has server-side search (`/api/exercises?search=&limit=50`, debounced); **cardio uses client-side filtering on a 500-cap list** and must be brought to parity.
- `exercises.category` is `'strength'` / `'cardio'`; `sessions.session_type` is `'strength'` / `'cardio'`.

## Design

### UI (both tabs)

- **Edit modal:** replace the free-text **Nombre del Ejercicio** and (strength) **URL Video Tutorial** inputs with the existing `Autocomplete` library picker, **pre-selected to the slot's current `exercise_id`**. Show selected name/video/image read-only. All per-session fields remain editable. On swap, **keep** the existing per-session prescription (do not reset to the new exercise's defaults).
- **Add modal:** picker is the required selection mechanism; remove implicit free-text creation. Selecting a library exercise still prefills per-session fields from library defaults (kept).
- **Cardio parity:** give cardio's picker the same server-side search as workouts. Cardio gains library-driven video display for free.
- **Swap-with-logs warning:** when the client has logs for the slot's current exercise, the Edit modal requires a confirmation: _"Este cliente tiene N registros de [Antiguo]. Esos quedan ligados a [Antiguo]; los nuevos registros serán de [Nuevo]."_
- **Empty/not-found state:** both pickers show a "¿No está en tu biblioteca? Gestiónala" pointer to the Exercise Library screen.

### API — `app/api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/exercises/route.ts`

- **PUT (edit):** accept `exerciseId`. When it differs from the slot's current exercise, **validate** (exercise belongs to this trainer; its `category` matches the session's `session_type`), then update `session_exercises.exercise_id`. **Remove all writes to `exercises.name`/`exercises.video_url`.** Continue updating per-session fields (`sets`, `reps`, `weight_kg`, `duration_seconds`, `distance_meters`, `notes`, `metadata.*`).
- **POST (add):** require `exerciseId`; **remove the name-based search/create-library-row path.** Validate ownership + category, then insert the `session_exercises` row with per-session fields.
- Request validation/types updated to `exerciseId` + per-session fields; `name`/`videoUrl` dropped from these bodies. Reject requests missing a valid `exerciseId` with a clear 400.

### Validation & edge cases

- **Category guard:** picker filtered to the tab's category; server rejects an `exerciseId` whose category ≠ `session_type`.
- **Ownership guard:** server confirms the `exerciseId` belongs to the trainer (and tenant).
- **Logs split:** intentional and warned; no rewrite of historical logs.
- **No migration:** logic + UI only.

## Out of scope (follow-ups)

- Templates exercise editor (`app/api/templates/[templateId]/sessions/[sessionId]/exercises/route.ts`, its UI, and `custom_name`).
- Cleanup of pre-existing duplicate/orphaned library rows from the old free-text Add flow.

## Affected files

- UI: `components/dashboard/client-profile/tabs/workouts-tab.tsx`, `components/dashboard/client-profile/tabs/cardio-tab.tsx`
- API: `app/api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/exercises/route.ts`
- Types: `types/training.ts` (request shapes)
- Verified no-change (downstream): `active-session-view.tsx`, `exercise-log-modal.tsx`, `exercise-progress-card.tsx`, `exercise-history-table.tsx`, `programs/route.ts`, `lib/utils/training-utils.ts`.
