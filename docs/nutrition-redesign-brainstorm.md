# Nutrition Redesign — UX + Systems Brainstorm

> Status: **brainstorm / pre-plan**. No code yet. Goal is to align on the model, the UX, and the hard technical calls before we write a development plan. Production system — every section flags what's risky to touch.

---

## 0. TL;DR — the shape of the proposal

- Move from **diet-first** (a "plan" is the top object, recipes buried inside) to **recipe-first** (a recipe is a reusable library object with ingredients, macros, photos, vertical videos). A diet becomes an _arrangement of recipes over time_.
- **Don't make trainers build an ingredient database.** Back ingredients with a food API. Recommendation: **Open Food Facts (free, branded, barcode, Spanish/LatAm) as the backbone, with FatSecret as a paid quality upgrade if needed.** Critically: **snapshot macros into the recipe at save time** so the app never depends on the API at read time.
- For assignment, **don't pick "cycle" vs "calendar" — do both**: a repeating **microciclo-style base** (clients already understand it, training side already works this way) **plus a calendar overlay** for date-specific notes, swaps, and one-offs. Base pattern + exceptions.
- Every meal slot holds **one or more recipe options**; the client picks one, logs what they actually ate (with photo + comment), and the system tracks consumed vs. target macros.
- This is **not a from-zero schema invention** — the current schema already drifted toward this (meal options, recipe fields, option selections, image buckets all exist). We can reuse the _patterns_ even while replacing the _model_.

---

## 1. What exists today (so we delete deliberately, not blindly)

The current nutrition feature is more built-out than it feels, which is why it's worth being precise about what we're killing.

**Data model (Supabase):** five core tables — `nutrition_plans` → `nutrition_days` → `nutrition_meals` → `nutrition_meal_options` → `nutrition_ingredients`. Plus `nutrition_option_selections` (what the client picked per meal per date). Templates are just `nutrition_plans` with `is_template = true` and a null client.

**Macros currently tracked:** `protein`, `carbs`, `fats`, `calories` — at three levels (day, meal, ingredient). **Sugar, fiber, saturated fat, and sodium are NOT tracked today.** You asked for sugars — that's a net-new field, and a good moment to decide the full nutrient set (see §4).

**The schema already started moving recipe-ward:**

- Migration 073 added `nutrition_meal_options` (alternatives per meal).
- Migration 080 added recipe fields to options: `instructions`, `prep_time_minutes`, `cooking_time_minutes`, `servings`, `recipe_notes`.
- Migration 074 added `nutrition_option_selections` (client choice telemetry).
- Buckets `meal-images` (5MB) and `nutrition-pdfs` (20MB) exist; `exercise-videos` (100MB) exists and is the obvious pattern to copy for vertical recipe videos.

**Why it's painful (the UX diagnosis):** recipes aren't first-class. A "recipe" today only exists _inside_ a meal _inside_ a day _inside_ a plan. So a trainer who wants the same dish on Monday breakfast and Thursday breakfast, or across two clients, rebuilds it every time. There's no library to pick from, no reuse, no single source of truth for a dish's macros. Templates clone the whole tree, which duplicates rather than references. That's the core defect: **the unit of reuse is wrong.**

**The microciclo pattern (the good model to copy):** training already has `microcycles` (one per client program, `duration_days` 1–28, default 7) and `microcycle_slots` (day index → session, or null = rest). The client sees "today's day in the cycle" highlighted and the cycle repeats. This is exactly the mental model you described wanting for nutrition, and clients are already trained on it. **We should mirror it, not reinvent it.**

**Salvage vs. delete:**

- _Delete:_ the plan→day→meal→ingredient ownership chain (recipes trapped inside plans), the template-by-cloning approach.
- _Keep/reuse:_ the storage buckets and upload routes, the single-query tree-fetch optimization pattern (`NUTRITION_TREE_SELECT`), the option-selection telemetry idea, the macro-visibility toggles (`show_calories`), and the microciclo UX as the template for assignment.

