import type { ImportResult } from "@/lib/nutrition/import";

import { describe, expect, it } from "vitest";

import {
  computeCandidateMacros,
  formatCompactMacros,
  hasStatedMacros,
  summarizeImportResult,
} from "../import-api";

describe("computeCandidateMacros", () => {
  it("sums per-100g snapshots scaled by grams (server-equivalent rollup)", () => {
    const macros = computeCandidateMacros([
      { name: "Arroz", amount: 200, unit: "g" }, // no nutrients -> contributes 0
      {
        name: "Pollo",
        amount: 150,
        unit: "g",
        nutrients: { protein_g: 30, carbs_g: 6, fat_g: 4, kcal: 166.6667 },
      },
    ]);

    expect(macros.protein_g).toBe(45);
    expect(macros.carbs_g).toBe(9);
    expect(macros.fat_g).toBe(6);
    expect(macros.kcal).toBeCloseTo(250, 1);
  });

  it("is all zeros when no ingredient carries macros", () => {
    expect(
      computeCandidateMacros([{ name: "Arroz", amount: 200, unit: "g" }])
    ).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
  });

  it("weighs piece lines by pieces × piece weight (u × 100 g)", () => {
    const macros = computeCandidateMacros([
      {
        name: "Huevo",
        amount: 2,
        unit: "u",
        gramsPerUnit: 100,
        nutrients: { kcal: 100 },
      },
    ]);

    expect(macros.kcal).toBeCloseTo(200, 4);
  });
});

describe("formatCompactMacros", () => {
  it("renders the compact, rounded macro line", () => {
    expect(
      formatCompactMacros({ kcal: 687, protein_g: 45, carbs_g: 60, fat_g: 20 })
    ).toBe("687 kcal · 45P / 60C / 20G");
  });

  it("rounds and treats missing values as zero", () => {
    expect(formatCompactMacros({ kcal: 250.6, protein_g: 45 })).toBe(
      "251 kcal · 45P / 0C / 0G"
    );
  });
});

describe("hasStatedMacros", () => {
  it("is false for undefined or empty", () => {
    expect(hasStatedMacros(undefined)).toBe(false);
    expect(hasStatedMacros({})).toBe(false);
  });

  it("is true when any macro is present", () => {
    expect(hasStatedMacros({ kcal: 687 })).toBe(true);
  });
});

describe("summarizeImportResult", () => {
  const result = (created: number, duplicates: number): ImportResult => ({
    created: Array.from({ length: created }, (_, i) => ({
      legacyOptionId: `o${i}`,
      recipeId: `r${i}`,
      name: `R${i}`,
    })),
    skipped: Array.from({ length: duplicates }, (_, i) => ({
      legacyOptionId: `d${i}`,
      name: `D${i}`,
      reason: "duplicate" as const,
    })),
  });

  it("reports created and already-existing counts", () => {
    expect(summarizeImportResult(result(3, 2))).toBe(
      "3 importadas, 2 ya existían"
    );
  });

  it("uses singular forms for one", () => {
    expect(summarizeImportResult(result(1, 1))).toBe(
      "1 importada, 1 ya existía"
    );
  });

  it("omits the duplicates clause when there are none", () => {
    expect(summarizeImportResult(result(2, 0))).toBe("2 importadas");
  });
});
