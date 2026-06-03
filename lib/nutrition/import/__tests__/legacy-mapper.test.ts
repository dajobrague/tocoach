import type {
  LegacyIngredientRow,
  LegacyMealOptionInput,
  LegacyMealOptionRow,
} from "../types";

import { describe, expect, it } from "vitest";

import { parseQuantityToGrams, toRecipeCandidate } from "../legacy-mapper";

function option(over: Partial<LegacyMealOptionRow> = {}): LegacyMealOptionRow {
  return {
    id: "opt-1",
    name: "Pollo con arroz",
    option_order: 1,
    instructions: null,
    recipe_notes: null,
    prep_time_minutes: null,
    cooking_time_minutes: null,
    servings: null,
    protein: null,
    carbs: null,
    fats: null,
    calories: null,
    ...over,
  };
}

function ingredient(
  over: Partial<LegacyIngredientRow> = {}
): LegacyIngredientRow {
  return {
    id: "ing-1",
    option_id: "opt-1",
    name: "Arroz",
    quantity: "100gr",
    unit: null,
    ingredient_order: 0,
    protein: null,
    carbs: null,
    fats: null,
    calories: null,
    ...over,
  };
}

function input(
  over: Partial<LegacyMealOptionInput> = {}
): LegacyMealOptionInput {
  return {
    option: option(),
    ingredients: [ingredient()],
    ...over,
  };
}

describe("parseQuantityToGrams", () => {
  it("parses a unit-embedded gram quantity ('200gr' -> 200)", () => {
    expect(parseQuantityToGrams("200gr", null)).toBe(200);
  });

  it("parses a spaced gram quantity ('150 g' -> 150)", () => {
    expect(parseQuantityToGrams("150 g", null)).toBe(150);
  });

  it("treats millilitres as grams 1:1 ('15ml' -> 15)", () => {
    expect(parseQuantityToGrams("15ml", null)).toBe(15);
  });

  it("scales kilograms to grams ('1.5kg' -> 1500)", () => {
    expect(parseQuantityToGrams("1.5kg", null)).toBe(1500);
  });

  it("scales litres to grams ('2l' -> 2000)", () => {
    expect(parseQuantityToGrams("2l", null)).toBe(2000);
  });

  it("accepts a comma decimal ('1,5kg' -> 1500)", () => {
    expect(parseQuantityToGrams("1,5kg", null)).toBe(1500);
  });

  it("prefers an explicit unit column over the quantity text", () => {
    expect(parseQuantityToGrams("2", "kg")).toBe(2000);
  });

  it("treats a bare number as grams ('80' -> 80)", () => {
    expect(parseQuantityToGrams("80", null)).toBe(80);
  });

  it("treats an unknown unit as grams 1:1, best-effort ('2 cups' -> 2)", () => {
    expect(parseQuantityToGrams("2 cups", null)).toBe(2);
  });

  it("returns undefined when there is no number ('al gusto')", () => {
    expect(parseQuantityToGrams("al gusto", null)).toBeUndefined();
  });

  it("returns undefined for null / empty quantity", () => {
    expect(parseQuantityToGrams(null, null)).toBeUndefined();
    expect(parseQuantityToGrams("", null)).toBeUndefined();
  });

  it("returns undefined for a non-positive number ('0gr')", () => {
    expect(parseQuantityToGrams("0gr", null)).toBeUndefined();
  });
});

