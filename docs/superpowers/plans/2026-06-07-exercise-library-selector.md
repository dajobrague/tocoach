# Library-Driven Exercise Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Convert the trainer-facing client **Training** (`workouts-tab.tsx`) and **Cardio** (`cardio-tab.tsx`) session exercise **Add** and **Edit** modals from free-text name/video into **library-only selection**, and change the `…/exercises` API so it **swaps `session_exercises.exercise_id`** instead of overwriting the shared `exercises` library row.

**Architecture:** Session slots become pure references to library exercises (`exercise_id`). Name/video/image/category come from the library, read-only. Per-session prescription (sets/reps/weight, cardio params, notes) stays editable. The Edit modal pre-selects the slot's current exercise and warns when swapping an exercise the client has logged. No DB migration — `exercise_id` already exists; downstream readers already resolve via the `exercise_id → exercises` join, so they reflect a swap automatically.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes), Supabase, HeroUI v2 (`Autocomplete`).

**Branch:** `feat/exercise-library-selector` (off `main`, spec at `docs/superpowers/specs/2026-06-07-exercise-library-selector-design.md`).

**Testing reality:** This branch has **no automated test runner wired** (vitest/playwright are installed but there's no `test` script and no tracked specs/DB harness on `main`). The API route has no existing tests and is DB-coupled. Therefore the **verification gate for every task is `npm run type-check` + `npm run lint:check` clean**, plus a **final manual smoke test in the running app** (Task 7). Do not fabricate test runs. If a step is naturally unit-testable as a pure function, a colocated vitest test is welcome, but do not stand up a DB test harness.

**Naming caution (read before Task 1):** In the existing PUT route, the query param `?exerciseId=` is the **`session_exercises` row id** (the join row), NOT a library exercise. The **new library target** to swap to arrives in the **request body** as `exerciseId` (the value the picker sets in `exerciseForm.exerciseId`). Keep these straight: `searchParams.get("exerciseId")` = session-exercise row; `body.exerciseId` = library exercise to point at.

**Verification commands:**

- `npm run type-check` — tsc --noEmit; MUST be clean (the only allowed pre-existing errors are the two untracked nutrition specs `tests/e2e/override-journey.spec.ts` / `tests/e2e/week-logging.spec.ts`).
- `npm run lint` (autofix) then `npm run lint:check` — clean on touched files (one pre-existing `.claude/helpers/statusline.cjs` rule error is unrelated).

---

## File Structure / Decomposition

- API: `app/api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/exercises/route.ts` — POST + PUT become library-id driven (Task 1).
- Types: `types/training.ts` — add `exerciseId` to the request shape (Task 2).
- Training UI: `components/dashboard/client-profile/tabs/workouts-tab.tsx` — edit modal picker, edit-opens-library, swap warning (Task 3).
- Cardio UI: `components/dashboard/client-profile/tabs/cardio-tab.tsx` — server-search parity, edit modal picker, edit pre-select, swap warning (Tasks 4–5).
- Shared UX: "Manage library" pointer to `/trainer/dashboard/exercise-library` in both tabs' modals (Task 6).
- Manual verification (Task 7).

**Ordering:** API + types first (Tasks 1–2) so the UI builds against the final contract; then each tab; then shared pointer; then manual verify. Each task ends green + committed.

---

## Task 1: API route — swap `exercise_id`, stop overwriting the library row

**Files:**

- Modify: `app/api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/exercises/route.ts`

**Context:** Today POST does a name-based lookup/create on `exercises` (and overwrites `video_url`), ignoring the `exerciseId` the client already sends. PUT overwrites `exercises.name`/`video_url` on the shared row and never swaps `exercise_id`. We make both **require a library `exerciseId` in the body**, validate it (trainer-owned + category matches the session's `session_type`), and use it as the FK — never writing to the `exercises` row.

- [ ] **Step 1: POST — replace the name-based exercise resolution (current lines 75–131) with body-`exerciseId` validation.**

Replace the block that starts at `// First, create or find the exercise in the exercise library` (line 75) and ends at the close of the `else { … }` that sets `exerciseId = newExercise.id;` (line 131) with:

```ts
// Library-only: the slot must reference an existing library exercise.
// The client sends the chosen library exercise id in the body. We never
// create or rename library rows from here (that happens in the Exercise
// Library screen).
const libraryExerciseId: unknown = body.exerciseId;

if (typeof libraryExerciseId !== "string" || libraryExerciseId.length === 0) {
  return NextResponse.json(
    {
      success: false,
      error: "Debes seleccionar un ejercicio de tu biblioteca",
    },
    { status: 400 }
  );
}

// Validate ownership + category match against this session's type.
const { data: libraryExercise, error: libraryError } = await supabase
  .from("exercises")
  .select("id, category")
  .eq("id", libraryExerciseId)
  .eq("trainer_id", session.trainer_id)
  .maybeSingle();

if (libraryError || !libraryExercise) {
  return NextResponse.json(
    { success: false, error: "Ejercicio de biblioteca no encontrado" },
    { status: 404 }
  );
}

const expectedCategory =
  sessionData.session_type === "cardio" ? "cardio" : "strength";

if (libraryExercise.category !== expectedCategory) {
  return NextResponse.json(
    {
      success: false,
      error: `El ejercicio seleccionado no es de tipo ${expectedCategory}`,
    },
    { status: 400 }
  );
}

const exerciseId: string = libraryExercise.id;
```

This removes all `.from("exercises").insert(...)` / name-lookup / `video_url` writes from POST. The rest of POST (max-order query line 133+, `sessionExerciseData` build, insert) is unchanged and continues to use `exerciseId`.

- [ ] **Step 2: POST — drop `name`/`videoUrl` from the destructure (lines 31–47).** Remove `name,` and `videoUrl,` from the destructured body (they're no longer used by POST). Keep `sets, reps, tempo, rest, trainingSystem, duration, distance, intensity, minHeartRate, maxHeartRate, type, notes`.

- [ ] **Step 3: PUT — read the library target from the body and validate; stop writing the `exercises` row.**

In PUT, the query param stays as-is:

```ts
const { searchParams } = new URL(request.url);
const sessionExerciseRowId = searchParams.get("exerciseId"); // session_exercises.id
if (!sessionExerciseRowId) {
  return NextResponse.json(
    { success: false, error: "Exercise ID requerido" },
    { status: 400 }
  );
}
```

(Rename the local `const exerciseId` to `sessionExerciseRowId` throughout PUT — it is used at the `.eq("id", exerciseId)` filters on `session_exercises`, lines 278 and 343, and the closing log line 358. Update those to `sessionExerciseRowId`.)

Change the session_exercise fetch (lines 275–279) to also return `exercise_id` (already does) and the joined session type — it already selects `sessions(session_type)`. Keep it.

**Delete the entire `exercises` overwrite block (lines 290–303)** — the `.from("exercises").update({ name, video_url, ... })`. Replace it with a swap of `exercise_id` validated like POST:

```ts
// Library-only swap: if the body names a (different) library exercise,
// repoint the slot's exercise_id to it. We never rename/edit the library
// row from here. Existing logs keep their old exercise_id (history split,
// surfaced to the trainer in the UI warning).
const libraryExerciseId: unknown = body.exerciseId;
let nextExerciseId: string | undefined;

if (typeof libraryExerciseId === "string" && libraryExerciseId.length > 0) {
  if (libraryExerciseId !== sessionExercise.exercise_id) {
    const sessionType = (sessionExercise as any).sessions?.session_type;
    const expectedCategory = sessionType === "cardio" ? "cardio" : "strength";

    const { data: libraryExercise, error: libraryError } = await supabase
      .from("exercises")
      .select("id, category")
      .eq("id", libraryExerciseId)
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (libraryError || !libraryExercise) {
      return NextResponse.json(
        { success: false, error: "Ejercicio de biblioteca no encontrado" },
        { status: 404 }
      );
    }

    if (libraryExercise.category !== expectedCategory) {
      return NextResponse.json(
        {
          success: false,
          error: `El ejercicio seleccionado no es de tipo ${expectedCategory}`,
        },
        { status: 400 }
      );
    }

    nextExerciseId = libraryExercise.id;
  }
}
```

Then, when building `updateData` (line 310), add the swap when present:

```ts
const updateData: any = {
  notes: notes || null,
  updated_at: new Date().toISOString(),
};

if (nextExerciseId) {
  updateData.exercise_id = nextExerciseId;
}
```

The rest of `updateData` (cardio vs strength per-session fields) is unchanged. The `isCardio` flag still derives from `(sessionExercise as any).sessions?.session_type` (line 306–307) — keep.

- [ ] **Step 4: PUT — drop `name`/`videoUrl` from the destructure (lines 254–270)** (no longer used). Keep the per-session fields.

- [ ] **Step 5: Verify.**

Run: `npm run type-check 2>&1 | grep "programs/\[programId\]"` → no errors.
Run: `npm run lint` then `npm run lint:check` → clean on the route file.

- [ ] **Step 6: Commit.**

```bash
git add "app/api/clients/[clientId]/programs/[programId]/sessions/[sessionId]/exercises/route.ts"
git commit -m "feat(training): library-only exercise add/swap in session exercises API"
```

End body with: `Co-Authored-By: RuFlo <ruv@ruv.net>`

---

## Task 2: Types — add `exerciseId` to the exercise request shape

**Files:**

- Modify: `types/training.ts`

- [ ] **Step 1: Add `exerciseId` to `CreateExerciseRequest` (lines 249–266).** Insert at the top of the interface body:

```ts
export interface CreateExerciseRequest {
  /** Library exercise to reference (add) or swap to (edit). Required now. */
  exerciseId: string;
  // Strength training fields
  sets?: string;
  reps?: string;
  tempo?: string;
  rest?: string;
  trainingSystem?: string;
  // Cardio-specific fields
  duration?: string;
  distance?: string;
  intensity?: string;
  minHeartRate?: string;
  maxHeartRate?: string;
  type?: string;
  notes?: string;
}
```

Remove `name` and `videoUrl` from this interface (the session request no longer carries them). Confirm via grep that no code imports `CreateExerciseRequest` and reads `.name`/`.videoUrl` off it — Run: `grep -rn "CreateExerciseRequest" --include="*.ts" --include="*.tsx" . | grep -v node_modules`. If a consumer breaks, note it; the tab `exerciseForm` literals are untyped (not derived from this type) so they won't.

- [ ] **Step 2: Verify.** `npm run type-check` → no NEW errors attributable to this change. `npm run lint:check` clean.

- [ ] **Step 3: Commit.**

```bash
git add types/training.ts
git commit -m "feat(training): type session-exercise requests as library-id based"
```

End body with: `Co-Authored-By: RuFlo <ruv@ruv.net>`

---

## Task 3: Training tab (`workouts-tab.tsx`) — picker in Edit, pre-select, swap warning

**Files:**

- Modify: `components/dashboard/client-profile/tabs/workouts-tab.tsx`

**Context:** The ADD modal already has the library `Autocomplete` (lines 1576–1648) wired to `handleSelectLibraryExercise` (520–543) + server-side search (state 207–218, effect 294–325). The EDIT modal (lines 1900–1930) uses free-text name/video Inputs and `handleEditExercise` (939–963) sets `exerciseId: ""`. We reuse the ADD picker in the EDIT modal, pre-selected to the slot's current library exercise, and warn on swap-with-logs.

- [ ] **Step 1: `handleEditExercise` — pre-select the current library exercise and load the library.** The rendered `exercise` object carries `exercise.exercise_id` (used at lines 256/1466). Change `exerciseId: ""` (line 956) to `exerciseId: exercise.exercise_id ?? ""`. Also store the original for swap detection — add component state near the other selection state: `const [editOriginalExerciseId, setEditOriginalExerciseId] = useState<string>("");` and set `setEditOriginalExerciseId(exercise.exercise_id ?? "")` inside `handleEditExercise`. Finally, ensure the library list is loaded when the edit modal opens: extract the library-fetch body from `handleOpenAddExercise` (lines 505–517) into a reusable `loadLibraryExercises()` function and call it in `handleEditExercise` too (so the Autocomplete has items to render the pre-selected one). Keep `handleOpenAddExercise` calling `loadLibraryExercises()`.

- [ ] **Step 2: EDIT modal — replace the name + video `Input`s (lines 1900–1930) with the library `Autocomplete`.** Replace that block with a copy of the ADD modal's `Autocomplete` (lines 1576–1648) — identical props (controlled `items`, `selectedKey={exerciseForm.exerciseId || null}`, `onInputChange={setLibrarySearchTerm}`, `onSelectionChange` → `handleSelectLibraryExercise`). Below it, render the selected exercise's video read-only when present:

```tsx
{
  exerciseForm.videoUrl ? (
    <p className="text-xs text-gray-500">Video: {exerciseForm.videoUrl}</p>
  ) : null;
}
```

(`handleSelectLibraryExercise` already sets `videoUrl` from the library row, lines 538.) Do NOT keep any free-text name/video Input in the edit modal.

- [ ] **Step 3: Swap-with-logs warning.** The tab already loads exercise logs for its history/orphan display (it builds `prescribedExerciseIds`, ~lines 254–262). Compute whether the client has logs for `editOriginalExerciseId`: derive a `Set<string>` of `exercise_id`s that appear in the client's loaded logs (reuse that data; if it isn't in scope at the modal, do one `GET /api/clients/${clientId}/exercise-logs/trainer` when `handleEditExercise` runs and build the set client-side). In `handleSaveEditExercise`, before the PUT, if `exerciseForm.exerciseId !== editOriginalExerciseId && loggedExerciseIds.has(editOriginalExerciseId)`, show a confirm gate (a HeroUI confirm state or `window.confirm`) with: `"Este cliente ya registró entrenamientos del ejercicio anterior. Esos registros quedarán ligados al ejercicio anterior; los nuevos serán del ejercicio nuevo. ¿Continuar?"`. Only proceed on confirm. (A `window.confirm` is acceptable for v1 to avoid new modal scaffolding; prefer an inline warning banner if the file already has a confirm pattern.)

- [ ] **Step 4: `handleSaveEditExercise` body already sends `exerciseForm`** (which now carries the picked `exerciseId`). No URL change — `?exerciseId=${selectedExerciseId}` stays the session_exercise row id. Confirm the body includes `exerciseId` (it does, via `JSON.stringify(exerciseForm)`).

- [ ] **Step 5: ADD modal — ensure it's picker-only.** Confirm the ADD modal has no free-text name/video Input that bypasses the picker (the picker fills `exerciseForm.name/videoUrl`). If a free-text name Input exists in the ADD modal, remove it. The POST now requires `exerciseId`; `handleSaveExercise` already forwards it (lines 568–571) — add a guard: if `!exerciseForm.exerciseId`, block save with an inline message `"Selecciona un ejercicio de tu biblioteca"`.

- [ ] **Step 6: Verify.** `npm run type-check` (no errors in workouts-tab), `npm run lint` + `lint:check` clean on the file.

- [ ] **Step 7: Commit.**

```bash
git add components/dashboard/client-profile/tabs/workouts-tab.tsx
git commit -m "feat(training): library selector in Training edit/add modals with swap warning"
```

End body with: `Co-Authored-By: RuFlo <ruv@ruv.net>`

---

## Task 4: Cardio tab — server-side search parity

**Files:**

- Modify: `components/dashboard/client-profile/tabs/cardio-tab.tsx`

**Context:** Cardio's picker uses `defaultItems={libraryExercises}` (HeroUI client-side filter over a single `?category=cardio&limit=100` fetch). Bring it to the workouts pattern (controlled `items` + debounced server `?search=`), scoped to `category=cardio`.

- [ ] **Step 1: Add search state** near the existing library state (lines 204–205):

```ts
const [librarySearchTerm, setLibrarySearchTerm] = useState("");
const [librarySearchResults, setLibrarySearchResults] = useState<any[]>([]);
const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
```

- [ ] **Step 2: Add the debounced server-search effect** (mirror workouts lines 294–325 but with the cardio category):

```ts
useEffect(() => {
  const term = librarySearchTerm.trim();

  if (!term) {
    setLibrarySearchResults([]);

    return;
  }

  setIsSearchingLibrary(true);
  const handle = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        category: "cardio",
        search: term,
        limit: "50",
      });
      const res = await fetch(`/api/exercises?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLibrarySearchResults(data.exercises || []);
      }
    } catch (err) {
      console.error("Error searching cardio library:", err);
    } finally {
      setIsSearchingLibrary(false);
    }
  }, 250);

  return () => clearTimeout(handle);
}, [librarySearchTerm]);
```

- [ ] **Step 3: Convert the ADD `Autocomplete` (lines 1482–1544) from `defaultItems` to controlled `items` + search**, matching workouts:

  - Replace `defaultItems={libraryExercises}` with:
    ```tsx
    items={librarySearchTerm.trim().length > 0 ? librarySearchResults : libraryExercises}
    ```
  - Add `isLoading={isLoadingLibrary || isSearchingLibrary}` (replace the existing `isLoading={isLoadingLibrary}`).
  - Add `onInputChange={setLibrarySearchTerm}`.
  - Keep `onSelectionChange` → `handleSelectLibraryExercise` and `selectedKey`.

- [ ] **Step 4: `handleSelectLibraryExercise` (cardio, lines 454–472)** — make it search both lists like workouts:

```ts
const exercise =
  libraryExercises.find((ex) => ex.id === exerciseId) ??
  librarySearchResults.find((ex) => ex.id === exerciseId);
