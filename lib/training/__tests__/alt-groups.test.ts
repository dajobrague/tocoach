import { describe, expect, it } from "vitest";

import {
  altGroupRuns,
  canLinkWithNext,
  toggleLinkWithNext,
} from "../alt-groups";

describe("series alternas", () => {
  it("a group is a run of neighbours sharing a key", () => {
    expect(altGroupRuns(["a", "a", null, "b", "b", "b"])).toEqual([
      [0, 1],
      [3, 5],
    ]);
    // Arrastrado fuera: misma clave pero ya no son vecinos.
    expect(altGroupRuns(["a", null, "a"])).toEqual([]);
  });

  it("links two loose exercises and unlinks them again", () => {
    const linked = toggleLinkWithNext([null, null, null], 0, "k1");

    expect(linked).toEqual(["k1", "k1", null]);
    expect(toggleLinkWithNext(linked, 0, "k2")).toEqual([null, null, null]);
  });

  it("grows to three and refuses a fourth", () => {
    const three = toggleLinkWithNext(["k1", "k1", null, null], 1, "k2");

    expect(three).toEqual(["k1", "k1", "k1", null]);
    expect(canLinkWithNext(three, 2)).toBe(false);
    expect(toggleLinkWithNext(three, 2, "k3")).toEqual(three);
  });

  it("splitting the middle of three keeps the pair", () => {
    expect(toggleLinkWithNext(["k1", "k1", "k1"], 0, "k2")).toEqual([
      null,
      "k2",
      "k2",
    ]);
  });
});
