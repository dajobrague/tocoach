# Nutrition v2 — Architecture & Development Plan

> Engineering architecture for the recipe-first nutrition rebuild. Companion to `nutrition-redesign-brainstorm.md`. Production system — see §11 for the non-negotiable safety rules. No code is written yet; this is the blueprint we build the plan from.

---

## 1. Principles (decided)

- **Recipe-first.** A recipe is a reusable library object. Plans _reference_ recipes; they never copy them.
- **Surgical, not teardown.** Reuse what already works (storage buckets, upload routes, the single-query tree-fetch pattern, option-selection telemetry, macro-visibility toggles). Build the new model alongside the old; delete legacy only after per-trainer cutover.
- **Snapshot at assignment.** Recipe edits affect only _future_ assignments. A recipe already placed in a client's plan is frozen.
- **Adherence tracking only (v1).** Did the client eat the planned meal — yes / something else / skipped — plus photo and comment. No client-side food search/counting.
- **One recipe = one serving.** No portion scaling in v1.
- **Swappable food source.** Open Food Facts (free) behind an adapter interface; the app never calls a vendor directly. Manual entry always available. Every looked-up food is cached locally.
- **Per-trainer rollout.** One trainer per tenant. New system ships behind a per-trainer flag; old and new coexist until a trainer's last client rolls off, then legacy code for that trainer is removed.
- **Production-safe migrations.** Additive only, numbered sequentially, RLS on every new table, no destructive drops until cutover.

---

## 2. Settled decisions (quick reference)

| Topic             | Decision                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| Model             | Recipe-first; recipes are library objects, plans reference them                      |
| Reuse vs rebuild  | Reuse infra/patterns; replace the ownership model                                    |
| Recipe edits      | Affect future assignments only (snapshot at assignment)                              |
| Tracking          | Adherence only (eat / other / skip + photo + comment)                                |
| Serving           | 1 recipe = 1 serving                                                                 |
| Food API          | Open Food Facts (free) behind swappable adapter + local cache + manual entry         |
| Nutrients         | calories, protein, carbs, fat, sugar, fiber, sat-fat, sodium                         |
| Meals             | Flexible, 1–10+ per day, trainer-defined labels                                      |
| Tenant            | One trainer per tenant                                                               |
| Cycle vs calendar | Repeating cycle base now; calendar/notes overlay is the LAST phase                   |
| Slot content      | A slot option is a recipe **or** a single raw food (drag "recetas o alimentos")      |
| Shopping list     | Auto-generated from the cycle's ingredients; rebuild of the current brittle one      |
| Equivalences      | Ingredient portion equivalences shown to client — include only if cheap              |
| Video             | Vertical video, reuse existing training-side compression pipeline                    |
| Migration         | Clean start + guided interactive recipe importer (approve → recipes built on screen) |
| Rollout           | Per-trainer flag; old+new coexist; remove legacy per trainer on full rolloff         |
| Success metrics   | In admin dashboard: trainer adoption, library depth, client logging over time        |

---

## 3. System shape

Three layers, cleanly separated, each protected from upstream change by a snapshot boundary:

```
  FOOD SOURCE (external)              LIBRARY (trainer)            PLAN (per client)             LOG (client)
  ┌─────────────────┐   cache   ┌──────────────────┐   snapshot ┌─────────────────┐         ┌──────────────┐
  │ Open Food Facts │ ───────►  │ ingredients      │            │ meal_cycles     │         │ meal_logs    │
  │ (adapter)       │           │ recipes          │ ─────────► │ meal_slots      │ ──────► │ (adherence)  │
  │ + manual entry  │           │ recipe_ingredients│  at assign │ meal_slot_options│  reads  │ photo+comment│
  └─────────────────┘           │ recipe_media     │            │ (recipe_snapshot)│         └──────────────┘
                                 └──────────────────┘            └─────────────────┘
        looked-up values            macros computed                frozen at assign            consumed vs target
        cached locally              & stored on recipe             (edits don't touch)         (query, not table)
```

Snapshot boundaries (why nothing silently mutates):

1. **Food source → ingredients:** looked-up values are cached; vendor data changing later doesn't move our numbers.
2. **Recipe → meal_slot_option:** recipe macros are frozen into the assignment; editing the recipe later only affects new assignments.
3. **Plan → meal_log:** what the client logged is captured at log time and never rewritten.

---

## 4. Data model