```

- [ ] **Step 5: Verify.** `npm run type-check` (no errors in cardio-tab), `npm run lint` + `lint:check` clean on the file. (No commit yet — Task 5 continues in the same file; commit at end of Task 5.)

---

## Task 5: Cardio tab — picker in Edit, pre-select, swap warning

**Files:**

- Modify: `components/dashboard/client-profile/tabs/cardio-tab.tsx`

- [ ] **Step 1: `handleEditExercise` (cardio, lines 873–897) — pre-select current library exercise + load library.** Change `exerciseId: ""` (line 891) to `exerciseId: exercise.exercise_id ?? ""`. **GOTCHA:** confirm the cardio rendered `exercise` object actually carries `exercise_id`. If it does not (cardio maps to `cardioType`/`duration`/etc.), trace where the cardio exercise object is built (the program transform / cardio mapping) and ensure `exercise_id` is included on it; if the mapping omits it, add `exercise_id` to the mapped object so pre-selection works. Add `const [editOriginalExerciseId, setEditOriginalExerciseId] = useState<string>("");` and set it in `handleEditExercise`. Extract the library fetch from `handleOpenAddExercise` (lines 439–451) into `loadLibraryExercises()` and call it in `handleEditExercise` too.

- [ ] **Step 2: EDIT modal — replace the name `Input` (lines 1835–1850) with the library `Autocomplete`** (the controlled version from Task 4). Pre-selected via `selectedKey={exerciseForm.exerciseId || null}`. Cardio has no video field — none needed; the library video flows downstream. Keep the cardio per-session fields (Tipo, Duración, etc.) below the picker.

- [ ] **Step 3: Swap-with-logs warning** — same mechanism as workouts Task 3 Step 3: build a set of the client's logged `exercise_id`s (reuse loaded log data or one GET to `/api/clients/${clientId}/exercise-logs/trainer`), and in `handleSaveEditExercise` gate the PUT with a confirm when `exerciseForm.exerciseId !== editOriginalExerciseId && loggedExerciseIds.has(editOriginalExerciseId)`, same Spanish copy.

- [ ] **Step 4: ADD modal — picker-only guard.** Ensure no free-text name Input remains in the cardio ADD modal; in `handleSaveExercise`, block save when `!exerciseForm.exerciseId` with `"Selecciona un ejercicio de tu biblioteca"`.

- [ ] **Step 5: Verify.** `npm run type-check` (no errors in cardio-tab), `npm run lint` + `lint:check` clean.

- [ ] **Step 6: Commit (Tasks 4+5).**

```bash
git add components/dashboard/client-profile/tabs/cardio-tab.tsx
git commit -m "feat(training): library selector + server search in Cardio edit/add modals"
```

End body with: `Co-Authored-By: RuFlo <ruv@ruv.net>`

---

## Task 6: "Manage library" pointer in both tabs' modals

**Files:**

- Modify: `components/dashboard/client-profile/tabs/workouts-tab.tsx`
- Modify: `components/dashboard/client-profile/tabs/cardio-tab.tsx`

- [ ] **Step 1: Add a small link** under the picker in both Add and Edit modals (all four spots) pointing to the Exercise Library screen:

```tsx
<a
  className="text-xs text-primary hover:underline"
  href="/trainer/dashboard/exercise-library"
  rel="noreferrer"
  target="_blank"
