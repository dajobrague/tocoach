import { describe, expect, it } from "vitest";

import {
  formatMg,
  ingredientCountLabel,
  macroDescriptors,
  publishChecklist,
} from "../recipe-macros";

describe("formatMg", () => {
  it("rounds to whole milligrams with a mg suffix", () => {
    expect(formatMg(370)).toBe("370 mg");
    expect(formatMg(369.6)).toBe("370 mg");
  });

  it("coerces missing/invalid to 0 mg", () => {
    expect(formatMg(undefined)).toBe("0 mg");
    expect(formatMg("nope")).toBe("0 mg");
  });
});

describe("ingredientCountLabel", () => {
  it("singularizes one ingredient", () => {
    expect(ingredientCountLabel(1)).toBe("1 ingrediente");
  });

  it("pluralizes zero and many", () => {
    expect(ingredientCountLabel(0)).toBe("0 ingredientes");
    expect(ingredientCountLabel(3)).toBe("3 ingredientes");
  });
});

describe("macroDescriptors", () => {
  it("tags a high-protein, low-carb, low-fat recipe", () => {
    const tags = macroDescriptors({
      kcal: 39,
      protein_g: 8.9,
      carbs_g: 0.3,
      fat_g: 0.3,
    });
    const labels = tags.map((tag) => tag.label);

    expect(labels).toContain("Alto en proteína");
    expect(labels).toContain("Bajo en carbos");
    expect(labels).toContain("Bajo en grasa");
  });

  it("returns no descriptors when there are no calories", () => {
    expect(
      macroDescriptors({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
    ).toEqual([]);
  });

  it("does not tag a balanced/high-carb recipe as low-carb", () => {
    const labels = macroDescriptors({
      kcal: 400,
      protein_g: 10,
      carbs_g: 70,
      fat_g: 8,
    }).map((tag) => tag.label);

    expect(labels).not.toContain("Bajo en carbos");
  });
});

describe("publishChecklist", () => {
  const ready = {
    hasName: true,
    ingredientCount: 2,
    kcal: 120,
    hasInstructions: false,
    hasPhoto: true,
  };

  it("is ready when the required items are satisfied (instructions optional)", () => {
    const result = publishChecklist(ready);

    expect(result.ready).toBe(true);
    expect(result.items).toHaveLength(5);
    expect(result.items.find((i) => i.id === "instructions")?.done).toBe(false);
    expect(result.items.find((i) => i.id === "instructions")?.optional).toBe(
      true
    );
  });

  it("requires a name, ingredient, and nutrition", () => {
    expect(publishChecklist({ ...ready, hasName: false }).ready).toBe(false);
    expect(publishChecklist({ ...ready, ingredientCount: 0 }).ready).toBe(
      false
    );
    expect(publishChecklist({ ...ready, kcal: 0 }).ready).toBe(false);
  });

  it("does not require a photo (recommended only)", () => {
    const result = publishChecklist({ ...ready, hasPhoto: false });

    expect(result.ready).toBe(true);
    expect(result.items.find((i) => i.id === "photo")?.optional).toBe(true);
  });
});
