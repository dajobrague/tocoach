import { describe, expect, it } from "vitest";

import { type CommonFoodRow, rankSeedRows } from "../common-foods-repository";

const row = (name_normalized: string) =>
  ({ name_normalized }) as unknown as CommonFoodRow;

describe("rankSeedRows", () => {
  it("exacto, luego prefijo, luego palabra, luego subcadena; empata el más corto", () => {
    const ranked = rankSeedRows("pollo", [
      row("alitas de pollo (asadas)"),
      row("repollo"),
      row("pollo asado (con piel)"),
      row("pechuga de pollo (cruda)"),
      row("pollo"),
    ]).map((r) => r.name_normalized);

    expect(ranked).toEqual([
      "pollo",
      "pollo asado (con piel)",
      "alitas de pollo (asadas)",
      "pechuga de pollo (cruda)",
      "repollo",
    ]);
  });
});
