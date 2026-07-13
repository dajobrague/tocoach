import { describe, expect, it } from "vitest";

import {
  parseAddDay,
  parseAddOption,
  parseCopyDay,
  parseRemoveDay,
  parseReorderDay,
  parseUpdateOption,
} from "../cycle-request";

describe("parseCopyDay", () => {
  it("parses valid source/target day indices", () => {
    const parsed = parseCopyDay({ source_day_index: 0, target_day_index: 2 });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({ sourceDayIndex: 0, targetDayIndex: 2 });
  });

  it("rejects equal source and target", () => {
    const parsed = parseCopyDay({ source_day_index: 1, target_day_index: 1 });

    expect(parsed.ok).toBe(false);
  });

  it("rejects non-integer or negative indices", () => {
    expect(parseCopyDay({ source_day_index: -1, target_day_index: 2 }).ok).toBe(
      false
    );
    expect(
      parseCopyDay({ source_day_index: 1.5, target_day_index: 2 }).ok
    ).toBe(false);
    expect(parseCopyDay({ target_day_index: 2 }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseCopyDay(null).ok).toBe(false);
  });
});

describe("parseRemoveDay", () => {
  it("parses a valid day index", () => {
    const parsed = parseRemoveDay({ day_index: 2 });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({ dayIndex: 2 });
  });

  it("rejects a missing, negative, or non-integer day index", () => {
    expect(parseRemoveDay({}).ok).toBe(false);
    expect(parseRemoveDay({ day_index: -1 }).ok).toBe(false);
    expect(parseRemoveDay({ day_index: 1.5 }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseRemoveDay(null).ok).toBe(false);
  });
});

describe("parseReorderDay", () => {
  it("parses valid from/to indices", () => {
    const parsed = parseReorderDay({ from_index: 6, to_index: 2 });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({ fromIndex: 6, toIndex: 2 });
  });

  it("rejects missing, negative, or non-integer indices", () => {
    expect(parseReorderDay({ to_index: 2 }).ok).toBe(false);
    expect(parseReorderDay({ from_index: -1, to_index: 2 }).ok).toBe(false);
    expect(parseReorderDay({ from_index: 1.5, to_index: 2 }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseReorderDay(null).ok).toBe(false);
  });
});

describe("parseAddDay", () => {
  it("parses a blank add (no copy source)", () => {
    const parsed = parseAddDay({});

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({});
  });

  it("parses a copy-from source day index", () => {
    const parsed = parseAddDay({ copy_from_day_index: 1 });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({ copyFromDayIndex: 1 });
  });

  it("rejects a negative or non-integer copy source", () => {
    expect(parseAddDay({ copy_from_day_index: -1 }).ok).toBe(false);
    expect(parseAddDay({ copy_from_day_index: 1.5 }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseAddDay(null).ok).toBe(false);
  });
});

describe("parseAddOption — recipe quantities", () => {
  it("parses per-ingredient quantities for a recipe", () => {
    const parsed = parseAddOption({
      source_type: "recipe",
      recipe_id: "r1",
      quantities: [100, 150],
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual({
      sourceType: "recipe",
      recipeId: "r1",
      quantities: [100, 150],
    });
  });

  it("omits quantities when absent", () => {
    const parsed = parseAddOption({ source_type: "recipe", recipe_id: "r1" });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect("quantities" in parsed.value).toBe(false);
  });
});

describe("parseUpdateOption", () => {
  it("accepts a quantities array", () => {
    const parsed = parseUpdateOption({ quantities: [120, 80] });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.quantities).toEqual([120, 80]);
  });

  it("still accepts a position", () => {
    const parsed = parseUpdateOption({ position: 2 });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.position).toBe(2);
  });

  it("rejects a body with neither position nor quantities", () => {
    expect(parseUpdateOption({}).ok).toBe(false);
  });

  it("parses an ingredient rewrite (keep + add) with a trainer comment", () => {
    const parsed = parseUpdateOption({
      ingredients: [
        { kind: "keep", index: 0, quantity: 120 },
        { kind: "add", ingredient_id: " i9 ", quantity: 150 },
      ],
      trainer_comment: "Sin jamón.",
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.ingredientEdits).toEqual([
      { kind: "keep", index: 0, quantity: 120 },
      { kind: "add", ingredientId: "i9", quantity: 150 },
    ]);
    expect(parsed.value.trainerComment).toBe("Sin jamón.");
  });

  it("rejects an empty ingredient rewrite (≥ 1 line required)", () => {
    expect(parseUpdateOption({ ingredients: [] }).ok).toBe(false);
  });

  it("rejects a trainer comment over 2000 chars (JSONB bloat guard)", () => {
    expect(
      parseUpdateOption({
        quantities: [100],
        trainer_comment: "x".repeat(2001),
      }).ok
    ).toBe(false);
    expect(
      parseUpdateOption({
        quantities: [100],
        trainer_comment: "x".repeat(2000),
      }).ok
    ).toBe(true);
  });

  it("rejects malformed rewrite lines", () => {
    // Unknown kind.
    expect(
      parseUpdateOption({ ingredients: [{ kind: "swap", index: 0 }] }).ok
    ).toBe(false);
    // keep: negative / non-integer index, negative quantity.
    expect(
      parseUpdateOption({
        ingredients: [{ kind: "keep", index: -1, quantity: 100 }],
      }).ok
    ).toBe(false);
    expect(
      parseUpdateOption({
        ingredients: [{ kind: "keep", index: 0, quantity: -5 }],
      }).ok
    ).toBe(false);
    // add: missing id, zero quantity.
    expect(
      parseUpdateOption({ ingredients: [{ kind: "add", quantity: 100 }] }).ok
    ).toBe(false);
    expect(
      parseUpdateOption({
        ingredients: [{ kind: "add", ingredient_id: "i9", quantity: 0 }],
      }).ok
    ).toBe(false);
  });
});