---

## 2. The core mental model (recipe-first)

Three layers, cleanly separated:

1. **Recipe library** (trainer-owned, tenant-scoped, reusable). A recipe is the atom: ingredients, macros, steps, photos, vertical videos. Built once, used everywhere.
2. **Meal plan / cycle** (per client). A schedule that _references_ recipes. Defines meal slots per day, each slot offering one or more recipe options. Has a duration and a start date and repeats.
3. **Daily log** (client-owned). What the client actually ate, per meal, per real calendar date — choice + photo + comment, feeding the tracking layer.

The key shift: **recipes are referenced, never copied.** Fix a recipe's macros once and every plan using it is correct. Compare to today, where the same dish is re-entered everywhere.

A useful analogy: recipes are like the **exercise library**, and the meal cycle is like the **microciclo** that arranges sessions. You already have both mental models on the training side — nutrition should rhyme with them.

---

## 3. The ingredient / nutrition API question (the hardest technical call)

You're right that forcing trainers to hand-build an ingredient DB is the thing to avoid. Here's the landscape, weighted for the fact that **TopCoach is Spanish-language and serves a Latin-American market** (the codebase is full of _microciclos_, _dietas_, _comidas_). That single fact eliminates most of the popular options.

| API                       | Cost                                         | Branded products    | Spanish / LatAm                                 | Barcode | Quality                   | Verdict                                        |
| ------------------------- | -------------------------------------------- | ------------------- | ----------------------------------------------- | ------- | ------------------------- | ---------------------------------------------- |
| **USDA FoodData Central** | Free                                         | ~250k, US           | English only                                    | No      | Verified                  | Great for generic foods, wrong region/language |
| **Open Food Facts**       | Free (ODbL)                                  | 2.8M, 150 countries | Strong (LatAm products present)                 | **Yes** | Crowd-sourced, uneven     | **Backbone candidate**                         |
| **FatSecret Platform**    | Free US tier; paid for localized white-label | 2.3M, curated       | **26 langs incl. Spanish**, 58 country datasets | Yes     | Verified, has food images | **Quality upgrade candidate**                  |
| Edamam                    | from $299/mo                                 | 680k UPC            | English-centric                                 | Limited | Good                      | Too pricey/EN for the value                    |
| Nutritionix               | from $1,850/mo                               | 800k, restaurants   | English-centric                                 | Yes     | Dietitian-verified        | Overkill, US restaurant focus                  |
| Spoonacular               | from $300/mo                                 | Recipe-focused      | English                                         | Limited | Good                      | Recipe API, not ingredient-first               |

**Recommendation:** start on **Open Food Facts** (free, branded products _including_ regional/LatAm items, barcode lookup, no per-call cost) and design the integration behind an **internal adapter interface** so we can add or swap in **FatSecret** later if data quality/Spanish-verified coverage isn't good enough. FatSecret's free tier is US-only; its localized Spanish datasets need the paid white-label plan, so treat it as a phase-2 quality lever, not the day-one dependency.

**The architecture insight that matters more than the vendor choice:**

> **Never call a third-party food API at client read time. Snapshot nutrition into the recipe when the trainer saves it.**

Concretely:

- Keep a **local `ingredients` cache table** in our own DB. When a trainer searches, we query the API, and **persist the chosen ingredient locally** (name, per-100g macros, source, source_id, barcode). Next time, it's a local hit — fast, free, and offline-resilient.
- When a recipe is saved, **compute and store the recipe's total macros** on the recipe row (denormalized). The plan and client views read _our_ numbers, never the vendor's live data.
- This means: API outage ≠ app outage; vendor data changes don't silently mutate existing client diets; trainers can **override** any value (regional products, homemade items, "abuela's recipe") without fighting the API.
- It also sidesteps licensing friction — we're caching values we looked up, attributing the source, not redistributing their database.

