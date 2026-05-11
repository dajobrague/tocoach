# Weight Chart from Custom Form Questions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers explicitly point the weight chart at a numeric question from either the check-in form or the daily-habits form, replacing the current key-matching heuristic that does not match the seeded `body_weight` question id.

**Architecture:** The chart system already supports a `form_question` `DataSourceRef` end-to-end (registry, adapter, API, picker, edit panel). The work here is three small surgical changes plus a starter-doc flip: (1) make form-question adapter ids include `form_type` so the same `question_id` in check-ins and habits show up as **two** distinct picker entries; (2) update the two id-parsing helpers in the UI that today derive `form_type` from `category`; (3) remove the catalog `weight` adapter from runtime (keep its enum literal so legacy stored docs still parse and render orphan empty-state); (4) flip the starter document so new trainers get a weight chart that points at `form_q:checkins:body_weight`. Existing trainers' templates with `{kind:"catalog", id:"weight"}` will render orphan until the trainer reconfigures — explicit decision from the product side, no data migration.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), HeroUI v2, zod, Supabase, TanStack Query.

**Verification model:** This codebase has **no automated test framework configured**. Every task uses these verification gates instead of TDD:

- `npm run type-check` — strict TypeScript pass, must be clean.
- `npm run lint:check` — ESLint CI mode, must be clean.
- Manual flow in `npm run dev` for the final integration tasks.

Do **not** introduce a test framework as part of this work — out of scope.

---

## File Structure

**Files modified (no new files except the plan itself):**

| File                                          | Responsibility                                                                                                                                 | Lines touched                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `lib/charts/adapters/form-question.ts`        | Form-question adapter; widen stable id to include `form_type`                                                                                  | 38–59                                                               |
| `lib/charts/adapters/catalog.ts`              | Remove the `weight` adapter from the catalog runtime; remove the now-unused `resolveWeightAnswer` and merge-from-both-forms logic              | 120–174, plus removal from `CATALOG_ADAPTERS` array near the bottom |
| `components/charts/edit-panel.tsx`            | Rewrite `adapterKey` and `refFromAdapter` to parse `form_q:<form_type>:<question_id>` from the id directly                                     | 96–138                                                              |
| `components/charts/surface/chart-surface.tsx` | Same parsing change in `buildAddChartConfig`; add "Check-in" / "Hábitos" subtitle to form-question rows in `AddChartCard`                      | 72–100, 762–800                                                     |
| `lib/charts/starter.ts`                       | Flip the seeded weight chart from `{kind:"catalog", id:"weight"}` to `{kind:"form_question", form_type:"checkins", question_id:"body_weight"}` | 42–47                                                               |

**Files explicitly NOT touched:**

- `lib/charts/types.ts` — keep `"weight"` in the `CatalogId` union.
- `lib/charts/validation.ts` — keep `"weight"` in `catalogIdSchema`. Both are kept so existing stored chart docs still parse cleanly; they will resolve to `undefined` via the registry and render the existing orphan empty-state.
- `supabase/migrations/083_create_chart_system.sql` — already applied; user explicitly opted out of a data migration. Existing trainer templates will surface the orphan card on the weight chart until the trainer reconfigures.

---

## Pre-flight

- [ ] **Step P1: Confirm the working tree is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step P2: Sanity-check baseline type-check passes**

Run: `npm run type-check`
Expected: no errors. If there are pre-existing errors, do NOT attempt to fix them in this plan — report them to the user and stop.

- [ ] **Step P3: Sanity-check baseline lint passes**

Run: `npm run lint:check`
Expected: no errors. Same rule as above for pre-existing issues.

---

## Task 1: Disambiguate form-question adapter ids with form_type

**Why:** Today `buildFormQuestionAdapter` returns metadata id `form_q:${questionId}`. The seeded `body_weight` question exists in **both** the check-in and the daily-habit templates (migrations 020 + 087), so `listAvailableSources` dedupes via `seen.has(a.metadata.id)` in `lib/charts/registry.ts:154-171` and the trainer only sees one of them. Including `form_type` in the id makes the two coexist.

**Files:**

- Modify: `lib/charts/adapters/form-question.ts:38-59`

- [ ] **Step 1.1: Widen the adapter id**

