import type {
  ImportCreatedRecipe,
  ImportResult,
  ImportSkippedCandidate,
  RecipeCandidate,
} from "./types";
import type { AddIngredientInput } from "@/lib/nutrition/recipes/recipe-ingredient-service";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LegacyNutritionScanService } from "./legacy-scan-service";

import { RecipeIngredientService } from "@/lib/nutrition/recipes/recipe-ingredient-service";
import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";

/**
 * Orchestrates the guided legacy → library import (P2-T2).
 *
 * `preview` returns the tenant's review-ready candidates. `approve` re-derives
 * those candidates server-side from the *authenticated tenant's* legacy data and
 * imports only the ones whose `legacyOptionId` was approved — so the request
 * body only *selects* what to import; it can neither inject arbitrary recipe
 * content nor reach another tenant's data (a foreign id simply won't match).
 *
 * Idempotency: import dedupes by recipe name, case-insensitive and trimmed,
 * within the tenant (skip-if-exists). Re-approving the same options creates
 * nothing new — each name already exists — and duplicate names *within* one
 * batch collapse to a single recipe. Distinct legacy options that normalize to
 * the same name therefore import once; the trainer renames afterward if needed.
 */
export class RecipeImportService {
  private readonly scanner: LegacyNutritionScanService;
  private readonly recipes: RecipeService;
  private readonly ingredients: RecipeIngredientService;

  constructor(client: SupabaseClient) {
    this.scanner = new LegacyNutritionScanService(client);
    this.recipes = new RecipeService(client);
    this.ingredients = new RecipeIngredientService(client);
  }

  /** Review-ready candidates for the tenant (junk already skipped). */
  async preview(tenantHost: string): Promise<RecipeCandidate[]> {
    return this.scanner.scan(tenantHost);
  }

  /** Import the approved candidates (by legacy option id) for the tenant. */
  async approve(
    tenantHost: string,
    trainerId: string,
    optionIds: string[]
  ): Promise<ImportResult> {
    const wanted = new Set(optionIds);
    const candidates = await this.scanner.scan(tenantHost);
    const byId = new Map(candidates.map((c) => [c.legacyOptionId, c]));

    const existingNames = await this.existingNameKeys(tenantHost);
    const created: ImportCreatedRecipe[] = [];
    const skipped: ImportSkippedCandidate[] = [];

    for (const optionId of wanted) {
      const candidate = byId.get(optionId);

      if (candidate === undefined) {
        skipped.push({
          legacyOptionId: optionId,
          name: "",
          reason: "not_found",
        });
        continue;
      }

      const key = nameKey(candidate.name);

      if (existingNames.has(key)) {
        skipped.push({
          legacyOptionId: optionId,
          name: candidate.name,
          reason: "duplicate",
        });
        continue;
      }

      existingNames.add(key);

      const recipeId = await this.importOne(tenantHost, trainerId, candidate);

      created.push({
        legacyOptionId: optionId,
        recipeId,
        name: candidate.name,
      });
    }

    return { created, skipped };
  }

  /** Create one library recipe + its ingredient lines from a candidate. */
  private async importOne(
    tenantHost: string,
    trainerId: string,
    candidate: RecipeCandidate
  ): Promise<string> {
    const recipe = await this.recipes.create(tenantHost, trainerId, {
      name: candidate.name,
      status: "draft",
      ...(candidate.steps !== undefined
        ? { instructions: candidate.steps }
        : {}),
    });

    for (const [index, line] of candidate.ingredients.entries()) {
      const input: AddIngredientInput = {
        name: line.name,
        quantity: line.amount ?? 0,
        unit: line.unit ?? "g",
        sortOrder: index,
      };

      // Piece lines carry their weight (the mapper seeds the 100 g
      // convention) — without it a "u" line weighs 0 in every rollup.
      if (line.unit === "u") {
        input.gramsPerUnit = line.gramsPerUnit ?? 100;
      }

      // Per-line snapshot: real legacy line macros, or the mapper's
      // distribution of the option's stated totals (flagged estimated).
      if (line.nutrients !== undefined) {
        input.nutrientsPer100g = line.nutrients;
      }

      await this.ingredients.add(tenantHost, recipe.id, input);
    }

    return recipe.id;
  }

  /** Set of normalized names already present in the tenant's library. */
  private async existingNameKeys(tenantHost: string): Promise<Set<string>> {
    const existing = await this.recipes.list(tenantHost, {});

    return new Set(existing.map((row) => nameKey(row.name)));
  }
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}
