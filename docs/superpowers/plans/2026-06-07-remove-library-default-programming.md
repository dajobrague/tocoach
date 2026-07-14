# Remove "Programación por Defecto" from the Exercise Library — Plan

> Execute subagent-driven. Verification gate per unit: `npm run type-check` (only the 2 untracked nutrition specs may error) + `npm run lint:check` clean on touched files. No automated test runner on this branch; final manual smoke by the user.

**Goal:** Remove the default training-parameters ("Programación por Defecto") section from the Exercise Library for strength AND cardio. That prescription data now lives only in programs/client sessions. **Exception:** keep cardio **"Tipo de Actividad"** in the library — moved into the exercise's basic info and stored in `exercises.metadata.cardio_type` (not the repurposed `default_training_system`), so it flows to the session correctly.

**Decisions (user, 2026-06-07):** Keep cardio activity type (drop the rest of cardio defaults); leave the `default_*` DB columns (remove UI/API/code usage only, no migration).

**Branch:** `feat/exercise-library-selector` (continues the library work).

**Key data facts:**

- `default_*` columns on `exercises`: `default_sets`, `default_reps`, `default_tempo`, `default_rest_seconds`, `default_training_system`. STAY in DB; app stops using them.
- Cardio library modal currently REPURPOSES defaults: duración=`default_reps`, distancia=`default_sets`, intensidad=`default_tempo`, **tipo de actividad=`default_training_system`**. POST writes `metadata: {}` (empty) — so today the typed activity type never reaches `metadata.cardio_type` (the session's source). We fix this: store activity type in `metadata.cardio_type`.
- Consumers of `default_*` (all must be cleaned): `workouts-tab.tsx` (prefill + Autocomplete subtitle ×2), `cardio-tab.tsx` (duration prefill), `exercise-library-content.tsx` (table subtitle, card "Valores por Defecto", detail modal), `template-detail-modal.tsx` (prefill + local type), `lib/utils/exercise-utils.ts` (validate + hasDefaults + format), `lib/utils/training-utils.ts` (fallback chain), `types/training.ts` (3 interfaces).

---

## Unit 1 — Library UI + API: remove defaults, store cardio activity type in metadata

**Files:** `components/dashboard/add-exercise-library-modal.tsx`, `components/dashboard/edit-exercise-library-modal.tsx`, `app/api/exercises/route.ts` (POST), `app/api/exercises/[exerciseId]/route.ts` (PUT).

- [ ] **add modal:** Remove the strength "Programación del ejercicio por defecto" section and the cardio default section (the two `formData.category === ...` blocks with the default*\* inputs). Remove `default*\*`from the initial`formData`and the reset object. Add a`cardio_type: ""`form field. Render a single **"Tipo de Actividad"**`<Input>`(placeholder "Ej: Carrera, Ciclismo") in the BASIC INFO area, shown only when`formData.category === "cardio"`, bound to `formData.cardio_type`. On submit, send `cardio_type` in the body (the rest of the body keeps name/category/description/media/etc.).
- [ ] **edit modal:** Remove the unified default section. Remove `default_*` from `formData` init/reset. Add `cardio_type` to `formData`, initialized from `exercise.metadata?.cardio_type ?? exercise.default_training_system ?? ""` (migrates old data on edit). Render the same cardio-only "Tipo de Actividad" Input in basic info. Send `cardio_type` on save.
- [ ] **POST `/api/exercises`:** Remove the `default_*` destructure and the `default_*` fields from the insert. Replace `metadata: {}` with: `metadata: category === "cardio" && cardio_type ? { cardio_type } : {}` (read `cardio_type` from body). Keep everything else.
- [ ] **PUT `/api/exercises/[exerciseId]`:** Remove the `default_*` conditional updates. When `body.cardio_type !== undefined`, merge it into metadata WITHOUT clobbering other keys: fetch the row's current `metadata` (or select it), then `updateData.metadata = { ...(currentMetadata ?? {}), cardio_type: body.cardio_type || null }`. (If the route already loads the exercise, reuse it; else add a small select.)
- [ ] Verify type-check + lint clean on these 4 files. Commit: `feat(training): drop library default programming, store cardio type in metadata`.

---

## Unit 2 — Clean all `default_*` consumers

**Files:** `components/dashboard/client-profile/tabs/workouts-tab.tsx`, `cardio-tab.tsx`, `components/dashboard/exercise-library-content.tsx`, `components/dashboard/template-detail-modal.tsx`, `lib/utils/exercise-utils.ts`, `lib/utils/training-utils.ts`.

- [ ] **workouts-tab `handleSelectLibraryExercise`:** stop prefilling `sets/reps/tempo/rest/trainingSystem` from `exercise.default_*` — set them to `""` (trainer enters them in the session). Keep `name`, `videoUrl`, `exerciseId`. Remove the Autocomplete item subtitle `{exercise.default_sets} series × {exercise.default_reps} reps` (BOTH occurrences — Add and Edit pickers).
- [ ] **cardio-tab `handleSelectLibraryExercise`:** stop prefilling `duration` from `exercise.default_reps` → `duration: ""`. Keep `type: exercise.metadata?.cardio_type || exercise.category || ""` (now metadata is populated). Remove any default\_\* subtitle in the cardio Autocomplete item if present.
- [ ] **exercise-library-content.tsx:** Remove the default\_\* display: the list-row subtitle (`{default_sets} × {default_reps}` / cardio `{default_reps} min`), the card "Valores por Defecto" block, and the detail-modal default sections. For CARDIO, where it previously showed repurposed defaults, show the **activity type** from `metadata?.cardio_type` instead (a simple "Tipo: {cardio_type}" when present). Remove now-dead `hasDefaults`-driven conditionals.
- [ ] **template-detail-modal.tsx:** Remove the `default_*` fields from its local exercise type (~lines 300-304) and stop prefilling `sets/reps/rest_seconds` from `default_*` in `handleExerciseCreated` and the inline exercise picker (set them to `""`).
- [ ] **exercise-utils.ts:** Remove `default_*` from `validateExerciseLibraryForm` (the form type + the validation rules for default_sets/default_rest_seconds), and remove the `hasDefaults` computed field from `formatExerciseForDisplay` (and any usage).
- [ ] **training-utils.ts:** In `resolveStrengthCoachingFields`, remove the `|| se.exercise?.default_tempo` / `|| ...default_training_system` / `default_rest_seconds` fallbacks (session metadata is the only source now). Leave the rest.
- [ ] Verify type-check + lint clean. Commit: `refactor(training): stop reading exercise library defaults across consumers`.

---

## Unit 3 — Types + final verification

**Files:** `types/training.ts`.

- [ ] Remove the `default_sets/default_reps/default_tempo/default_rest_seconds/default_training_system` fields from `Exercise`, `CreateExerciseLibraryRequest`, and `UpdateExerciseLibraryRequest`. (Optionally add `cardio_type?: string` to the library request types for clarity, or rely on the loosely-typed body.)
- [ ] `npm run type-check` — MUST be clean (only the 2 nutrition specs). Any remaining error points at a missed `default_*` reader from Unit 2 — fix it.
- [ ] Grep: `grep -rnE "default_sets|default_reps|default_tempo|default_rest_seconds|default_training_system" --include="*.ts" --include="*.tsx" app components lib types | grep -v node_modules` → expect ZERO app-layer hits (DB migration files may still reference the columns — that's fine, they stay).
- [ ] `npm run lint:check` clean. Commit: `refactor(training): drop default_* from exercise types`.
- [ ] Manual smoke (user): create + edit a strength library exercise (no default section); create + edit a cardio exercise (only "Tipo de Actividad", no duración/distancia); add both to a session (no prefill of sets/reps; cardio shows the activity type); library list/detail no longer shows default params.

---

## Out of scope

- Dropping the `default_*` DB columns (left in place by decision).
- Backfilling `metadata.cardio_type` from `default_training_system` for existing cardio exercises (handled lazily: edit migrates; un-edited fall back to category as today).
