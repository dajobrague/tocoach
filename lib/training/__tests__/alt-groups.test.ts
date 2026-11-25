import { describe, expect, it } from "vitest";

import {
  altGroupName,
  altGroupRestLine,
  altGroupRuns,
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
});
