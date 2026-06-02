# Nutrition v2 — Phased Backlog

> The build broken into phases and concrete tasks. Each task is sized to be a single PR. IDs are stable (`P1-T3`) so we can reference them. Every task inherits the merge gate from `nutrition-v2-coding-rules.md` (≤500-line files, type-check + lint clean, tests written and passing, RLS on new tables, behind the per-trainer flag). "Exit criteria" = the phase is shippable.
>
> Companion docs: `nutrition-architecture-and-plan.md` (the why/what), `nutrition-v2-coding-rules.md` (the how).

**Dependency map:** P0 → P1 → { P2, P3 } ; P3 → P4 → P5 → P6 ; P3 → P7 (last) ; P8 last. P2 and P3 can run in parallel after P1.

---

## P0 — Foundations & test harness

_Goal: testing infra + the food-source layer, with zero client-visible change._

- **P0-T1 — Install Vitest.** Config for unit + integration, `test` / `test:watch` scripts, coverage. First test asserts the runner works.
- **P0-T2 — Install Playwright.** Config, `test:e2e` script, one smoke test against a running dev server.
- **P0-T3 — Test DB strategy.** Wire integration tests to a Supabase branch/test project (never prod). Seed/teardown helpers, env wiring.
- **P0-T4 — CI hook.** Run type-check + lint:check + unit + integration on PR. (e2e can be a separate/manual job initially.)
- **P0-T5 — Per-trainer feature flag.** `nutrition_v2` flag plumbing (read in trainer + client contexts); default off. Tests.
- **P0-T6 — `FoodSource` interface + types.** Define interface and `FoodResult`/nutrient types. No impl yet.
- **P0-T7 — `ingredients` cache table.** Migration + RLS + indexes (tenant, source_ref, name search).
- **P0-T8 — `OpenFoodFactsSource`.** Implement `search` / `getByRef` / `getByBarcode` against the interface; HTTP layer mocked in tests; map OFF fields → our nutrient set.
- **P0-T9 — Food lookup service.** Cache-first: local hit → else adapter → persist to `ingredients`. Manual-entry creation path. Unit + integration tests (cache hit/miss/manual).
- **P0-T10 — Food API routes.** `GET /api/foods/search`, `GET /api/foods/barcode/[code]` + auth + tests.
- **P0-T11 — Generate TS types** from the new schema; commit.

**Exit:** server can search/resolve foods, results cache locally, suite + CI green, flag exists, nothing client-visible.

---

## P1 — Recipe library

_Goal: trainers build reusable recipes with macros, photos, vertical video._

- **P1-T1 — Migrations:** `recipes`, `recipe_ingredients`, `recipe_media` (+ RLS, indexes).
- **P1-T2 — `recipe-media` storage bucket** + upload route reusing the training-side compression pipeline; vertical orientation handled. Tests.
- **P1-T3 — Macro rollup (pure fn).** Recipe totals = Σ ingredient contributions (per-100g × qty), missing nutrient = 0. Exhaustive unit tests (fractions, missing, units). _(Invariant §4.2.)_
- **P1-T4 — Recompute-on-write.** Recipe totals recomputed whenever ingredients change (service or trigger). Integration test.
- **P1-T5 — Recipe CRUD API** (`/api/recipes`, `/api/recipes/[id]`): create/read/update/archive + auth/ownership + tests.
- **P1-T6 — Ingredient CRUD on recipe** (`/api/recipes/[id]/ingredients/...`) wired to recompute + tests.
- **P1-T7 — TS types** regenerate + domain types in `types/`.
- **P1-T8 — UI: recipe library page** (list, search, filter by meal-type tag).
- **P1-T9 — UI: recipe form** — split into `recipe-form`, `ingredient-search`, `ingredient-row`, `media-uploader`, `macro-summary` (each its own file; thin parent).
- **P1-T10 — UI: manual ingredient entry** fallback inside the search.
- **P1-T11 — e2e:** build a recipe (search → macros fill → upload media → save → appears in library).

**Exit:** a trainer creates/edits/lists recipes with correct macros, photos, and vertical video. Full nutrient set (incl. sugar/fiber/sat-fat/sodium) flows end to end.

---

## P2 — Guided recipe importer _(depends P1)_

_Goal: turn old diet content into new library recipes, on screen, with approval._

- **P2-T1 — Legacy scan service.** Read old `nutrition_*` rows, extract recipe candidates (name, ingredients, image, steps); best-effort, skip junk. Unit tests on the mapping.
- **P2-T2 — Import API:** `GET /api/recipes/import/preview` (candidates), `POST /api/recipes/import/approve` (creates library recipes) + auth + tests.
- **P2-T3 — UI: review & approve screen** — candidates listed, approve per item, recipes appear as they're created (the visible-effort moment).
- **P2-T4 — e2e:** import journey (preview → approve → recipes in library).

**Exit:** a trainer imports their old recipes interactively and watches the library populate.

---

## P3 — Cycle builder & assignment _(depends P1; flagged)_

_Goal: trainers assign a repeating meal cycle referencing library recipes/foods._

