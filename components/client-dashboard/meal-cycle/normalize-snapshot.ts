import type {
  OptionSnapshot,
  SnapshotImage,
  SnapshotIngredient,
  SnapshotMedia,
} from "@/lib/nutrition/cycles/option-snapshot";
import type { NutrientTotals } from "@/lib/nutrition/recipes/macro-rollup";

/** A zeroed totals object — the safe default when a snapshot lacks totals. */
export const EMPTY_TOTALS: NutrientTotals = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  sat_fat_g: 0,
  sodium_mg: 0,
};

/** A snapshot with every collection guaranteed present (never undefined). */
export interface NormalizedSnapshot {
  sourceType: "recipe" | "food";
  name: string;
  steps: string | null;
  images: SnapshotImage[];
  media: SnapshotMedia[];
  ingredients: SnapshotIngredient[];
  totals: NutrientTotals;
}

/**
 * Defensively default a stored `item_snapshot` for the client view.
 *
 * Options frozen before the `media` field existed have no `media` key, so the
 * client recipe detail must not assume it (or any other collection) is present.
 * This guarantees safe defaults — `media`/`images`/`ingredients` → `[]`, `steps`
 * → `null`, `totals` → zeroed — so a legacy snapshot renders the photos,
 * ingredients and macros it does have (just no video) instead of throwing.
 */
export function normalizeOptionSnapshot(
  snapshot: Partial<OptionSnapshot> | null | undefined
): NormalizedSnapshot {
  return {
    sourceType: snapshot?.sourceType === "food" ? "food" : "recipe",
    name: snapshot?.name ?? "",
    steps: snapshot?.steps ?? null,
    images: snapshot?.images ?? [],
    media: snapshot?.media ?? [],
    ingredients: snapshot?.ingredients ?? [],
    totals: snapshot?.totals ?? EMPTY_TOTALS,
  };
}
