import { describe, expect, it, vi } from "vitest";

// recipe-request pulls in the auth module at import (JWT_SECRET check); stub it
// so this pure-parser test doesn't require the runtime env.
vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));

import {
  parseAddIngredientInput,
  parseReorderInput,
  parseReplaceIngredientsInput,
  parseUpdateIngredientInput,
} from "../recipe-request";

describe("parseAddIngredientInput — brand & image", () => {
  it("extracts brand and image_url from the body", () => {
    const parsed = parseAddIngredientInput({
      name: "Yogur",
      quantity: 100,
      brand: "Hacendado",
      image_url: "https://img.test/y.200.jpg",
      nutrients_per_100g: { kcal: 60 },
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.brand).toBe("Hacendado");
    expect(parsed.value.imageUrl).toBe("https://img.test/y.200.jpg");
  });

  it("omits brand and image_url when absent or non-string", () => {
    const parsed = parseAddIngredientInput({
      name: "Agua",
      quantity: 100,
      brand: 42,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect("brand" in parsed.value).toBe(false);
    expect("imageUrl" in parsed.value).toBe(false);
  });
});

describe("ingredient unit & grams-per-unit parsing", () => {
  it("reads unit and a finite grams_per_unit on add", () => {
    const parsed = parseAddIngredientInput({
      name: "Huevo",
      quantity: 2,
      unit: "u",
      grams_per_unit: 60,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.unit).toBe("u");
    expect(parsed.value.gramsPerUnit).toBe(60);
  });

  it("treats explicit null grams_per_unit as a clear on update", () => {
    const parsed = parseUpdateIngredientInput({
      unit: "g",
      grams_per_unit: null,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value.unit).toBe("g");
    expect(parsed.value.gramsPerUnit).toBeNull();
  });

  it("ignores a non-numeric grams_per_unit", () => {
    const parsed = parseUpdateIngredientInput({ grams_per_unit: "abc" });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect("gramsPerUnit" in parsed.value).toBe(false);
  });
});

describe("parseReorderInput", () => {
  it("accepts a non-empty array of ids, keeping only strings", () => {
    const parsed = parseReorderInput({ order: ["a", "b", 3, "c"] });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toEqual(["a", "b", "c"]);
  });

  it("rejects a missing or empty order", () => {
    expect(parseReorderInput({}).ok).toBe(false);
    expect(parseReorderInput({ order: [] }).ok).toBe(false);
    expect(parseReorderInput(null).ok).toBe(false);
  });
});

describe("parseReplaceIngredientsInput", () => {
  it("accepts a mix of existing (id) and new (name) lines; empty is valid", () => {
    const parsed = parseReplaceIngredientsInput({
      ingredients: [
        { id: "row-1", quantity: 120, unit: "u", grams_per_unit: 60 },
        {
          name: "Nuevo",
          quantity: 40,
          unit: "ml",
          nutrients_per_100g: { kcal: 5 },
        },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.value).toHaveLength(2);
    expect(parsed.value[0]).toMatchObject({ id: "row-1", gramsPerUnit: 60 });
    expect(parsed.value[1]).toMatchObject({ name: "Nuevo", unit: "ml" });
    expect(parseReplaceIngredientsInput({ ingredients: [] }).ok).toBe(true);
  });

  it("rejects a non-array, an invalid quantity, or a new line without a name", () => {
    expect(parseReplaceIngredientsInput({}).ok).toBe(false);
    expect(
      parseReplaceIngredientsInput({ ingredients: [{ quantity: "x" }] }).ok
    ).toBe(false);
    expect(
      parseReplaceIngredientsInput({ ingredients: [{ quantity: 10 }] }).ok
    ).toBe(false);
  });
});