- **P3-T1 — Migrations:** `meal_cycles`, `meal_slots`, `meal_slot_options` (recipe **or** ingredient, with `item_snapshot`) + RLS, indexes.
- **P3-T2 — Snapshot-at-assignment service (pure + integration).** Freeze recipe/food into the option at assign time. _Invariant §4.1: edit recipe afterward → assignment unchanged; new assignment picks up edit._ This is the highest-priority test in the project.
- **P3-T3 — Cycle CRUD API** (`/api/meal-cycles...`): duration, start date, status, one active per client + tests.
- **P3-T4 — Slots & options API** (add/reorder/delete slots; add recipe or food as option) + tests.
- **P3-T5 — UI: cycle builder grid** — drag-and-drop with `@dnd-kit` (already in deps); flexible 1–10+ meals/day, custom labels. Split into files.
- **P3-T6 — UI: recipe/food picker** drawer (library search; drop recipe OR raw food).
- **P3-T7 — e2e:** assign a cycle + the snapshot-immutability journey.

**Exit:** a trainer builds and assigns a flexible cycle; recipe edits don't mutate existing assignments (proven e2e).

---

## P4 — Client view _(depends P3)_

_Goal: clients see today's meals and full recipes._

- **P4-T1 — Client fetch API.** `GET /api/client/meal-cycle` — today + cycle in a single tree-fetch (reuse the `NUTRITION_TREE_SELECT` pattern) + tests; client-only auth.
- **P4-T2 — UI: today view** — current cycle-day highlighted, meals in order, options shown, macros gated by visibility setting.
- **P4-T3 — UI: recipe detail** — ingredients w/ quantities, steps, **vertical video player**, photos.
- **P4-T4 — Option selection** (client picks one option per meal) persisted + tests.
- **P4-T5 — e2e:** client opens app → sees correct day/meals/recipe.

**Exit:** an assigned client sees their cycle, today's meals, and full recipe detail correctly.

---

## P5 — Logging & tracking _(depends P4)_

_Goal: clients log adherence; trainers see it._

- **P5-T1 — Migration:** `meal_logs` + RLS.
- **P5-T2 — Log photo upload** (bucket/route, client-scoped) + tests.
- **P5-T3 — Log API.** `POST /api/client/meal-logs` (eaten-planned / eaten-other / skipped + comment + photo) + tests; client can only log own meals (_invariant §4.4_).
- **P5-T4 — Adherence aggregation.** Query/view: logged vs planned per day/week. `GET /api/trainer/clients/[id]/adherence` + tests.
- **P5-T5 — UI: client log meal** (quick eat/other/skip + optional photo + comment).
- **P5-T6 — UI: trainer adherence view** (per client: logs, photos, comments, compliance over time).
- **P5-T7 — e2e:** client logs a meal w/ photo → trainer sees it.

**Exit:** clients log; trainers see adherence and photos.

---

## P6 — Shopping list + admin metrics _(depends P5)_

_Goal: client shopping list (rebuilt) + success dashboard._

- **P6-T1 — Shopping-list aggregation (pure fn).** Roll up ingredients across the cycle for a date range, merge duplicates, sum quantities by unit. Unit tests (_invariant §4.6_).
- **P6-T2 — Shopping-list API.** `GET /api/client/shopping-list?from=&to=` + tests.
- **P6-T3 — UI: client shopping list** with check-off (replaces the brittle current one).
- **P6-T4 — Admin metrics queries** — the four signals (trainer adoption, library depth, client logging over time, complaint trend hook).
- **P6-T5 — Admin API + dashboard UI.** `GET /api/admin/nutrition-metrics` + the dashboard screen + tests.
- **P6-T6 — e2e:** client opens an accurate shopping list.

**Exit:** accurate shopping list for a week; admin metrics render live.

---

## P7 — Calendar / notes overlay _(depends P3; LAST feature)_

_Goal: date-specific notes and swaps on top of the repeating cycle._

- **P7-T1 — Migration:** `meal_cycle_overrides` + RLS.
- **P7-T2 — Overrides API** (note/swap; scope: this day / forward / every cycle) + tests.
- **P7-T3 — UI: calendar view** of the client's plan; add note / swap / pick scope.
- **P7-T4 — Client view surfaces overrides** (date note inline; swap replaces the slot).
- **P7-T5 — e2e:** trainer adds a dated note/swap → client sees it on the right date.
- **P7-T6 — (Optional) ingredient equivalences** on the recipe view — only if low-cost; else defer.

**Exit:** trainers attach dated notes/swaps; clients see them correctly.

---

## P8 — Cutover & legacy removal

_Goal: roll out safely, then delete the old system._

- **P8-T1 — Rollout runbook + pilot.** Enable `nutrition_v2` for 1–2 friendly trainers; monitor.
- **P8-T2 — Coexistence verification.** Old and new render side by side without interference for non-flagged trainers.
- **P8-T3 — Legacy-rolloff signal.** Detect when a trainer's last client is off the old system; surface it.
- **P8-T4 — Remove legacy.** Delete `/api/nutrition/*`, the 5,618-line `nutrition-tab.tsx`, and old `nutrition_*` tables — **only after zero active users** (additive-then-drop).
- **P8-T5 — Final security/RLS review** (use a verification subagent): cross-tenant isolation, auth boundaries, storage policies across all new tables/buckets.

**Exit:** all trainers on v2, legacy code/tables retired, security signed off.

---

## Suggested first sprint

P0 in full (it unblocks everything and is invisible to users), then start P1-T1…T4 (schema + macro math + recompute) so the riskiest server logic is under test early. The first ticket to pick up is **P0-T1 (install Vitest)** — nothing else can satisfy the merge gate without it.