In `lib/charts/adapters/form-question.ts`, change line 49 from:

```ts
const id = `form_q:${spec.questionId}`;
```

to:

```ts
const id = `form_q:${spec.formType}:${spec.questionId}`;
```

Update the JSDoc block at the top of the file (lines 1–14) to reflect the new id shape. Replace the existing JSDoc with:

```ts
/**
 * Form-question adapter — dynamically built per (form_type, question_id)
 * from the trainer's form_templates.questions_config.
 *
 * Always 1-D. Bucketing uses the same averaging path as the catalog 1-D
 * adapters, except the resolver looks up `answers[question_id]` directly
 * (no heuristic — we trust the question_id stored in the chart config).
 *
 * The metadata id is `form_q:<form_type>:<question_id>` so the same
 * question_id existing in both check-in and daily-habit templates produces
 * two distinct adapters (and two distinct picker entries). DataSourceRef
 * carries `form_type` separately, which is the contract the validator,
 * the snapshot route, and the UI parsers rely on.
 *
 * If the question gets deleted or has its type changed away from numeric,
 * the surface will see no data come through and render the orphan
 * empty-state. The registry's `listAvailableSources` is what decides
 * whether to expose a question in the picker; this adapter just produces
 * empty-or-real buckets for whatever it's pointed at.
 */
```

- [ ] **Step 1.2: Verify the only consumers of the old id shape**

Run: `grep -rn "form_q:" /Users/davidbracho/top_coach/{lib,components,app} --include='*.ts' --include='*.tsx'`

