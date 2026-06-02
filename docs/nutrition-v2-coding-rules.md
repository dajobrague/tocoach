# Nutrition v2 — Coding Rules

> Hard rules for the nutrition rebuild. The goal is one thing: **no soft spots that come back as trainer/client complaints.** These extend `docs/development/conventions.md` (naming, imports, commits, DB) — read that for style; this is about size, testing, and the invariants that _must_ hold.

---

## 0. Two facts that shaped these rules

Before the rules, two things found in the current codebase that explain why we need them:

1. **`components/dashboard/client-profile/tabs/nutrition-tab.tsx` is 5,618 lines.** That single file _is_ the problem we're rebuilding. It's unreadable, unreviewable, and untestable. It's the exhibit for the 500-line rule.
2. **There is no test harness. Zero.** `conventions.md` documents a testing style, but no test runner is installed (no Vitest/Jest/Playwright) and there are no test files in the repo. So "test everything at the server level" is not "write some tests" — it's "stand up testing infrastructure first." That's rule-zero work (§3).

---

## 1. File size — hard cap 500 lines

**No hand-written file exceeds 500 lines.** If it's heading there, split it _before_ it gets there, not after.

The point isn't the number — it's that a 500-line ceiling forces one file = one responsibility, which is what makes things reviewable and testable. How to split, in order of preference:

- **Pull logic out of components.** Data fetching, mutations, macro math → hooks (`use-*.ts`) and plain functions (`lib/nutrition/*.ts`). A React component should mostly be markup + wiring.
- **Split by sub-feature, not by arbitrary line count.** The recipe builder isn't one file — it's `recipe-form`, `ingredient-search`, `ingredient-row`, `media-uploader`, `macro-summary`, each its own file, composed by a thin parent.
- **Co-locate and barrel-export.** Group a feature's files in a folder with an `index.ts` (the existing convention) so imports stay clean: `import { RecipeForm } from "@/features/nutrition/recipes"`.
- **Types and constants live in their own files** (`types.ts`, `constants.ts`), not inline at the top of a 400-line component.

**Carve-outs (don't count against 500):** generated files (Supabase types), pure data/fixtures, and auto-formatted config. Everything a human writes and maintains counts.

**Rule of thumb:** if you can't hold what a file does in your head, it's too big — the line count just makes it measurable.

---

## 2. Server-level tests must pass — every time

Every piece of server logic for nutrition ships with tests, and **those tests pass before anything merges.** Non-negotiable, because the server is where wrong numbers and broken isolation actually hurt clients.

What "server level" covers here:

- **API route handlers** — each `/api/recipes`, `/api/meal-cycles`, `/api/client/*` route: happy path, auth/ownership rejection, validation failure, not-found.
- **Pure logic** — macro rollup, recipe-total recompute, shopping-list aggregation, snapshot construction. These are plain functions; test them exhaustively with edge cases (zero quantity, missing nutrient, unit mismatch).
- **The food-source adapter** — test against the `FoodSource` interface contract with a mocked HTTP layer, plus the cache-hit / cache-miss / manual-fallback paths. Never hit the live Open Food Facts API in tests.

A route or function without passing tests is not "done" (§5).

---

## 3. Test every end — no soft spots

"No soft spots" means the testing covers the whole path, not just the unit. Three layers, each required:

**Unit** — the pure functions above. Fast, exhaustive, run on every save.

**Integration** — API route + database together (against a test/branch Supabase, not prod). This is where we prove **RLS isolation** and the **snapshot invariants** actually hold — see §4. This is the layer that catches the bugs users complain about.

**End-to-end** — the few critical user journeys clicked through a real browser:

1. Trainer builds a recipe (search ingredient → macros fill → upload media → save).
2. Trainer assigns a cycle and the client sees it.
3. Trainer edits the recipe afterward → the already-assigned client's plan does **not** change (the snapshot guarantee, proven end to end).
4. Client logs a meal with a photo → trainer sees adherence.
5. Client opens an accurate shopping list.

We don't need 100% e2e coverage — we need these 5 journeys green before each phase ships.

**Prerequisite (rule-zero):** install the harness first. Recommended: **Vitest** (unit + integration; fast, native TS/ESM, fits Next 15) and **Playwright** (e2e). Add `test`, `test:watch`, `test:e2e` scripts. This is the first ticket of P0 — everything else tests against it.

---

## 4. The invariants that MUST be tested (this feature's danger zones)

These are the things that, if wrong, silently corrupt a client's diet and generate exactly the complaints we're trying to kill. Each needs an explicit test:

1. **Snapshot at assignment.** Editing a recipe never alters an existing `meal_slot_option`. Test: assign → edit recipe → assert the assignment's snapshot is byte-for-byte unchanged, and a _new_ assignment picks up the edit.
2. **Macro math.** Recipe totals equal the sum of ingredient contributions, per-100g scaled by quantity. Test with fractional quantities, missing nutrients (treated as 0, not null-propagating), and unit edge cases.
3. **Tenant/RLS isolation.** A trainer can never read or write another tenant's recipes, cycles, or logs. Test cross-tenant access returns 404/forbidden at the API _and_ is blocked by RLS at the DB.
4. **Auth boundaries.** Client endpoints reject trainer tokens and vice-versa; a client can only see their own cycle and only log their own meals.
5. **Adapter cache integrity.** A looked-up food is cached; the second lookup is a local hit; switching `NUTRITION_FOOD_SOURCE` doesn't mutate already-cached ingredients or existing recipes.
6. **Shopping-list correctness.** Duplicate ingredients across meals merge and sum; quantities and units are right for the date range.

If a change touches any of these, the relevant test runs and passes — no exceptions.

---

## 5. Definition of done (the merge gate)

A nutrition-v2 change is done only when **all** of these are true:

- [ ] No hand-written file over 500 lines.
- [ ] `npm run type-check` clean (the repo's `build` skips this — we don't).
- [ ] `npm run lint:check` clean.
- [ ] Unit + integration tests written for new server logic, and the **full suite passes**.
- [ ] The relevant §4 invariant(s) have explicit passing tests.
- [ ] If it touches a critical journey (§3), the e2e for it is green.
- [ ] New tables have RLS policies; migrations are additive and sequentially numbered.
- [ ] Behind the per-trainer feature flag; no legacy `nutrition_*` dropped.
- [ ] Conventional Commit message.

"It works on my machine" is not on this list on purpose.

---

## 6. Alignment with existing conventions

Don't re-invent — these still apply from `conventions.md` and `CLAUDE.md`:

- kebab-case files, PascalCase components/types, camelCase functions, SCREAMING_SNAKE constants.
- Feature folders with barrel `index.ts` exports; path aliases (`@/features/*`, `@/lib/*`).
- `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on — narrow/default explicitly, no `!` papering.
- Conventional Commits; ESLint autofix handles import order / prop sorting / padding lines.
- Don't touch `middleware.ts` routing, the service-worker cache headers, or the `copy-standalone` step.

---

_Net: small files, server logic proven by tests, the six invariants locked down, and a merge gate that won't let a soft spot through. The test harness install is the first thing we build — without it, the rest of these rules can't be enforced._
