import type {
  FoodSnapshotInput,
  RecipeSnapshotInput,
} from "../option-snapshot";

import { describe, expect, it } from "vitest";

import { buildOptionSnapshot } from "../option-snapshot";

function recipe(over: Partial<RecipeSnapshotInput> = {}): RecipeSnapshotInput {
  return {
    id: "recipe-1",
    name: "Pollo con arroz",
    instructions: "Hervir el arroz.",
    media: [
      { type: "image", url: "https://cdn/x.jpg", orientation: "horizontal" },
    ],
    ingredients: [
      {
        name: "Arroz",
        quantity: 200,
        unit: "g",
        nutrientSnapshot: { kcal: 130, protein_g: 2.7, carbs_g: 28 },
      },
      {
        name: "Pollo",
        quantity: 150,
        unit: "g",
        nutrientSnapshot: { kcal: 165, protein_g: 31, fat_g: 3.6 },
      },
    ],
    ...over,
  };
}

function food(over: Partial<FoodSnapshotInput> = {}): FoodSnapshotInput {
  return {
    id: "ingredient-1",
    name: "Plátano",
    quantity: 120,
    nutrientsPer100g: { kcal: 89, protein_g: 1.1, carbs_g: 23 },
    ...over,
  };
}

describe("buildOptionSnapshot — recipe", () => {
  it("freezes a self-contained snapshot with rolled-up totals", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    expect(snap.sourceType).toBe("recipe");
    expect(snap.sourceRefId).toBe("recipe-1");
    expect(snap.name).toBe("Pollo con arroz");
    expect(snap.steps).toBe("Hervir el arroz.");
    expect(snap.images).toEqual([
      { url: "https://cdn/x.jpg", orientation: "horizontal" },
    ]);
    // `media` carries the same item, typed — the basis for self-contained
    // photo + video rendering in the client recipe detail.
    expect(snap.media).toEqual([
      { type: "image", url: "https://cdn/x.jpg", orientation: "horizontal" },
    ]);
    expect(snap.ingredients).toEqual([
      {
        name: "Arroz",
        quantity: 200,
        unit: "g",
        nutrientsPer100g: { kcal: 130, protein_g: 2.7, carbs_g: 28 },
      },
      {
        name: "Pollo",
        quantity: 150,
        unit: "g",
        nutrientsPer100g: { kcal: 165, protein_g: 31, fat_g: 3.6 },
      },
    ]);
    // 200g arroz: kcal 260, P 5.4, C 56; 150g pollo: kcal 247.5, P 46.5, fat 5.4
    expect(snap.totals.kcal).toBeCloseTo(507.5, 4);
    expect(snap.totals.protein_g).toBeCloseTo(51.9, 4);
    expect(snap.totals.carbs_g).toBeCloseTo(56, 4);
    expect(snap.totals.fat_g).toBeCloseTo(5.4, 4);
  });

  it("coerces string/None quantities and filters unknown nutrient keys", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Sal",
            quantity: "5" as unknown as number,
            unit: null,
            nutrientSnapshot: { sodium_mg: 38000, bogus: 1, kcal: "x" },
          },
        ],
      }),
    });

    expect(snap.ingredients[0]).toEqual({
      name: "Sal",
      quantity: 5,
      unit: "g",
      nutrientsPer100g: { sodium_mg: 38000 },
    });
  });

  it("freezes vertical video alongside images so the snapshot is self-contained", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        media: [
          {
            type: "image",
            url: "https://cdn/photo.jpg",
            orientation: "horizontal",
          },
          {
            type: "video",
            url: "https://cdn/reel.mp4",
            orientation: "vertical",
          },
        ],
      }),
    });

    // All media is frozen, in order, with its type — no library join needed.
    expect(snap.media).toEqual([
      {
        type: "image",
        url: "https://cdn/photo.jpg",
        orientation: "horizontal",
      },
      { type: "video", url: "https://cdn/reel.mp4", orientation: "vertical" },
    ]);
    // `images` stays the image-only convenience subset.
    expect(snap.images).toEqual([
      { url: "https://cdn/photo.jpg", orientation: "horizontal" },
    ]);
  });

  it("maps null/empty instructions to null steps", () => {
    expect(
      buildOptionSnapshot({
        type: "recipe",
        recipe: recipe({ instructions: null }),
      }).steps
    ).toBeNull();
    expect(
      buildOptionSnapshot({
        type: "recipe",
        recipe: recipe({ instructions: "   " }),
      }).steps
    ).toBeNull();
  });

  it("handles a recipe with no ingredients (zero totals)", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({ ingredients: [], media: [] }),
    });

    expect(snap.ingredients).toEqual([]);
    expect(snap.totals).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
      fiber_g: 0,
      sat_fat_g: 0,
      sodium_mg: 0,
    });
  });
});

describe("buildOptionSnapshot — food", () => {
  it("freezes a single-ingredient snapshot scaled by quantity", () => {
    const snap = buildOptionSnapshot({ type: "food", food: food() });

    expect(snap.sourceType).toBe("food");
    expect(snap.sourceRefId).toBe("ingredient-1");
    expect(snap.name).toBe("Plátano");
    expect(snap.steps).toBeNull();
    expect(snap.images).toEqual([]);
    expect(snap.media).toEqual([]);
    expect(snap.ingredients).toEqual([
      {
        name: "Plátano",
        quantity: 120,
        unit: "g",
        nutrientsPer100g: { kcal: 89, protein_g: 1.1, carbs_g: 23 },
      },
    ]);
    // 120g: kcal 106.8, P 1.32, C 27.6
    expect(snap.totals.kcal).toBeCloseTo(106.8, 4);
    expect(snap.totals.protein_g).toBeCloseTo(1.32, 4);
    expect(snap.totals.carbs_g).toBeCloseTo(27.6, 4);
  });
});

describe("buildOptionSnapshot — determinism", () => {
  it("produces byte-for-byte identical output for identical input", () => {
    const a = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const b = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("orders snapshot keys deterministically", () => {
    const snap = buildOptionSnapshot({ type: "food", food: food() });

    expect(Object.keys(snap)).toEqual([
      "sourceType",
      "sourceRefId",
      "name",
      "steps",
      "images",
      "media",
      "ingredients",
      "totals",
    ]);
  });
});