>
  ¿No está en tu biblioteca? Gestiona tus ejercicios
</a>
```

Use the project's existing link/`Link` convention if one is already imported in these files (prefer it over a raw `<a>`); otherwise a plain `<a target="_blank">` is fine.

- [ ] **Step 2: Verify.** `npm run type-check` + `npm run lint:check` clean on both files.

- [ ] **Step 3: Commit.**

```bash
git add components/dashboard/client-profile/tabs/workouts-tab.tsx components/dashboard/client-profile/tabs/cardio-tab.tsx
git commit -m "feat(training): link to exercise library from session exercise modals"
```

End body with: `Co-Authored-By: RuFlo <ruv@ruv.net>`

---

## Task 7: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Static gates.** `npm run type-check` (only the 2 untracked nutrition specs may error), `npm run lint:check` (only the pre-existing statusline error).
- [ ] **Step 2: Grep for residual free-text exercise authoring in these tabs.** Run: `grep -nE "label=\"Nombre del Ejercicio\"|label=\"URL Video" components/dashboard/client-profile/tabs/workouts-tab.tsx components/dashboard/client-profile/tabs/cardio-tab.tsx` → expect NO hits (those inputs are replaced by the picker).
- [ ] **Step 3: Manual smoke (use the `/run` or `/verify` skill).** As a trainer on a client's Training tab: (a) Add exercise → must pick from library, can't free-text; per-session fields prefill from defaults; save works. (b) Edit exercise → picker pre-selected to current exercise; swap to a different library exercise → if the client has logs, the warning appears; save → the session now shows the new exercise's name/video; the shared library exercise is unchanged elsewhere. (c) Repeat on the Cardio tab, including searching a term that's beyond the initial fetch (verifies server-side search). (d) Confirm category guard: the cardio picker only lists cardio exercises (and the API rejects a mismatched id).
- [ ] **Step 4: Report results** (paste type-check/lint output and a short note on each manual check). If any manual check fails, treat as a bug and fix before claiming done.

---

## Self-Review Checklist (run before handoff)

- **Spec coverage:** pick-only edit (Tasks 3/5), swap = exercise_id not overwrite (Task 1), allow+warn on logged swap (Tasks 3/5 Step 3), Edit+Add both tabs (Tasks 3/4/5), library-screen-only new exercises (Task 6 pointer + no free-text), cardio search parity (Task 4), category+ownership guards (Task 1), no migration. ✅
- **Naming:** PUT query param = session_exercise row id (`sessionExerciseRowId`); body `exerciseId` = library target. Task 1 renames the PUT local to avoid the clash. ✅
- **Downstream untouched:** no edits to client/trainer read views — they resolve via the join. ✅
- **Type consistency:** `CreateExerciseRequest.exerciseId` (Task 2) matches what both tabs send and what POST/PUT read. ✅
- **Gotcha flagged:** cardio rendered exercise object must carry `exercise_id` for pre-selection (Task 5 Step 1).