describe("toRecipeCandidate", () => {
  it("maps a healthy option to a candidate", () => {
    const candidate = toRecipeCandidate(input());

    expect(candidate).not.toBeNull();
    expect(candidate?.legacyOptionId).toBe("opt-1");
    expect(candidate?.name).toBe("Pollo con arroz");
    expect(candidate?.ingredients).toEqual([{ name: "Arroz", grams: 100 }]);
  });

  it("combines instructions and recipe notes into steps", () => {
    const candidate = toRecipeCandidate(
      input({
        option: option({
          instructions: "Hervir el arroz.",
          recipe_notes: "Servir caliente.",
        }),
      })
    );

    expect(candidate?.steps).toBe("Hervir el arroz.\n\nServir caliente.");
  });

  it("uses instructions alone when notes are absent", () => {
    const candidate = toRecipeCandidate(
      input({ option: option({ instructions: "Solo cocinar." }) })
    );

    expect(candidate?.steps).toBe("Solo cocinar.");
  });

  it("omits steps when neither instructions nor notes exist", () => {
    expect(toRecipeCandidate(input())?.steps).toBeUndefined();
  });

  it("derives per-100g nutrients from per-quantity legacy macros", () => {
    // 200g line contributing 50g protein -> 25g protein per 100g.
    const candidate = toRecipeCandidate(
      input({
        ingredients: [
          ingredient({
            quantity: "200gr",
            protein: 50,
            carbs: 80,
            fats: 10,
            calories: 660,
          }),
        ],
      })
    );

    expect(candidate?.ingredients[0]?.nutrients).toEqual({
      protein_g: 25,
      carbs_g: 40,
      fat_g: 5,
      kcal: 330,
    });
  });

  it("omits nutrients when grams are unknown even if macros exist", () => {
    const candidate = toRecipeCandidate(
      input({
        ingredients: [
          ingredient({
            name: "Sal",
            quantity: "al gusto",
            protein: 5,
            calories: 20,
          }),
        ],
      })
    );

    expect(candidate?.ingredients[0]).toEqual({ name: "Sal" });
    expect(candidate?.ingredients[0]?.grams).toBeUndefined();
    expect(candidate?.ingredients[0]?.nutrients).toBeUndefined();
  });

  it("carries the legacy stated macros when present", () => {
    const candidate = toRecipeCandidate(
      input({
        option: option({ protein: 46, carbs: 92, fats: 16, calories: 687 }),
      })
    );

    expect(candidate?.legacyStatedMacros).toEqual({
      protein_g: 46,
      carbs_g: 92,
      fat_g: 16,
      kcal: 687,
    });
  });

  it("omits legacy stated macros when the option has none", () => {
    expect(toRecipeCandidate(input())?.legacyStatedMacros).toBeUndefined();
  });

  it("enriches a generic option name with the parent meal label", () => {
    const candidate = toRecipeCandidate(
      input({ option: option({ name: "Opción 1" }), mealLabel: "Desayuno" })
    );

    expect(candidate?.name).toBe("Desayuno — Opción 1");
  });

  it("keeps a meaningful option name even when a meal label is given", () => {
    const candidate = toRecipeCandidate(
      input({
        option: option({ name: "Pollo con arroz" }),
        mealLabel: "Comida",
      })
    );

    expect(candidate?.name).toBe("Pollo con arroz");
  });

  it("falls back to the meal label when the option name is empty", () => {
    const candidate = toRecipeCandidate(
      input({ option: option({ name: "  " }), mealLabel: "Cena" })
    );

    expect(candidate?.name).toBe("Cena");
  });

  it("trims and drops ingredient lines with empty names", () => {
    const candidate = toRecipeCandidate(
      input({
        ingredients: [
          ingredient({ id: "a", name: "  Arroz  ", quantity: "100gr" }),
          ingredient({ id: "b", name: "   ", quantity: "50gr" }),
          ingredient({ id: "c", name: null, quantity: "50gr" }),
        ],
      })
    );

    expect(candidate?.ingredients).toEqual([{ name: "Arroz", grams: 100 }]);
  });

  it("skips an option with an empty name and no meal label (junk)", () => {
    expect(
      toRecipeCandidate(input({ option: option({ name: "" }) }))
    ).toBeNull();
    expect(
      toRecipeCandidate(input({ option: option({ name: null }) }))
    ).toBeNull();
  });

  it("skips an option with no usable ingredients (junk)", () => {
    expect(toRecipeCandidate(input({ ingredients: [] }))).toBeNull();
    expect(
      toRecipeCandidate(input({ ingredients: [ingredient({ name: "   " })] }))
    ).toBeNull();
  });

  it("never throws on a malformed / partial row", () => {
    const malformed = {
      option: { id: "opt-x" } as unknown as LegacyMealOptionRow,
      ingredients: [
        { id: "ing-x" } as unknown as LegacyIngredientRow,
        null as unknown as LegacyIngredientRow,
      ],
    } satisfies LegacyMealOptionInput;

    expect(() => toRecipeCandidate(malformed)).not.toThrow();
    // No name + no usable ingredients -> skipped, not crashed.
    expect(toRecipeCandidate(malformed)).toBeNull();
  });
});
