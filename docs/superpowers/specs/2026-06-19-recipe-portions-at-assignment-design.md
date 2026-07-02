# Design: Portion-free recipe library, per-client portions at assignment

**Date:** 2026-06-19
**Branch:** feat/nutrition-v2-foundations
**Status:** Approved (pending spec review)

## Problem

Recipes in the library currently capture per-ingredient **quantities** (grams/units),
and those quantities drive the recipe's macro totals. But every client needs
different portions of the same dish, so a fixed library quantity is wrong: the
trainer wants to set portions **per client, when the dish is assigned**, not when
the recipe is authored.

## Goals

- The recipe library stores **only the ingredient list** (name + per-100g nutrients),
  no quantities/units, no recipe-level macro totals.
- Portions are entered **per client at assignment time** (when adding a recipe to a
  client's meal slot), and are **editable afterward**.
- Macros are computed from those per-client portions (in the option snapshot), not
  from the recipe.

## Non-goals

- No change to the client-facing meal rendering (it already reads portions + totals
  from the frozen snapshot).
- No change to direct **food** options (they already take a quantity at assignment).
- No data migration of existing recipes or assigned snapshots (see Existing data).

## Key architectural fit

A meal cycle is already scoped to one `client_id`, and each `meal_slot_options` row
freezes its own `item_snapshot` (JSONB) containing **per-ingredient quantities** and
rolled-up `totals`. Today those quantities are copied from the recipe at
`addRecipeOption`. This change moves _where the quantities come from_ — trainer input
at assignment — without changing the snapshot's shape. The per-client model already
exists; we stop sourcing portions from the library.

## Data model

- `recipe_ingredients.quantity` and `.unit`: make **nullable** (migration). Not
  dropped — keeps existing rows valid and avoids touching dependent code paths that
  still read the columns defensively. New library ingredients are inserted with
  `quantity = NULL`, `unit = NULL`.
- `recipes` denormalized macro totals (kcal, protein_g, …): **no longer recomputed**
  on recipe edits. Columns remain (stale/zero) but are not displayed. Not dropped.
- `meal_slot_options`: **unchanged**. Per-option portions continue to live in
  `item_snapshot`. Existing frozen snapshots remain immutable (invariant §4.1).

## Recipe library changes (authoring)

1. **API / service** (`recipe-ingredient-service.ts`, `recipe-request.ts`):
   - `parseAddIngredientInput`: quantity becomes **optional** (no longer required/validated).
   - `add()`: insert with `quantity: null`, `unit: null`; **do not** call
     `recomputeRecipeTotals`.
   - `update()`: drop quantity/unit patching (name/sort only). No totals recompute.
2. **UI** (`features/trainer/recipes/`):
   - `ingredient-search.tsx` `FoodResultRow`: remove the grams `<Input>`; "Añadir"
     adds the ingredient with no quantity. Keep the per-100g reference (`kcal/100g`).
   - `manual-ingredient-form.tsx`: remove the quantity field.
   - `ingredient-row.tsx`: remove the editable quantity input; show the ingredient
     name + per-100g reference only, keep remove.
   - `recipe-form.tsx`: remove `<MacroSummary>` (the "Totales por porción" card).
   - `recipe-api.ts`: `RecipeIngredientItem` drops `quantity`/`unit`;
     `AddFromFoodArgs`/`ManualIngredientInput` drop quantity; payload builders stop
     sending quantity/unit.

## Assignment changes (per-client portions)

3. **Add flow** (`picker-drawer.tsx` → `addRecipeOption`):
   - Selecting a recipe opens a **"Set portions" step**: fetch the recipe's
     ingredients, render a grams input per ingredient (default 100).
   - POST `…/options` body for recipes becomes
     `{ source_type: "recipe", recipe_id, quantities: [{ index, grams }] }`.
   - `addRecipeOption(tenantHost, slotId, recipeId, quantities, position?)`:
     `freezeSource` builds the snapshot from the recipe's ingredient list (names +
     nutrients) zipped with the trainer's `quantities`; `totals` rolled up from those.
4. **Edit flow** (new): `PATCH …/options/[optionId]` accepts
   `{ quantities: [{ index, grams }] }`. `updateOptionPortions` reads the option's
   **existing snapshot**, replaces each ingredient's `quantity`, recomputes `totals`,
   and writes the snapshot back. It does **not** re-read the recipe (preserves
   library-immutability; only portions change). Position-only patch still supported.
   - Trainer UI: an "Editar porciones" control on the assigned option (`option-chip`
     or a small modal) reusing the portions editor from the add flow.

## Macros

- Recipe library: **no totals** shown (per-100g reference per ingredient only).
- Option snapshot: `totals` computed via existing `rollupRecipeTotals` from the
  per-client quantities. Client + trainer plan views read `snapshot.totals` — unchanged.

## Existing data

- Leave existing `recipe_ingredients.quantity/unit` values in place (hidden, unused).
- Already-assigned option snapshots keep their frozen portions (immutable).
- No backfill.

## Testing

- **OFF/library unit tests:** add-ingredient without quantity; service inserts null
  quantity and skips totals recompute; update no longer touches quantity.
- **Snapshot tests:** `buildOptionSnapshot` (recipe path) builds from supplied
  quantities; totals roll up correctly; determinism preserved.
- **Service:** `addRecipeOption` with quantities; new `updateOptionPortions`
  re-freezes snapshot + recomputes totals; immutability of library unaffected.
- **Request parsing:** `parseAddOption` accepts `quantities[]`; `parseUpdateOption`
  accepts `quantities[]` (and still `position`).
- Update existing tests that asserted recipe-sourced quantities / macro totals.

## Risks / invariants

- **Immutability (§4.1):** editing portions changes only the option's own snapshot,
  never the library recipe or other clients' options. Edit reads the snapshot, not
  the recipe.
- **Migration safety:** making columns nullable is additive/reversible; applied to
  local Docker DB and (manually) to prod per existing workflow.
- **Client rendering:** unaffected — still reads `item_snapshot.ingredients[].quantity`
  and `totals`.
