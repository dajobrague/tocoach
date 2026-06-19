# Recipe Editor Redesign — Design

**Date:** 2026-06-19
**Route:** `/trainer/dashboard/recipes/[id]/edit`
**Primary file:** `features/trainer/recipes/recipe-form.tsx`

## Problem

The recipe editor is a narrow (`max-w-3xl`) single column of stacked blocks: a
fields card (name, description, instructions, meal-type tags, status), a floating
Save button, an ingredients card, and a media card. It reads as a long
scrolling form with no spatial hierarchy, the Save button is stranded mid-page,
and the already-built `MacroSummary` component (per-portion calories, protein,
carbs, fat, etc.) is **never rendered** on this page.

Goal: make it feel like an editor panel rather than a long form, and surface the
nutrition totals that already exist.

## Design

### 1. Layout & structure

Replace the single column with a **two-column workspace** (`max-w-6xl`):

- **Sticky header bar** — back link to "Recetas", the page title showing the
  recipe name, and the primary **Guardar cambios** button on the right. Pinned
  while scrolling so Save is always reachable. Stays sticky and compresses on
  mobile.
- **Left column (main, ~2/3):**
  - `Detalles` card — name, description, instructions.
  - `Ingredientes` card — search + ingredient list (unchanged behavior).
- **Right column (sidebar, ~1/3, sticky on desktop):**
  - `Estado` + `Tipos de comida`.
  - **`MacroSummary`** — surfaced here (currently built but never rendered);
    wired to the recipe query, which already returns the macro fields.
  - `Fotos y videos` — thumbnails + upload.
- **Mobile:** columns stack — main first, sidebar below. Header Save remains
  accessible.

### 2. Save behavior

- Track a **dirty state** by comparing current text-field values against the
  last-saved snapshot (the seeded form values, updated on successful save).
- Header Save button is **disabled when clean**; when dirty it enables and a
  subtle "Cambios sin guardar" hint appears beside it. On successful save it
  returns to clean/disabled and re-snapshots.
- Ingredients and media keep saving **instantly** (separate mutations,
  unchanged) — only the text fields gate behind Save.

### 3. Create vs edit modes

- **Edit mode** gets the full two-column workspace (ingredients, media, and
  macros exist).
- **Create mode** stays a **focused single-column form** — a recipe has no
  ingredients, media, or macros until it exists, so the workspace would be
  mostly empty panels. After create it redirects to edit (current behavior),
  where the full workspace appears.

### 4. Component changes (scope)

- `recipe-form.tsx`:
  - `EditRecipeForm` — new layout: `EditorHeader` (sticky) + responsive grid
    (main / sidebar).
  - `CreateRecipeForm` — stays a simple single-column form with its own header.
  - Extract a small `EditorHeader` component (title + back + Save + dirty hint).
  - Split `RecipeFields` content into a "details" group (name/description/
    instructions) for the main column and a "classification" group
    (status/meal-type tags) for the sidebar. Keep value/onChange plumbing.
  - Add dirty-state tracking (last-saved snapshot + equality check).
- Render **`MacroSummary`** in the sidebar, passing the recipe from the query.
- Minor card polish for consistent panel styling (section header icons,
  consistent spacing). No changes to data fetching, mutations, or APIs.

### 5. Out of scope (YAGNI)

- No autosave.
- No new fields (e.g. portions count — separate spec already in the repo:
  `2026-06-19-recipe-portions-at-assignment-design.md`).
- No API or data-layer changes.
- No changes to ingredient search or media upload logic.

## Testing

- Manual verification on the live route (the redesign is presentational).
- Existing `recipe-api.test.ts` continues to pass (no API changes).
- Verify dirty-state: button disabled on load, enables on edit, disables after
  save; ingredients/media still save instantly; responsive stacking on mobile.