**Trainer ingredient flow:** search box → API + local cache results → pick → set quantity/unit → macros auto-fill and roll up to the recipe. Manual-entry fallback always available (this is non-negotiable for a LatAm market where coverage is patchy). Barcode scan is a strong phase-2 add since Open Food Facts supports it and trainers are often on phones.

**Open decision:** do we want **per-serving** or **per-100g** as the canonical ingredient unit? Recommendation: store per-100g (the API-native form), display per-serving. And: do recipes scale by servings (1 portion vs. 4)? That changes whether macros are stored per-recipe or per-serving.

---

## 4. Nutrient set — decide this once

Today: calories, protein, carbs, fat. You asked to add **sugar**. Recommendation, structured for extensibility rather than a fixed four columns:

- **Always shown:** calories, protein, carbs, fat.
- **Add now:** sugar (subset of carbs), fiber, saturated fat, sodium.
- **Design:** store nutrients as a **flexible set** (a typed JSON column or a `recipe_nutrients` key/value table) rather than hard columns, so adding "potassium" later is config, not a migration + UI rebuild. The current model's pain of bolting macros on three different levels via separate migrations (028, 028-day, etc.) is exactly what a flexible nutrient set avoids.
- **Per-tenant visibility:** trainers should choose which nutrients clients see (you already have `show_calories` — generalize it to "shown nutrients"). Some coaches hide everything but a photo; some show full macros.

**Open decision:** full micronutrient ambition (vitamins, etc.) or stop at the macro + sugar/fiber/sodium tier? Recommendation: stop there for v1; the flexible store lets you grow without rework.

---

## 5. Data model sketch (conceptual, not final SQL)

New tables, recipe-first. Names illustrative.

**Library layer**

- `ingredients` — local cache of API + manual foods. `name`, `brand`, `barcode`, `source` (off/fatsecret/manual), `source_id`, per-100g nutrient values, `tenant_id` (or global + tenant overrides).
- `recipes` — the atom. `tenant_id`, `trainer_id`, `name`, `description`, `instructions`, `prep_time`, `cook_time`, `servings`, `meal_type` tags (breakfast/lunch/snack…), **computed total + per-serving nutrients (denormalized)**, status.
- `recipe_ingredients` — join: recipe → ingredient, `quantity`, `unit`. Triggers recompute of recipe macros.
- `recipe_media` — photos and **vertical videos**, `type`, `url`, `order`, `orientation`. (Reuse the `exercise-videos` bucket pattern; add `recipe-media`.)

**Plan / cycle layer**

- `meal_cycles` — one active per client (mirror `microcycles`). `client_id`, `duration_days`, `start_date`, `status`.
- `meal_cycle_slots` — `cycle_id`, `day_index` (1..duration), `meal_label` (Desayuno/Almuerzo…), `meal_order`. This is a _slot_, not a recipe.
- `meal_slot_options` — `slot_id`, `recipe_id`, `option_order`. One-to-many = the "give them choices" requirement. Client picks one.
- `meal_cycle_notes` — **the calendar overlay.** `cycle_id`, applies to either a `day_index` (every cycle) or a concrete `date` (one-off), `meal_slot_id` nullable (day-level vs meal-level note), `body`. This is what lets a trainer say "on June 12, swap the snack, you have a check-in."

**Log / tracking layer**

- `meal_logs` — `client_id`, `date`, `meal_slot_id`, `chosen_recipe_id` (or free-text/off-plan), `eaten` boolean, `comment`, `photo_url`, logged-at. Snapshots the consumed macros at log time.
- Aggregation (consumed vs. target per day) is a **view or computed query**, not a stored table — keeps it always-correct.

**Why denormalize macros in two places (ingredient cache + recipe totals + log snapshot)?** Because each layer must be stable against upstream change: the recipe shouldn't shift when an ingredient's API data updates; the log shouldn't shift when a trainer edits a recipe next month. Each snapshot freezes truth at the moment it mattered.

---

## 6. The "cycle vs. calendar" decision — do both

