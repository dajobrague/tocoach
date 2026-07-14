import type { FoodSearchResult, RecipeIngredientItem } from "../recipe-api";

import { describe, expect, it } from "vitest";

import {
  buildReplaceIngredientsBody,
  draftFromFood,
  draftFromManual,
  ingredientsEqual,
  isTempId,
  makeTempId,
  previewTotals,
} from "../recipe-draft";

const food: FoodSearchResult = {
  source: "off",
  sourceRef: "123",
  name: "Avena",
  brand: "Quaker",
  imageUrl: "https://img.test/a.jpg",
  defaultUnit: "g",
  nutrientsPer100g: { kcal: 389, protein_g: 16.9 },
};

function line(over: Partial<RecipeIngredientItem>): RecipeIngredientItem {
  return {
    id: "row-1",
    ingredient_id: null,
    name_snapshot: "X",
    brand: null,
    image_url: null,
    nutrient_snapshot: { kcal: 100 },
    quantity: 100,
    unit: "g",
    grams_per_unit: null,
    sort_order: 0,
    ...over,
  };
}

describe("makeTempId / isTempId", () => {
  it("mints unique tmp- ids that isTempId recognizes", () => {
    const a = makeTempId();
    const b = makeTempId();

    expect(a).not.toBe(b);
    expect(isTempId(a)).toBe(true);
    expect(isTempId("row-1")).toBe(false);
  });
});

describe("draftFromFood", () => {
  it("freezes name/brand/image/nutrients at 100g with a temp id", () => {
    const draft = draftFromFood(food);

    expect(isTempId(draft.id)).toBe(true);
    expect(draft.name_snapshot).toBe("Avena");
    expect(draft.brand).toBe("Quaker");
    expect(draft.image_url).toBe("https://img.test/a.jpg");
    expect(draft.quantity).toBe(100);
    expect(draft.unit).toBe("g");
    expect(draft.grams_per_unit).toBeNull();
    expect(draft.nutrient_snapshot["kcal"]).toBe(389);
  });

  it("keeps the cache-row link when the food carries an id", () => {
    expect(draftFromFood({ ...food, id: "cache-1" }).ingredient_id).toBe(
      "cache-1"
    );
    expect(draftFromFood(food).ingredient_id).toBeNull();
  });
});

describe("draftFromManual", () => {
  it("coerces the 8 nutrients, defaulting garbage to 0", () => {
    const draft = draftFromManual({
      name: "  Salsa  ",
      quantity: 30,
      nutrients: { kcal: "120", protein_g: "abc" },
    });

    expect(draft.name_snapshot).toBe("Salsa");
    expect(draft.nutrient_snapshot["kcal"]).toBe(120);
    expect(draft.nutrient_snapshot["protein_g"]).toBe(0);
  });
});

describe("ingredientsEqual", () => {
  it("is true for same order + same quantity/unit/grams", () => {
    const a = [line({ id: "1" }), line({ id: "2", quantity: 50 })];
    const b = [line({ id: "1" }), line({ id: "2", quantity: 50 })];

    expect(ingredientsEqual(a, b)).toBe(true);
  });

  it("is false when order, quantity, unit, grams, or length differ", () => {
    const base = [line({ id: "1" }), line({ id: "2" })];

    expect(ingredientsEqual(base, [line({ id: "2" }), line({ id: "1" })])).toBe(
      false
    );
    expect(
      ingredientsEqual(base, [
        line({ id: "1", quantity: 99 }),
        line({ id: "2" }),
      ])
    ).toBe(false);
    expect(
      ingredientsEqual(base, [line({ id: "1", unit: "ml" }), line({ id: "2" })])
    ).toBe(false);
    expect(ingredientsEqual(base, [line({ id: "1" })])).toBe(false);
  });

  it("is false when a line's per-100g macros were corrected", () => {
    const base = [line({ id: "1" })];

    expect(
      ingredientsEqual(base, [
        line({ id: "1", nutrient_snapshot: { kcal: 150 } }),
      ])
    ).toBe(false);
    expect(
      ingredientsEqual(base, [
        line({ id: "1", nutrient_snapshot: { kcal: 100, protein_g: 8 } }),
      ])
    ).toBe(false);
  });
});

describe("previewTotals", () => {
  it("scales per-100g by grams, converting units", () => {
    const totals = previewTotals([
      line({ quantity: 200, unit: "g", nutrient_snapshot: { kcal: 100 } }),
      line({
        quantity: 2,
        unit: "u",
        grams_per_unit: 50,
        nutrient_snapshot: { kcal: 100 },
      }),
    ]);

    // 100×2 (200g) + 100×1 (100g) = 300 kcal.
    expect(totals.kcal).toBeCloseTo(300);
  });
});

describe("buildReplaceIngredientsBody", () => {
  it("sends full snapshot for new (tmp) lines; existing lines send id + nutrients", () => {
    const body = buildReplaceIngredientsBody([
      line({
        id: "tmp-9",
        name_snapshot: "Nuevo",
        brand: "ACME",
        image_url: "https://img/x.jpg",
        nutrient_snapshot: { kcal: 5 },
        quantity: 40,
        unit: "ml",
      }),
      line({ id: "row-7", quantity: 120, unit: "u", grams_per_unit: 60 }),
    ]);

    expect(body.ingredients[0]).toEqual({
      quantity: 40,
      unit: "ml",
      grams_per_unit: null,
      name: "Nuevo",
      nutrients_per_100g: { kcal: 5 },
      brand: "ACME",
      image_url: "https://img/x.jpg",
    });
    // Existing lines carry their nutrients too, so macro corrections persist.
    expect(body.ingredients[1]).toEqual({
      quantity: 120,
      unit: "u",
      grams_per_unit: 60,
      nutrients_per_100g: { kcal: 100 },
      id: "row-7",
    });
  });

  it("carries the cache-row link on new lines so serving lookups keep working", () => {
    const body = buildReplaceIngredientsBody([
      line({ id: "tmp-1", ingredient_id: "cache-1" }),
      line({ id: "tmp-2", ingredient_id: null }),
    ]);

    expect(body.ingredients[0]?.ingredient_id).toBe("cache-1");
    expect("ingredient_id" in (body.ingredients[1] ?? {})).toBe(false);
  });
});
