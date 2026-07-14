import type {
  FoodSnapshotInput,
  RecipeSnapshotInput,
} from "../option-snapshot";

import { describe, expect, it } from "vitest";

import {
  applyIngredientEdits,
  applyPortions,
  buildOptionSnapshot,
  freezeFoodIngredient,
  overlayLiveMedia,
  withTrainerComment,
} from "../option-snapshot";

function recipe(over: Partial<RecipeSnapshotInput> = {}): RecipeSnapshotInput {
  return {
    id: "recipe-1",
    name: "Pollo con arroz",
    instructions: "Hervir el arroz.",
    description: null,
    media: [
      { type: "image", url: "https://cdn/x.jpg", orientation: "horizontal" },
    ],
    ingredients: [
      {
        name: "Arroz",
        quantity: 200,
        unit: "g",
        gramsPerUnit: null,
        nutrientSnapshot: { kcal: 130, protein_g: 2.7, carbs_g: 28 },
      },
      {
        name: "Pollo",
        quantity: 150,
        unit: "g",
        gramsPerUnit: null,
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

describe("applyPortions", () => {
  it("overrides per-ingredient quantities and recomputes totals", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = applyPortions(snap, [100, 200]);

    expect(out.ingredients[0]?.quantity).toBe(100);
    expect(out.ingredients[1]?.quantity).toBe(200);
    // 100g arroz: kcal 130; 200g pollo: kcal 330 → 460
    expect(out.totals.kcal).toBeCloseTo(460, 4);
  });

  it("keeps the existing quantity when an entry is missing or non-finite", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = applyPortions(snap, [100, Number.NaN]);

    expect(out.ingredients[0]?.quantity).toBe(100);
    expect(out.ingredients[1]?.quantity).toBe(150); // unchanged
  });

  it("does not mutate the original snapshot", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    applyPortions(snap, [100, 200]);

    expect(snap.ingredients[0]?.quantity).toBe(200);
  });
});

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
        brand: null,
        quantity: 200,
        unit: "g",
        gramsPerUnit: null,
        nutrientsPer100g: { kcal: 130, protein_g: 2.7, carbs_g: 28 },
      },
      {
        name: "Pollo",
        brand: null,
        quantity: 150,
        unit: "g",
        gramsPerUnit: null,
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
            gramsPerUnit: null,
            nutrientSnapshot: { sodium_mg: 38000, bogus: 1, kcal: "x" },
          },
        ],
      }),
    });

    expect(snap.ingredients[0]).toEqual({
      name: "Sal",
      brand: null,
      quantity: 5,
      unit: "g",
      gramsPerUnit: null,
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

  it("freezes the recipe description (trimmed; empty → null)", () => {
    expect(
      buildOptionSnapshot({
        type: "recipe",
        recipe: recipe({ description: "Batido para llevar." }),
      }).description
    ).toBe("Batido para llevar.");
    expect(
      buildOptionSnapshot({
        type: "recipe",
        recipe: recipe({ description: "   " }),
      }).description
    ).toBeNull();
  });

  it("freezes each line's brand (empty → null)", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Queso gouda",
            brand: "Hacendado",
            quantity: 30,
            unit: "g",
            gramsPerUnit: null,
            nutrientSnapshot: { kcal: 356 },
          },
          {
            name: "Arroz",
            brand: "  ",
            quantity: 100,
            unit: "g",
            gramsPerUnit: null,
            nutrientSnapshot: { kcal: 130 },
          },
        ],
      }),
    });

    expect(snap.ingredients[0]?.brand).toBe("Hacendado");
    expect(snap.ingredients[1]?.brand).toBeNull();
  });

  it("starts with no trainer comment (per-client, set at assignment)", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    expect(snap.trainerComment).toBeNull();
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

describe("buildOptionSnapshot — units", () => {
  it("carries gramsPerUnit onto each snapshot ingredient", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Huevo",
            quantity: 2,
            unit: "u",
            gramsPerUnit: 60,
            nutrientSnapshot: { kcal: 155, protein_g: 13 },
          },
        ],
      }),
    });

    expect(snap.ingredients[0]).toEqual({
      name: "Huevo",
      brand: null,
      quantity: 2,
      unit: "u",
      gramsPerUnit: 60,
      nutrientsPer100g: { kcal: 155, protein_g: 13 },
    });
  });

  it("scales piece (u) macros by quantity × gramsPerUnit, not the raw count", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Huevo",
            quantity: 2,
            unit: "u",
            gramsPerUnit: 60,
            nutrientSnapshot: { kcal: 155, protein_g: 13 },
          },
        ],
      }),
    });

    // 2 u × 60 g = 120 g → kcal 155 × 1.2 = 186; protein 13 × 1.2 = 15.6
    expect(snap.totals.kcal).toBeCloseTo(186, 4);
    expect(snap.totals.protein_g).toBeCloseTo(15.6, 4);
  });

  it("treats ml as grams (density ≈ 1) and lt as 1000 g", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Leche",
            quantity: 250,
            unit: "ml",
            gramsPerUnit: null,
            nutrientSnapshot: { kcal: 60 },
          },
          {
            name: "Agua",
            quantity: 1,
            unit: "lt",
            gramsPerUnit: null,
            nutrientSnapshot: { kcal: 0 },
          },
        ],
      }),
    });

    // 250 ml → 250 g → kcal 60 × 2.5 = 150; 1 lt → 1000 g → kcal 0
    expect(snap.totals.kcal).toBeCloseTo(150, 4);
  });

  it("recomputes totals from a native-unit portion override (pieces)", () => {
    const snap = buildOptionSnapshot({
      type: "recipe",
      recipe: recipe({
        ingredients: [
          {
            name: "Huevo",
            quantity: 2,
            unit: "u",
            gramsPerUnit: 60,
            nutrientSnapshot: { kcal: 155 },
          },
        ],
      }),
    });
    // Override to 3 pieces → 3 × 60 = 180 g → kcal 155 × 1.8 = 279
    const out = applyPortions(snap, [3]);

    expect(out.ingredients[0]?.quantity).toBe(3);
    expect(out.totals.kcal).toBeCloseTo(279, 4);
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
        brand: null,
        quantity: 120,
        unit: "g",
        gramsPerUnit: null,
        nutrientsPer100g: { kcal: 89, protein_g: 1.1, carbs_g: 23 },
      },
    ]);
    // 120g: kcal 106.8, P 1.32, C 27.6
    expect(snap.totals.kcal).toBeCloseTo(106.8, 4);
    expect(snap.totals.protein_g).toBeCloseTo(1.32, 4);
    expect(snap.totals.carbs_g).toBeCloseTo(27.6, 4);
  });

  it("captures the food's product image into media + images", () => {
    const snap = buildOptionSnapshot({
      type: "food",
      food: food({ imageUrl: "https://off/cafe.jpg" }),
    });

    expect(snap.media).toEqual([
      { type: "image", url: "https://off/cafe.jpg", orientation: null },
    ]);
    expect(snap.images).toEqual([
      { url: "https://off/cafe.jpg", orientation: null },
    ]);
  });

  it("leaves media + images empty when the food has no image", () => {
    const snap = buildOptionSnapshot({
      type: "food",
      food: food({ imageUrl: null }),
    });

    expect(snap.media).toEqual([]);
    expect(snap.images).toEqual([]);
  });
});