You framed this as the tricky part. The honest answer is they solve different problems and the clean design uses **both, layered**:

**Base layer — repeating cycle (the microciclo model).** Trainer sets a duration (e.g., 7 or 14 days) and a start date. For each day in the cycle they fill meal slots with recipe options. The cycle repeats until changed. This is the backbone: low effort, clients already understand it, and it matches the training side so the whole app feels coherent. ~80% of a coach's structure is "the same week on repeat."

**Overlay layer — calendar exceptions (the Google-Calendar feel).** On top of the repeating base, the trainer opens a real date and can: add a **note** ("today is a refeed, eat the extra carbs"), **swap** a slot's recipe just for that date, or mark a one-off. Two scopes, exactly like calendar recurrence: **"just this day"** vs **"this day going forward"** vs **"every cycle"**.

This layering is the best of both:

- Cheap to author (cycle), flexible where it matters (calendar overlay).
- Mentally clean: _the cycle is the rule; the calendar holds the exceptions._
- Technically clean: the base is a small fixed table; overrides are sparse rows keyed by date. You never store 365 days of meals — you store a 7-day pattern plus a handful of exceptions.

**The alternative** (pure calendar, every day authored individually) is what burns trainers out and is arguably part of today's pain. Avoid it as the _primary_ authoring surface; offer it only as the override.

