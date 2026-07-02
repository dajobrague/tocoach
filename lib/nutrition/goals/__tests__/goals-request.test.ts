import { describe, expect, it } from "vitest";

import { parseNutritionGoals } from "../goals-request";

describe("parseNutritionGoals", () => {
  it("parses valid daily targets", () => {
    const parsed = parseNutritionGoals({
      kcal: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 70,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({
      kcal: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 70,
    });
  });

  it("rejects zero/negative kcal and non-integer macros", () => {
    expect(
      parseNutritionGoals({ kcal: 0, protein_g: 1, carbs_g: 1, fat_g: 1 }).ok
    ).toBe(false);
    expect(
      parseNutritionGoals({ kcal: 2000, protein_g: -1, carbs_g: 1, fat_g: 1 })
        .ok
    ).toBe(false);
    expect(
      parseNutritionGoals({ kcal: 2000, protein_g: 1.5, carbs_g: 1, fat_g: 1 })
        .ok
    ).toBe(false);
  });

  it("rejects a missing macro or a non-object body", () => {
    expect(parseNutritionGoals({ kcal: 2000, protein_g: 1, fat_g: 1 }).ok).toBe(
      false
    );
    expect(parseNutritionGoals(null).ok).toBe(false);
  });
});
