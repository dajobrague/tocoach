import { describe, expect, it } from "vitest";

import {
  SHOPPING_RANGE_OPTIONS,
  checkedStorageKey,
  computeRange,
  formatItemLine,
  formatQuantity,
  itemKey,
} from "../shopping-list-helpers";

/**
 * Pure display/range helpers for the client shopping list. No DOM — these are
 * the bits the .tsx delegates to so the rounding, the "name · qty unit" line,
 * the range math and the per-range localStorage key are unit-tested directly
 * (the no-jsdom convention).
 */

describe("formatQuantity — rounds away float noise", () => {
  it("rounds 1.4999 to 1.5", () => {
    expect(formatQuantity(1.4999)).toBe("1.5");
  });

  it("keeps whole numbers whole (no trailing .0)", () => {
    expect(formatQuantity(350)).toBe("350");
  });

  it("collapses 0.999999 to 1", () => {
    expect(formatQuantity(0.999999)).toBe("1");
  });

  it("rounds to at most 2 decimals", () => {
    expect(formatQuantity(12.3456)).toBe("12.35");
  });

  it("renders a non-finite quantity as 0", () => {
    expect(formatQuantity(Number.NaN)).toBe("0");
  });
});

describe("formatItemLine — name (brand) · qty unit", () => {
  it("formats a clean line", () => {
    expect(
      formatItemLine({ name: "Avena", brand: null, quantity: 350, unit: "g" })
    ).toBe("Avena · 350 g");
  });

  it("applies rounding to the quantity", () => {
    expect(
      formatItemLine({
        name: "Aceite",
        brand: null,
        quantity: 1.4999,
        unit: "ml",
      })
    ).toBe("Aceite · 1.5 ml");
  });

  it("shows the brand in parentheses when the line has one", () => {
    expect(
      formatItemLine({
        name: "Yogur griego",
        brand: "Hacendado",
        quantity: 250,
        unit: "g",
      })
    ).toBe("Yogur griego (Hacendado) · 250 g");
  });
});

describe("itemKey — identity for check state", () => {
  it("separates the same name across different units", () => {
    expect(itemKey({ name: "Leche", unit: "g" })).not.toBe(
      itemKey({ name: "Leche", unit: "ml" })
    );
  });

  it("is stable for the same (name, unit)", () => {
    expect(itemKey({ name: "Leche", unit: "ml" })).toBe(
      itemKey({ name: "Leche", unit: "ml" })
    );
  });

  it("separates the same name across different brands", () => {
    expect(itemKey({ name: "Leche", brand: "Hacendado", unit: "ml" })).not.toBe(
      itemKey({ name: "Leche", brand: "Central Lechera", unit: "ml" })
    );
  });

  it("treats a missing brand and an absent brand alike", () => {
    expect(itemKey({ name: "Leche", brand: null, unit: "ml" })).toBe(
      itemKey({ name: "Leche", unit: "ml" })
    );
  });
});

describe("computeRange — this week / next week / 2 weeks", () => {
  const TODAY = "2026-06-03"; // a Wednesday

  it("this-week is a 7-day window starting today", () => {
    expect(computeRange("this-week", TODAY)).toEqual({
      from: "2026-06-03",
      to: "2026-06-09",
    });
  });

  it("next-week is the following 7-day window", () => {
    expect(computeRange("next-week", TODAY)).toEqual({
      from: "2026-06-10",
      to: "2026-06-16",
    });
  });

  it("two-weeks spans 14 days starting today", () => {
    expect(computeRange("two-weeks", TODAY)).toEqual({
      from: "2026-06-03",
      to: "2026-06-16",
    });
  });

  it("crosses a month boundary correctly", () => {
    expect(computeRange("this-week", "2026-06-28")).toEqual({
      from: "2026-06-28",
      to: "2026-07-04",
    });
  });

  it("exposes the three selectable options", () => {
    expect(SHOPPING_RANGE_OPTIONS.map((o) => o.key)).toEqual([
      "this-week",
      "next-week",
      "two-weeks",
    ]);
  });
});

describe("checkedStorageKey — per-range check state", () => {
  it("is distinct for different ranges", () => {
    expect(checkedStorageKey("2026-06-03", "2026-06-09")).not.toBe(
      checkedStorageKey("2026-06-10", "2026-06-16")
    );
  });

  it("is stable for the same range", () => {
    expect(checkedStorageKey("2026-06-03", "2026-06-09")).toBe(
      checkedStorageKey("2026-06-03", "2026-06-09")
    );
  });
});