**Open decision:** when a cycle is edited mid-stream, do past dates stay frozen (recommended — they're history) and only future dates pick up the change? And do we ever auto-rotate multiple cycles (week A / week B), or is one active cycle enough for v1? Recommendation: one active cycle + overrides for v1; multi-week rotation later.

---

## 7. Trainer UX flows

**A. Build a recipe (library).** New "Recetas" library section, sibling to the exercise library. Create recipe → name, meal-type tags → add ingredients via search (API-backed, auto-macros) → write steps → upload photos + vertical video → macros roll up live → save. Reusable forever. Duplicate-to-edit for variants.

**B. Assign a cycle to a client.** From the client profile (where nutrition lives today): set duration + start date → for each day, add meals (slots) → into each slot drop one or more recipes from the library (the "options"). Drag to reorder. This should feel like filling the microciclo grid, but with recipes instead of sessions.

**C. Add notes / exceptions.** A calendar view of the client's plan. Click a date → add note, swap a meal, or mark one-off → choose scope (this day / forward / every cycle). This is the "google calendar feature" you described, scoped correctly.

**D. Reuse across clients.** Because recipes are library objects, "give client B the same breakfast" is a pick, not a rebuild. Whole cycles can also be saved as **named templates** (reference-based, not clone-based) and applied to new clients.

**Guardrail (production):** keep the library tenant-scoped and RLS-enforced like everything else. A recipe authored by one trainer-tenant must never leak to another. (You may _also_ want an optional **TopCoach-curated global recipe library** trainers can copy from — strong onboarding value, but decide if that's v1 or later.)

---

## 8. Client UX flows

**A. See today.** Mirror the microciclo client view: today's day in the cycle highlighted, meals listed in order. Each meal shows its recipe option(s) with photo, macros (if the trainer enabled them), time, and tap-through to full recipe (ingredients, steps, vertical video). Any trainer note for that date surfaces inline.

**B. Choose.** If a meal has options, the client picks one. (This already exists as `option_selections` telemetry — keep it, attach it to logging.)

**C. Log what they actually ate.** Per meal: "ate it as planned" / "ate something else" → optional comment + photo. Off-plan logging matters — real life isn't compliant, and a coach learns more from honest logs than empty ones.

**D. Track.** A daily/weekly roll-up: consumed vs. target for calories + each shown nutrient, compliance streak, photos gallery. The trainer sees the same on their side (adherence is the coaching gold). This is where sugar/carbs/calories tracking you mentioned lives.

**Open decision:** how strict is targets-vs-consumed? Options: (a) simple "did you eat the planned meal" adherence; (b) full macro accounting where off-plan foods are themselves searched against the API and counted. (b) is much more work (clients searching foods) — recommend (a) for v1, (b) as an opt-in "advanced tracking" later.

---

## 9. Migration & rollout (this is production — handle with care)

The project rule is explicit: _proyecto en producción, mucho cuidado._ So the rebuild can't be a hard cut.

- **Additive, not destructive, first.** Build the new tables alongside the old ones. Do **not** drop `nutrition_*` until the new system is live and old data is dealt with. New numbered migrations, never reorder existing ones.
- **Feature-flag the new nutrition section** per tenant (or per trainer). Pilot with a friendly trainer or two before flipping everyone.
- **Migration of existing diets:** decide between (a) leave old plans readable in a frozen "legacy" view and have trainers rebuild fresh (cleanest, given the model changed), or (b) write a one-time script that lifts existing meal-options-with-recipe-fields into the new `recipes` table (the data is _partly_ shaped for it already). Recommendation: **(a) with an optional best-effort importer** — the old data's recipes-trapped-in-plans structure won't map cleanly, and a clean break avoids dragging the old UX's problems forward.
- **Don't touch `middleware.ts` routing or the tenant/RLS model** beyond adding the new tables' policies. New routes under `app/api/nutrition-v2/*` (or a clean namespace) keep blast radius small; retire `/api/nutrition/*` only after cutover.
- **Storage:** add a `recipe-media` bucket rather than overloading `meal-images`; keeps old and new cleanly separable for cleanup.
- **Type-check + lint before any deploy** (the repo's `build` skips both by design).

**Phasing suggestion:**

1. Recipe library + ingredient API adapter + local cache (no client impact yet).
2. Cycle builder + assignment (trainer-only, flagged).
3. Client view + option selection.
4. Logging + tracking.
5. Calendar overlay / notes.
6. Migration tooling + flag rollout + retire old tables.

---

## 10. Open decisions to settle before the dev plan

1. **API choice:** Open Food Facts free backbone now, FatSecret paid as a later quality lever — agreed? Or do you want verified Spanish data (FatSecret paid) from day one?
2. **Nutrient set:** calories + protein + carbs + fat + sugar + fiber + sat-fat + sodium, stored as a flexible set — good? Any you'd drop or add?
3. **Recipe scaling:** do recipes have servings/portions, and do macros scale, or is one recipe = one portion?
4. **Tracking depth:** simple adherence (v1) vs. full macro accounting of off-plan foods (later) — agree to start simple?
5. **Cycle model:** single active cycle + calendar overrides for v1 (multi-week rotation later) — agree?
6. **Existing data:** clean break with legacy read-only view, optional importer — agree, or must old diets carry over fully?
7. **Global curated recipe library:** in v1 or later?
8. **Barcode scanning:** v1 or phase-2?
9. **Who can author recipes** — every trainer in their tenant, or restricted roles?

---

## 11. Risks & watch-items

- **API coverage gaps in Spanish/LatAm products** → mitigated by manual-entry fallback + local cache + (later) FatSecret. Don't ship without good manual entry.
- **Vendor lock / outage** → mitigated by the snapshot-at-save architecture; the app never reads the vendor live.
- **Licensing** → Open Food Facts is ODbL (attribution for the database); we cache looked-up values and attribute source, not redistribute the DB. Confirm with a quick legal sanity check before launch.
- **Video storage cost & vertical playback** → reuse exercise-video infra; confirm the 100MB limit and transcoding/orientation handling fit recipe videos.
- **Scope creep** → this is genuinely large. The phasing in §9 is what keeps it shippable; resist building tracking before the library exists.
- **Production safety** → additive migrations, feature flags, no destructive drops until cutover, never reorder migrations, don't relax the service-worker or middleware load-bearing bits.

---

_Next step once these decisions are made: turn this into a sequenced development plan with concrete migrations, API contracts, and per-phase acceptance criteria._