Expected: matches in only these files (we'll fix the UI ones in later tasks):

- `lib/charts/adapters/form-question.ts` (this task, already updated)
- `components/charts/edit-panel.tsx` (Task 2)
- `components/charts/surface/chart-surface.tsx` (Task 2)

If any other file appears, stop and report — it likely consumes the old shape and will break.

- [ ] **Step 1.3: Type-check passes**

Run: `npm run type-check`
Expected: no errors related to this change. (The UI files still parse the old shape — they will continue to work for the catalog path; the form-question parsing path is broken until Task 2, but TypeScript can't see that.)

- [ ] **Step 1.4: Commit**

```bash
git add lib/charts/adapters/form-question.ts
git commit -m "refactor(charts): include form_type in form-question adapter id"
```

---

## Task 2: Update the two UI parsers that derive form_type from category

**Why:** `adapterKey` / `refFromAdapter` in `edit-panel.tsx` and `buildAddChartConfig` in `chart-surface.tsx` reconstruct `form_type` from `source.category` (`"checkin" → "checkins"`, `"habit" → "habits"`). Now that the id itself contains `form_type`, parse from the id and drop the category-based derivation — more direct, no dependency on the category convention.

**Files:**

- Modify: `components/charts/edit-panel.tsx:96-138`
- Modify: `components/charts/surface/chart-surface.tsx:72-100`

- [ ] **Step 2.1: Add a tiny shared parser**

In `lib/charts/adapters/form-question.ts`, add an exported helper at the bottom of the file (after the `buildFormQuestionAdapter` export):

```ts
/**
 * Parse a `form_q:<form_type>:<question_id>` adapter id back into its
 * constituent parts. Returns null when the input is not a form-question
 * adapter id (catalog ids, malformed ids).
 */
export function parseFormQuestionAdapterId(
  id: string
): { formType: "checkins" | "habits"; questionId: string } | null {
  if (!id.startsWith("form_q:")) return null;
  const rest = id.slice("form_q:".length);
  const sep = rest.indexOf(":");

  if (sep <= 0) return null;
  const formType = rest.slice(0, sep);

  if (formType !== "checkins" && formType !== "habits") return null;
  const questionId = rest.slice(sep + 1);

  if (questionId.length === 0) return null;

  return { formType, questionId };
}
```

- [ ] **Step 2.2: Use the parser in `edit-panel.tsx`**

In `components/charts/edit-panel.tsx`, replace the existing `adapterKey` and `refFromAdapter` (lines 102–138) with:

```ts
function adapterKey(source: ChartDataSource): string {
  // For form-question sources, the id already encodes form_type and is
  // identical to what `dataSourceRefKey` produces for the corresponding
  // DataSourceRef — no reconstruction needed. Catalog ids get the prefix
  // here so the two namespaces don't collide in the Select.
  if (source.id.startsWith("form_q:")) return source.id;

  return `catalog:${source.id}`;
}

function refFromAdapter(source: ChartDataSource): DataSourceRef {
  if (source.id.startsWith("form_q:")) {
    const parsed = parseFormQuestionAdapterId(source.id);

    if (!parsed) {
      // Defensive — the data-sources endpoint should never emit malformed
      // ids. Falling back to a catalog ref would silently swap source kind,
      // so throw instead so the UI surfaces it loudly.
      throw new Error(`Malformed form-question adapter id: ${source.id}`);
    }

    return {
      kind: "form_question",
      form_type: parsed.formType,
      question_id: parsed.questionId,
    };
  }

  return {
    kind: "catalog",
    id: source.id as ChartConfig["source"] extends infer S
      ? S extends { kind: "catalog"; id: infer I }
        ? I
        : never
      : never,
  };
}
```

And add the new import near the existing imports at the top of the file (after the `resolveColor` import on line 45):

```ts
import { parseFormQuestionAdapterId } from "@/lib/charts/adapters/form-question";
```

Note: `dataSourceRefKey` at lines 96–100 stays exactly as-is — it already produces the matching shape `form_q:${ref.form_type}:${ref.question_id}`.

- [ ] **Step 2.3: Use the parser in `chart-surface.tsx`**

In `components/charts/surface/chart-surface.tsx`, replace the body of `buildAddChartConfig` (lines 72–100) with:

```ts
function buildAddChartConfig(
  source: ChartDataSource,
  position: number
): ChartConfig {
  const isMulti = source.dimensions === "multi";
  let ref: ChartConfig["source"];

  if (source.id.startsWith("form_q:")) {
    const parsed = parseFormQuestionAdapterId(source.id);

    if (!parsed) {
      throw new Error(`Malformed form-question adapter id: ${source.id}`);
    }
    ref = {
      kind: "form_question",
      form_type: parsed.formType,
      question_id: parsed.questionId,
    };
  } else {
    ref = { kind: "catalog", id: source.id as never };
  }

  return {
    id: newChartId(),
    position,
    label: source.label.toUpperCase(),
    source: ref,
    chart_type: source.default_chart_type,
    color: source.default_color,
    aggregation:
      isMulti && source.default_chart_type === "ring"
        ? "range_total"
        : "checkin_period",
  };
}
```

And add the import after the existing `resolveAdapter` import on line 53:

```ts
import { parseFormQuestionAdapterId } from "@/lib/charts/adapters/form-question";
```

- [ ] **Step 2.4: Type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 2.5: Lint passes**

Run: `npm run lint:check`
Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add lib/charts/adapters/form-question.ts components/charts/edit-panel.tsx components/charts/surface/chart-surface.tsx
git commit -m "refactor(charts): parse form_type from adapter id instead of category"
```

---

## Task 3: Show "Check-in" / "Hábitos" subtitle on form-question rows in the picker

**Why:** Once `body_weight` appears twice in the picker (once per form), the trainer needs to tell them apart. The existing rows show only `label` and `unit`. Add a small form-type badge so it's obvious which one is which.

**Files:**

- Modify: `components/charts/surface/chart-surface.tsx:762-800` (the `AddChartCard` list)
- Modify: `components/charts/edit-panel.tsx:306-318` (the Select inside the edit panel — same subtitle so the trainer sees it in both surfaces)

- [ ] **Step 3.1: Helper for the form-type label**

In `components/charts/surface/chart-surface.tsx`, near the top of the file (just below the `buildAddChartConfig` function added in Task 2), add:

```ts
function formTypeLabel(source: ChartDataSource): string | null {
  if (!source.id.startsWith("form_q:")) return null;
  if (source.category === "checkin") return "Check-in";
  if (source.category === "habit") return "Hábitos";

  return null;
}
```

- [ ] **Step 3.2: Render the subtitle in `AddChartCard`**

In `components/charts/surface/chart-surface.tsx`, locate the `filtered.map` block in `AddChartCard` (around lines 772–791) and replace the button content with a version that includes the form-type badge:

```tsx
{
  filtered.map((s) => {
    const ft = formTypeLabel(s);

    return (
      <button
        key={s.id}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-default-100 rounded text-left text-xs"
        type="button"
        onClick={() => {
          void onAdd(s.id);
          setOpen(false);
          setFilter("");
        }}
      >
        {s.icon ? <Icon icon={s.icon} width={14} /> : null}
        <span className="flex-1">{s.label}</span>
        {ft ? (
          <span className="text-[9px] uppercase tracking-wider text-foreground/50 bg-default-100 px-1.5 py-0.5 rounded">
            {ft}
          </span>
        ) : null}
        {s.unit ? (
          <span className="text-foreground/40 text-[10px]">{s.unit}</span>
        ) : null}
      </button>
    );
  });
}
```

- [ ] **Step 3.3: Render the subtitle inside the edit-panel Select**

In `components/charts/edit-panel.tsx`, replace the `sources.map` content inside the "Métrica" Select (lines 306–318) with:

```tsx
{
  sources.map((s) => {
    const ft = s.id.startsWith("form_q:")
      ? s.category === "checkin"
        ? "Check-in"
        : s.category === "habit"
          ? "Hábitos"
          : null
      : null;

    return (
      <SelectItem key={adapterKey(s)} textValue={s.label}>
        <div className="flex items-center gap-2">
          {s.icon ? <Icon icon={s.icon} width={14} /> : null}
          <span>{s.label}</span>
          {ft ? (
            <span className="text-[9px] uppercase tracking-wider text-foreground/50 bg-default-100 px-1.5 py-0.5 rounded">
              {ft}
            </span>
          ) : null}
          {s.unit ? (
            <span className="text-foreground/40 text-[10px]">({s.unit})</span>
          ) : null}
        </div>
      </SelectItem>
    );
  });
}
```

- [ ] **Step 3.4: Type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3.5: Lint passes**

Run: `npm run lint:check`
Expected: no errors.

- [ ] **Step 3.6: Commit**

```bash
git add components/charts/surface/chart-surface.tsx components/charts/edit-panel.tsx
git commit -m "feat(charts): show form-type badge on form-question sources in picker"
```

---

## Task 4: Disable the catalog `weight` adapter at runtime

**Why:** The current catalog `weight` adapter uses `resolveByKey(["weight","peso","weight_kg","peso_kg"])` and **does not** match the seeded `body_weight` id. Trainers asking "why doesn't weight show up?" are correct — it never matched the default seed. The decision is to remove the heuristic path and route weight exclusively through form-question selection. Keep `"weight"` in the type union and zod enum so legacy stored docs still parse; `resolveAdapter` returns `undefined` for unknown catalog ids → chart-surface renders the existing `orphan` empty state and the trainer reconfigures.

**Files:**

- Modify: `lib/charts/adapters/catalog.ts:120-174` (delete the weight adapter block)
- Modify: `lib/charts/adapters/catalog.ts` (find the `CATALOG_ADAPTERS` array and remove the `weight` entry)
- Modify: `lib/charts/adapters/catalog.ts` (find the `CATALOG_BY_ID` map and remove the `weight` entry; if it's built from `CATALOG_ADAPTERS`, no extra change needed)

- [ ] **Step 4.1: Locate the export site**

Run: `grep -n "CATALOG_ADAPTERS\|CATALOG_BY_ID\|^const weight\|export.*weight" /Users/davidbracho/top_coach/lib/charts/adapters/catalog.ts`

Note the line numbers of:

- The `weight` adapter definition (currently around line 133).
- The `CATALOG_ADAPTERS` array literal.
- The `CATALOG_BY_ID` map literal (or factory).

Expected output should resemble:

```
133:const weight: DataAdapter = {
... (CATALOG_ADAPTERS line)
... (CATALOG_BY_ID line)
```

- [ ] **Step 4.2: Delete the weight adapter and its helper**

In `lib/charts/adapters/catalog.ts`, remove:

- The entire `const resolveWeightAnswer = resolveByKey([...])` block (lines 127–132).
- The entire `const weight: DataAdapter = { ... };` block (lines 133–174).
- The header comment immediately above (lines 120–126), since it documents the now-deleted special-case merge.

Replace those ~55 lines with a short legacy comment so the reader understands why the catalog id `"weight"` still appears in the type union but no adapter exists:

```ts
// Note: there is no `weight` adapter on purpose. The catalog id literal
// `"weight"` is retained in CatalogId / catalogIdSchema so stored docs
// from before 2026-05 still parse, but the adapter has moved to a
// per-trainer form-question source (see lib/charts/starter.ts). Legacy
// charts pointing at {kind:"catalog", id:"weight"} resolve to undefined
// here and render the orphan empty-state in ChartCard — the trainer
// then deletes / re-adds the chart pointing at their body_weight
// question.
```

- [ ] **Step 4.3: Remove `weight` from `CATALOG_ADAPTERS`**

In the same file, locate the `CATALOG_ADAPTERS` array (likely near the bottom). Remove the `weight` entry from it. If `CATALOG_BY_ID` is a separate hand-written map, also remove `weight` from there; if it's derived from `CATALOG_ADAPTERS` (e.g. `new Map(CATALOG_ADAPTERS.map(a => [a.metadata.id, a]))`), no change needed.

- [ ] **Step 4.4: Type-check passes**

Run: `npm run type-check`
Expected: no errors. The type union still includes `"weight"`, so any code that referenced it by literal is still valid; only the runtime adapter is gone.

- [ ] **Step 4.5: Confirm `resolveAdapter` returns undefined for legacy weight**

This is a quick interactive sanity check. Add a temporary console.log in `lib/charts/registry.ts` `resolveAdapter` for one render, OR run a one-liner via `tsx`:

```bash
npx tsx -e 'import("./lib/charts/registry.ts").then(m => console.log(m.resolveAdapter({kind:"catalog", id:"weight"})))'
```

Expected: `undefined`.

If `npx tsx` isn't available in the project, skip this micro-check — the type-check already proves the adapter is gone from the map.

- [ ] **Step 4.6: Lint passes**

Run: `npm run lint:check`
Expected: no errors. There may be a "removed unused import" autofix for `resolveByKey` if `weight` was its only consumer left — accept it.

- [ ] **Step 4.7: Commit**

```bash
git add lib/charts/adapters/catalog.ts
git commit -m "refactor(charts): remove catalog weight adapter; route weight through form_question"
```

---

## Task 5: Flip the starter weight chart to a form-question source

**Why:** The lazy-create path for trainers without a `trainer_chart_templates` row (`/api/charts/template` GET) and the "Restaurar default" button both call `buildStarterDocument`. With Task 4 done, the seeded `{kind:"catalog", id:"weight"}` would render orphan. Repoint the starter at `{kind:"form_question", form_type:"checkins", question_id:"body_weight"}` so any trainer hitting the lazy-create path gets a working weight chart out of the box.

**Files:**

- Modify: `lib/charts/starter.ts:42-47`

- [ ] **Step 5.1: Update the starter weight entry**

In `lib/charts/starter.ts`, replace the first entry of the array returned by `buildStarterCharts` (lines 38–47) with:

```ts
    {
      id: randomUUID(),
      position: 0,
      label: "PESO",
      source: {
        kind: "form_question",
        form_type: "checkins",
        question_id: "body_weight",
      },
      chart_type: "area",
      color: "weight-amber",
      aggregation: "checkin_period",
    },
```

Also update the file-level JSDoc at the top (lines 1–15). Replace the existing block with:

```ts
/**
 * Starter chart template — the seven charts that exactly reproduce today's
 * client dashboard (PESO, CALORÍAS, PROTEÍNA, HIDRATOS, GRASAS, SUEÑO,
 * ENTRENAMIENTO).
 *
 * PESO points at the `body_weight` question seeded in the check-in form
 * template (migrations 020 + 087). Each trainer can repoint it to a
 * different numeric question — or to the daily-habit `body_weight` — via
 * the chart editor.
 *
 * The migration (083_create_chart_system.sql) seeded an older shape that
 * used `{kind:"catalog", id:"weight"}`; that adapter was removed in the
 * 2026-05 cleanup. Trainers whose template was created before this change
 * will see the weight chart in its orphan empty-state until they delete
 * and re-add it via the picker.
 *
 * This TS factory is used by:
 *   - the lazy-create path in /api/charts/template GET (for trainers
 *     created after the migration ran, or whose row is missing)
 *   - the trainer template page's "Restore defaults" button when the
 *     template is empty
 */
```

- [ ] **Step 5.2: Type-check passes**

Run: `npm run type-check`
Expected: no errors. `DataSourceRef` already accepts the `form_question` variant.

- [ ] **Step 5.3: Lint passes**

Run: `npm run lint:check`
Expected: no errors.

- [ ] **Step 5.4: Commit**

```bash
git add lib/charts/starter.ts
git commit -m "feat(charts): seed weight chart from body_weight check-in question"
```

---

## Task 6: Manual integration verification

**Why:** No automated tests in this codebase. The five preceding tasks each verify type-check and lint; this task is the end-to-end walkthrough that exercises the three flows the change touches (new trainer, existing trainer with stored catalog weight, client-readonly view).

**Tooling:** `npm run dev`, browser, two test accounts. If there are no test accounts on the local Supabase, the verification can be done against the staging environment — coordinate with the user before doing this.

- [ ] **Step 6.1: Start the dev server**

Run: `npm run dev`
Expected: server up on `http://localhost:3000`, no compile errors in the terminal.

- [ ] **Step 6.2: Verify flow A — trainer with the legacy seed**

Open the existing trainer account whose `trainer_chart_templates` row was created by migration 083 (the one with `{kind:"catalog", id:"weight"}` stored). Navigate to `/trainer/dashboard/charts-template`.

Expected:

- The weight chart card appears in the grid.
- It renders the **orphan empty-state** (the existing UX when `resolveAdapter` returns undefined; lives in `ChartCard` and is gated by the `orphan` prop wired at `chart-surface.tsx:591`).
- No console errors.
- All other charts (calories, protein, etc.) render normally.

Click the edit (pencil) overlay on the orphan weight card. Expected: edit panel opens, the "Métrica" select shows the current value as an empty / unmatched state. The trainer can pick a new source from the dropdown, including:

- `Peso Corporal` with the `Check-in` badge.
- `Peso Corporal` with the `Hábitos` badge.

Pick the **check-in** option. Close the panel. Expected: autosave kicks in ("Guardando…" → "Cambios guardados") and the chart card now reads data and renders correctly.

- [ ] **Step 6.3: Verify flow B — brand-new trainer**

Create a fresh trainer account (or delete the existing trainer's `trainer_chart_templates` row via Supabase Studio to force the lazy-create path). Navigate to `/trainer/dashboard/charts-template`.

Expected:

- The starter document is created on first GET.
- The weight chart is present in position 0, labeled "PESO", color amber, aggregation `checkin_period`.
- It renders with demo data (this surface is `trainer-template` mode, which uses synthesized buckets — see `chart-surface.tsx:251-262`).
- No orphan state.

Click edit on the weight chart. Expected: "Métrica" select shows `Peso Corporal` with the `Check-in` badge highlighted.

- [ ] **Step 6.4: Verify flow C — picker disambiguation**

From the same trainer (flow B account), in the chart-template page, click "Añadir gráfica" then start typing "peso" in the search input.

Expected: two results appear, both labeled "Peso Corporal" but one with a `Check-in` badge and one with a `Hábitos` badge. Neither has the catalog `solar:body-bold` icon (form-question adapters don't set `icon` — this is acceptable; the trainer can pick a color in the edit panel).

Pick the Hábitos option. Expected: a new chart is added pointing at `form_q:habits:body_weight`. Edit it and confirm the "Métrica" select shows the Hábitos option as the active value.

- [ ] **Step 6.5: Verify flow D — client-readonly**

Switch to a client account whose trainer has reconfigured the weight chart (flow A account, after fixing the orphan). Open the client portal at `/<slug>/dashboard` (or wherever charts render for clients — `components/client-dashboard/charts-section.tsx`).

Expected:

- The weight chart renders with the client's actual `body_weight` answers from `form_responses`.
- If the client has logged weights in their check-in submissions, the area chart populates accordingly.
- No console errors.

- [ ] **Step 6.6: Verify the snapshot endpoint accepts the new ref**

The snapshot endpoint at `app/api/charts/clients/[clientId]/snapshot/route.ts` reads both `checkins` and `habits` form responses regardless of which chart references which (see `loadFormResponses` lines 147–169). No code change should be needed there — verify by tailing the dev server logs while flow D is running and confirming there are no 4xx/5xx responses from `/api/charts/clients/<id>/snapshot`.

- [ ] **Step 6.7: Stop the dev server**

Stop the `npm run dev` process.

- [ ] **Step 6.8: Final type-check and lint sweep**

Run, in parallel:

- `npm run type-check`
- `npm run lint:check`

Expected: both clean.

- [ ] **Step 6.9: No code commit for this task**

This task is verification-only. If any of the manual flows surfaced a regression, file it as a follow-up — do not fold a fix into this plan's commits without re-running the affected task's verification gate.

---

## Out of scope (explicit non-goals)

These came up during design and were ruled out — listed here so the reader doesn't second-guess the plan:

- **Data migration of existing `{kind:"catalog", id:"weight"}` rows.** User decision: trainers reconfigure manually. No `supabase/migrations/089_*` will be written by this plan.
- **Generalizing the form-question source approach to other catalog metrics** (sleep, calories, etc.). User decision: only weight, ship it, evaluate, then iterate.
- **Multi-source merge** (one chart pulling weight from check-ins AND habits simultaneously). The current architecture allows one `DataSourceRef` per chart; if the trainer wants both, they add two charts. Generalizing to multi-source requires a `DataSourceRef[]` shape and validator changes — defer.
- **Heuristic auto-detection of "weight-like" questions.** Replaced by explicit trainer selection.
- **Restoring the `solar:body-bold` icon and `weight-amber` color automatically for form-question weight charts.** The starter already applies these on the seeded one; trainers re-adding manually will pick a color (amber is in the palette). Adding per-question default icon/color is a separate UX improvement.
- **Introducing a test framework (vitest/jest).** Out of scope, would more than double the work, and the user did not ask for it.

---

## Self-review checklist

After implementation completes:

1. **Spec coverage** — every user-stated requirement is mapped to a task:

   - "Trainer picks form (check-in / hábitos)" → Tasks 1, 3 (badge + adapter disambiguation).
   - "Trainer picks the numeric question" → Existing infrastructure surfaced via Task 3 picker UX.
   - "Only for weight, for now" → Task 4 disables only the weight catalog adapter; other catalog metrics untouched. Task 5 changes only the starter weight chart.
   - "Existing trainers reconfigure themselves" → Tasks 4 and 5 explicitly leave legacy stored docs orphan, no migration.

2. **Placeholder scan** — every step has either a verification command with expected output, an exact code block to apply, or a navigational step with the expected UX outcome. No "TODO", no "implement appropriately", no unfilled error handling.

3. **Type consistency** — `parseFormQuestionAdapterId` returns `{ formType, questionId }` (camelCase). Tasks 2.2 and 2.3 use exactly those property names. The `DataSourceRef` shape stays as defined in `lib/charts/types.ts:115-117` (`form_type` snake_case, `question_id` snake_case) — the parser bridges the two conventions inside the helper.

4. **Verification gate per task** — every task ends with `npm run type-check` + `npm run lint:check` + a focused commit. Task 6 adds the end-to-end manual sweep.

---

## Risks and mitigations

| Risk                                                                                                                                                                  | Mitigation                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trainer doesn't notice the orphan weight chart and assumes the feature is broken.                                                                                     | Out-of-scope for code; flag to product so a release note / in-app banner is sent.                                                                                                 |
| The seeded `body_weight` question is disabled (`enabled: false`) on a particular trainer's template, making the form-question adapter silently produce empty buckets. | The picker filters by `enabled !== false` (`registry.ts:133`). If disabled, the source disappears from the picker but stays in the stored chart — orphan UX kicks in. Acceptable. |
| `parseFormQuestionAdapterId` throws on malformed ids in production.                                                                                                   | Only called on ids produced by `buildFormQuestionAdapter`. Defensive throw is preferred over silent fallback (would swap source kind under the trainer's feet).                   |
| Existing `client_chart_configs` overrides with legacy weight catalog source persist across the deploy.                                                                | Per user decision, these render orphan until the client's trainer manually resets / reconfigures. No code action required.                                                        |

---

**End of plan.**