describe("overlayLiveMedia", () => {
  it("replaces a recipe snapshot's media + images with the live library media", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = overlayLiveMedia(snap, [
      { type: "image", url: "https://cdn/new.jpg", orientation: "vertical" },
      { type: "video", url: "https://cdn/new.mp4", orientation: "vertical" },
    ]);

    expect(out.media).toEqual([
      { type: "image", url: "https://cdn/new.jpg", orientation: "vertical" },
      { type: "video", url: "https://cdn/new.mp4", orientation: "vertical" },
    ]);
    // `images` is the image-only subset of the new media.
    expect(out.images).toEqual([
      { url: "https://cdn/new.jpg", orientation: "vertical" },
    ]);
  });

  it("keeps the frozen nutrition, ingredients, name and steps untouched", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = overlayLiveMedia(snap, [
      { type: "image", url: "https://cdn/new.jpg", orientation: null },
    ]);

    expect(out.ingredients).toEqual(snap.ingredients);
    expect(out.totals).toEqual(snap.totals);
    expect(out.name).toBe(snap.name);
    expect(out.steps).toBe(snap.steps);
    expect(out.sourceRefId).toBe(snap.sourceRefId);
  });

  it("returns the snapshot unchanged when there is no live media (frozen fallback)", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = overlayLiveMedia(snap, []);

    expect(out.media).toEqual(snap.media);
    expect(out.images).toEqual(snap.images);
  });

  it("never overlays a food option (foods have no library media to track)", () => {
    const snap = buildOptionSnapshot({ type: "food", food: food() });
    const out = overlayLiveMedia(snap, [
      { type: "image", url: "https://cdn/new.jpg", orientation: null },
    ]);

    expect(out.media).toEqual(snap.media);
    expect(out.images).toEqual(snap.images);
  });

  it("does not mutate the original snapshot", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    overlayLiveMedia(snap, [
      { type: "image", url: "https://cdn/new.jpg", orientation: null },
    ]);

    expect(snap.media).toEqual([
      { type: "image", url: "https://cdn/x.jpg", orientation: "horizontal" },
    ]);
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
      "description",
      "trainerComment",
      "images",
      "media",
      "ingredients",
      "totals",
    ]);
  });
});

