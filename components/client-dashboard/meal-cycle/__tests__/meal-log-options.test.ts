import { describe, expect, it } from "vitest";

import { MEAL_LOG_CHOICES, mealLogChoiceLabel } from "../meal-log-options";

describe("MEAL_LOG_CHOICES", () => {
  it("offers exactly the three log statuses in plan → other → skipped order", () => {
    expect(MEAL_LOG_CHOICES.map((c) => c.status)).toEqual([
      "eaten_planned",
      "eaten_other",
      "skipped",
    ]);
  });

  it("gives every choice a non-empty label, icon and color", () => {
    for (const choice of MEAL_LOG_CHOICES) {
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.icon.length).toBeGreaterThan(0);
      expect(choice.color.length).toBeGreaterThan(0);
    }
  });
});

describe("mealLogChoiceLabel", () => {
  it("maps a status to its human label", () => {
    expect(mealLogChoiceLabel("eaten_planned")).toBe("Comí el plan");
    expect(mealLogChoiceLabel("eaten_other")).toBe("Comí otra cosa");
    expect(mealLogChoiceLabel("skipped")).toBe("Me la salté");
  });
});