New tables, all `tenant_id`/`tenant_slug`-scoped with RLS, numbered migrations under `supabase/migrations/`. Column lists are the intended shape, not final DDL.

### Library layer

**`ingredients`** — local cache of food-source results + manual entries.

- `id`, `tenant_id`
- `source` (`'off'` | `'manual'`), `source_ref` (OFF id or barcode; null for manual)
- `name`, `brand` (nullable), `default_unit` (`'g'` default)
- Per-100g nutrients: `kcal`, `protein_g`, `carbs_g`, `fat_g`, `sugar_g`, `fiber_g`, `sat_fat_g`, `sodium_mg`
- `created_by`, `created_at`, `updated_at`
- _Note:_ explicit nutrient columns for the v1 set (simple, queryable, matches existing code). A `nutrient_extra jsonb` column is reserved so adding e.g. potassium later is non-breaking.

**`recipes`** — the atom. One recipe = one serving, so stored totals _are_ per-serving.

- `id`, `tenant_id`, `trainer_id`
- `name`, `description`, `instructions` (text), `prep_time_min`, `cook_time_min`
- `meal_type_tags` (text[] — breakfast/lunch/snack… for filtering)
- `status` (`'draft'` | `'active'` | `'archived'`)
- **Computed totals (denormalized):** `kcal`, `protein_g`, `carbs_g`, `fat_g`, `sugar_g`, `fiber_g`, `sat_fat_g`, `sodium_mg` — recomputed on any ingredient change
- `created_at`, `updated_at`

**`recipe_ingredients`** — recipe ↔ ingredient join, with frozen contribution.

- `id`, `recipe_id`, `ingredient_id` (nullable for pure free-text line)
- `name_snapshot` (so a recipe stays readable even if the ingredient row changes)
- `quantity`, `unit`
- `nutrient_snapshot` (the per-100g values used at the time of adding — keeps recipe totals stable)
- `sort_order`

**`recipe_media`** — photos + vertical videos. Reuses the training-side compression pipeline.

- `id`, `recipe_id`, `type` (`'image'` | `'video'`), `url`
- `orientation` (`'vertical'` | `'horizontal'`), `sort_order`, `created_at`

### Plan / cycle layer (mirrors `microcycles`)

**`meal_cycles`** — one active per client.

- `id`, `tenant_id`, `client_id`, `trainer_id`
- `name`, `duration_days` (1–28), `start_date`
- `status` (`'active'` | `'paused'` | `'archived'`)
- `created_at`, `updated_at`

**`meal_slots`** — flexible meals per day (1–10+), trainer-labeled.

- `id`, `cycle_id`, `day_index` (1..duration_days)
- `label` (e.g. "Desayuno"), `sort_order`