describe("applyIngredientEdits", () => {
  it("keeps, re-portions, removes and adds lines, recomputing totals", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    // Keep arroz at 100 g, drop pollo, add 100 g of plátano (89 kcal/100g).
    const out = applyIngredientEdits(snap, [
      { kind: "keep", index: 0, quantity: 100 },
      {
        kind: "add",
        ingredient: freezeFoodIngredient({
          name: "Plátano",
          quantity: 100,
          nutrientsPer100g: { kcal: 89, protein_g: 1.1 },
        }),
      },
    ]);

    expect(out?.ingredients.map((ing) => ing.name)).toEqual([
      "Arroz",
      "Plátano",
    ]);
    expect(out?.ingredients[0]?.quantity).toBe(100);
    // 100g arroz: 130 kcal + 100g plátano: 89 kcal
    expect(out?.totals.kcal).toBeCloseTo(219, 4);
  });

  it("keeps the line's current quantity when the override is not usable", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });
    const out = applyIngredientEdits(snap, [
      { kind: "keep", index: 0, quantity: Number.NaN },
    ]);

    expect(out?.ingredients[0]?.quantity).toBe(200);
  });

  it("returns null for an out-of-range keep or an empty edit list", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    expect(
      applyIngredientEdits(snap, [{ kind: "keep", index: 9, quantity: 100 }])
    ).toBeNull();
    expect(applyIngredientEdits(snap, [])).toBeNull();
  });

  it("does not mutate the original snapshot", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    applyIngredientEdits(snap, [{ kind: "keep", index: 0, quantity: 1 }]);

    expect(snap.ingredients).toHaveLength(2);
    expect(snap.ingredients[0]?.quantity).toBe(200);
  });
});

describe("withTrainerComment", () => {
  it("sets a trimmed note, and an empty string clears it to null", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    expect(withTrainerComment(snap, "  Más grasa hoy.  ").trainerComment).toBe(
      "Más grasa hoy."
    );
    expect(withTrainerComment(snap, "").trainerComment).toBeNull();
    expect(withTrainerComment(snap, "   ").trainerComment).toBeNull();
  });

  it("keeps the current note when the value is undefined", () => {
    const snap = withTrainerComment(
      buildOptionSnapshot({ type: "recipe", recipe: recipe() }),
      "Nota previa"
    );

    expect(withTrainerComment(snap, undefined).trainerComment).toBe(
      "Nota previa"
    );
  });

  it("does not mutate the original snapshot", () => {
    const snap = buildOptionSnapshot({ type: "recipe", recipe: recipe() });

    withTrainerComment(snap, "Nota");

    expect(snap.trainerComment).toBeNull();
  });
});
