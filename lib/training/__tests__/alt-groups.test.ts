import { describe, expect, it } from "vitest";

import {
  altGroupName,
  altGroupRestLine,
  altGroupRuns,
  regroupAfterMove,
  restWithUnit,
} from "../alt-groups";

describe("biserie / triserie", () => {
  it("a group is a run of neighbours sharing a key", () => {
    expect(altGroupRuns(["a", "a", null, "b", "b", "b"])).toEqual([
      [0, 1],
      [3, 5],
    ]);
    // Arrastrado fuera: misma clave pero ya no son vecinos.
    expect(altGroupRuns(["a", null, "a"])).toEqual([]);
  });

  it("names the group by its size and words the rest after it", () => {
    expect(altGroupName(2)).toBe("Biserie");
    expect(altGroupName(3)).toBe("Triserie");
    expect(altGroupRestLine(3, restWithUnit("90"))).toBe(
      "Alterna una serie de cada ejercicio. Descansa 90s después de hacer los tres."
    );
    expect(altGroupRestLine(2, undefined)).toBe(
      "Alterna una serie de cada ejercicio."
    );
  });

  it("dropping an exercise between two members adds it to the group", () => {
    // [A(k) X B(k)] → triserie
    expect(regroupAfterMove(["k", null, "k"], 1, true)).toEqual({
      keys: ["k", "k", "k"],
    });
  });

  it("refuses a fourth exercise and anything that cannot be grouped", () => {
    expect(regroupAfterMove(["k", "k", null, "k"], 2, true)).toEqual({
      refused: "full",
    });
    expect(regroupAfterMove(["k", null, "k"], 1, false)).toEqual({
      refused: "not-allowed",
    });
  });

  it("dragging a member out shrinks or dissolves its group", () => {
    // Triserie A B C, C arrastrado al final tras un suelto: queda biserie.
    expect(regroupAfterMove(["k", "k", null, "k"], 3, true)).toEqual({
      keys: ["k", "k", null, null],
    });
    // Biserie A B, B sacado: A se queda solo y el grupo se deshace.
    expect(regroupAfterMove(["k", null, "k"], 2, true)).toEqual({
      keys: [null, null, null],
    });
  });

  it("reordering inside the group, or loose exercises, changes nothing", () => {
    expect(regroupAfterMove(["k", "k", "k"], 2, true)).toEqual({
      keys: ["k", "k", "k"],
    });
    expect(regroupAfterMove([null, "k", "k", null], 0, true)).toEqual({
      keys: [null, "k", "k", null],
    });
  });
});