**`meal_slot_options`** — one or more options per slot; client picks one. An option is **either a recipe or a single raw food** (so "una manzana" doesn't force a one-ingredient recipe — matches the "recetas o alimentos" drag model).

- `id`, `slot_id`
- `item_type` (`'recipe'` | `'ingredient'`)
- `recipe_id` (nullable) · `ingredient_id` (nullable) — exactly one set, for traceability/link back to the library
- **`item_snapshot` (jsonb):** name, totals, steps/media refs (recipe) or quantity/unit/macros (ingredient) — **frozen at assignment.** The client view reads this, not the live recipe/ingredient.
- `sort_order`
- _This snapshot is what implements "edits affect future only."_ (A future upgrade path is true recipe versioning; jsonb snapshot is the pragmatic v1.)

### Log layer

**`meal_logs`** — adherence. Aggregation is a query/view, not a table.

- `id`, `tenant_id`, `client_id`, `slot_id` (nullable for off-plan), `date`
- `status` (`'eaten_planned'` | `'eaten_other'` | `'skipped'`)
- `chosen_option_id` (nullable), `comment` (nullable), `photo_url` (nullable)
- `logged_at`

### Calendar overlay (LAST phase only)

**`meal_cycle_overrides`** — notes / swaps on top of the repeating base.

- `id`, `cycle_id`, `scope` (`'date'` | `'day_forward'` | `'every_cycle'`)
- `target_date` (nullable), `day_index` (nullable), `slot_id` (nullable = day-level note)
- `type` (`'note'` | `'swap'`), `note_body` (nullable), `swap_recipe_id` (nullable)
- `created_at`

---

## 5. Ingredient food-source adapter (the swappable boundary)

A single internal interface. The app talks only to this; vendors sit behind it.

```ts
interface FoodSource {
  search(query: string, locale?: string): Promise<FoodResult[]>;
  getByBarcode(code: string): Promise<FoodResult | null>; // phase-2 use
  getByRef(sourceRef: string): Promise<FoodResult | null>;
}

interface FoodResult {
  source: "off";
  sourceRef: string; // OFF id / barcode
  name: string;
  brand?: string;
  defaultUnit: "g";
  nutrientsPer100g: {
    kcal;
    protein_g;
    carbs_g;
    fat_g;
    sugar_g;
    fiber_g;
    sat_fat_g;
    sodium_mg;
  };
}
```

- `OpenFoodFactsSource implements FoodSource` is the only implementation in v1.
- Selected by config: `NUTRITION_FOOD_SOURCE=off`. Swapping to FatSecret later = add `FatSecretSource`, flip the env var. No screen, route, or table changes.
- **Search flow:** query → check local `ingredients` cache first → if miss, call the adapter → present results → on pick, persist to `ingredients`. Subsequent uses are local hits (fast, free, offline-resilient).
- **Manual entry** writes an `ingredients` row with `source='manual'`. Always available; required for patchy LatAm coverage.

---

## 6. API surface

New namespace to keep blast radius isolated from legacy `/api/nutrition/*` (retired only at cutover).

**Library**

- `GET/POST /api/recipes` · `GET/PUT/DELETE /api/recipes/[id]`
- `POST /api/recipes/[id]/ingredients` · `PUT/DELETE /api/recipes/[id]/ingredients/[ingId]`
- `POST /api/recipes/[id]/media` (image/video upload)
- `GET /api/foods/search?q=` · `GET /api/foods/barcode/[code]` (adapter-backed)

**Cycle / assignment**

- `GET/POST /api/meal-cycles` · `GET/PUT/DELETE /api/meal-cycles/[id]`
- `POST /api/meal-cycles/[id]/slots` · `PUT/DELETE …/slots/[slotId]`
- `POST …/slots/[slotId]/options` (writes the recipe_snapshot) · `DELETE …/options/[optId]`

**Client**

- `GET /api/client/meal-cycle` (today + cycle, single tree-fetch like the existing `NUTRITION_TREE_SELECT` pattern)
- `POST /api/client/meal-logs` (log adherence + photo + comment)
- `GET /api/client/shopping-list?from=&to=` (ingredients rolled up across the cycle's meals for a date range; merges duplicates, sums quantities)

**Trainer adherence + admin**

- `GET /api/trainer/clients/[id]/adherence`
- `GET /api/admin/nutrition-metrics` (the success dashboard)

**Importer**

- `GET /api/recipes/import/preview` (scan legacy data → candidate recipes)
- `POST /api/recipes/import/approve` (create library recipes from approved candidates)

---

## 7. Storage

- New bucket **`recipe-media`** (images + vertical video), same RLS/API-layer-auth pattern as existing buckets. Keep separate from legacy `meal-images` so old/new stay cleanly separable for cleanup.
- Video uses the **existing training-side compression pipeline**; cost is covered by the trainer's plan.
- Path convention: `[tenant_id]/recipes/[recipe_id]/[uuid]`.

---

## 8. UX surfaces

**Trainer**

- _Recetas_ library (sibling to the exercise library): build/edit/list recipes, ingredient search with auto-macros, manual entry fallback, photo + vertical video upload, live macro rollup.
- _Cycle builder_ on the client profile (where nutrition lives today): duration + start date, add meals (slots) per day, drop one+ recipes into each slot as options. Feels like filling the microciclo grid.
- _Guided importer_: "We found N recipes in your old diets — review & approve," recipes populate the library on screen as approved.
- _Adherence view_ per client: logged vs planned, photos, comments.

**Client**

- _Today_ view mirroring the microciclo client view: today's cycle-day highlighted, meals in order, each showing option(s) with photo + macros (if enabled), tap-through to full recipe (ingredients, steps, vertical video).
- _Choose_ an option where offered.
- _Log_: eaten-as-planned / ate-something-else / skipped + optional photo + comment.

**Admin**

- _Nutrition metrics_ dashboard (§9).

---

## 9. Success metrics (admin dashboard)

Built from data already in the DB — a query + a screen, no third-party analytics.

1. **Trainer adoption** — % of trainers with ≥1 recipe AND ≥1 assigned cycle. Earliest signal the rebuild beat the old one.
2. **Library depth** — recipes per trainer over time (dabbling vs committed).
3. **Client engagement** — % of assigned clients logging, and meals-logged ÷ meals-planned per week, **tracked over time** (does logging survive past week 2?).
4. **Qualitative** — track whether the nutrition support complaints that drove this rebuild decline.

---

## 10. Phased delivery (build order + acceptance criteria)

Each phase is independently releasable. P2 and P3 both depend only on P1 and can run in parallel.

**P0 — Foundations (no UI impact).** Adapter interface + `OpenFoodFactsSource` + `ingredients` cache table + manual-entry path. _Done when:_ server can search foods, results cache locally, nothing client-visible.

**P1 — Recipe library.** `recipes`, `recipe_ingredients`, `recipe_media`; CRUD; ingredient-search UI; media upload via compression pipeline; live macro rollup. _Done when:_ a trainer builds, edits, and lists recipes with photos + vertical video and correct computed macros.

**P2 — Guided importer** (depends P1). Scan legacy data → review/approve screen → create library recipes on screen. _Done when:_ a trainer imports old recipes interactively and sees them appear in the library.

**P3 — Cycle builder & assignment** (depends P1; behind per-trainer flag). `meal_cycles`, `meal_slots`, `meal_slot_options` with snapshot-at-assignment. _Done when:_ a trainer assigns a flexible-meal cycle referencing library recipes, and edits to a recipe afterward do **not** change that assignment.

**P4 — Client view** (depends P3). Today view, options, recipe detail with vertical video, macro visibility toggle. _Done when:_ a client sees their cycle and today's meals correctly.

**P5 — Logging & tracking** (depends P4). `meal_logs`; client logging UI (eat/other/skip + photo + comment); trainer adherence view. _Done when:_ a client logs a meal and the trainer sees adherence.

**P6 — Shopping list + admin metrics** (depends P5). _Shopping list:_ roll up ingredients across the client's cycle for a date range, merge duplicates, sum quantities, client check-off (rebuild of today's brittle one, now on structured data). _Admin metrics:_ the four signals in §9. _Done when:_ a client opens an accurate shopping list for their week, and the metrics dashboard renders live numbers.

**P7 — Calendar / notes overlay** (depends P3; LAST). `meal_cycle_overrides`; date notes, swaps, scope (this day / forward / every cycle). _Done when:_ a trainer adds a date-specific note/swap and the client sees it.

_Optional polish (slot anywhere it's cheap):_ **ingredient equivalences** — show per-ingredient portion swaps on the client recipe view (e.g. "100 g pollo ≈ …"). Include only if low-cost; otherwise stays deferred.

**P8 — Cutover & legacy removal.** Per-trainer flag flips; old + new coexist; when a trainer's last client rolls off the old system, we receive the signal and remove that trainer's legacy `/api/nutrition/*` path and data. _Done when:_ legacy code/tables are retired with zero active users.

---

## 11. Production safety (non-negotiable)

- **Additive migrations only**, numbered sequentially (mind the historical duplicate `002_*`); **no destructive drops** of `nutrition_*` until P8 cutover with zero active users.
- **RLS on every new table**, tenant-scoped like the rest of the app; never rely on app-code-only isolation.
- **New API namespace** (`/api/recipes`, `/api/meal-cycles`, …); legacy `/api/nutrition/*` stays until cutover.
- **Per-trainer feature flag**; pilot with one or two friendly trainers before wider rollout.
- **Don't touch load-bearing bits:** `middleware.ts` routing/tenant scoping (only add new tables' policies), the service-worker cache headers, the standalone build's `copy-standalone` step.
- **Always run `npm run type-check` and `npm run lint:check` before deploy** — `build` skips both by design.
- **Snapshot integrity:** recompute-on-write for recipe totals; freeze on assignment and on log — verify these with tests, since they're the guarantees the whole model rests on.

---

## 12. Deferred / future (explicitly not v1)

- FatSecret paid source (add a `FoodSource` impl, flip config) — only if OFF data quality frustrates trainers.
- Barcode scanning (adapter already supports it; needs mobile UI).
- Full macro accounting of off-plan foods (tracking option "B").
- Portion/serving scaling.
- Multi-week cycle rotation (week A / week B).
- True recipe versioning (vs. the jsonb snapshot).
- TopCoach-curated global recipe library.

---

_Next step: convert P0–P1 into a concrete implementation ticket set (DDL, route stubs, adapter, UI), since those unblock everything else._
