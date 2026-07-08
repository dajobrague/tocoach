import { describe, expect, it } from "vitest";

import {
  normalizeDayTargets,
  remapOnCopyDay,
  remapOnRemoveDay,
  remapOnReorderDay,
  setDayTarget,
} from "../day-targets";

describe("normalizeDayTargets", () => {
  it("keeps valid integer-keyed string entries", () => {
    expect(normalizeDayTargets({ "0": "a", "3": "b" })).toEqual({
      "0": "a",
      "3": "b",
    });
  });

  it("drops junk: non-objects, bad keys, non-string values", () => {
    expect(normalizeDayTargets(null)).toEqual({});
    expect(normalizeDayTargets([])).toEqual({});
    expect(normalizeDayTargets("x")).toEqual({});
    expect(
      normalizeDayTargets({ "-1": "a", foo: "b", "1.5": "c", "2": 7, "3": "" })
    ).toEqual({});
  });
});

describe("setDayTarget", () => {
  it("assigns and clears without mutating the input", () => {
    const original = { "0": "a" };
    const assigned = setDayTarget(original, 2, "b");

    expect(assigned).toEqual({ "0": "a", "2": "b" });
    expect(setDayTarget(assigned, 0, null)).toEqual({ "2": "b" });
    expect(original).toEqual({ "0": "a" });
  });
});

describe("remapOnRemoveDay", () => {
  it("drops the removed day and shifts later days down", () => {
    expect(remapOnRemoveDay({ "0": "a", "1": "b", "2": "c" }, 1)).toEqual({
      "0": "a",
      "1": "c",
    });
  });

  it("keeps earlier days untouched when removing the last day", () => {
    expect(remapOnRemoveDay({ "0": "a", "2": "b" }, 2)).toEqual({ "0": "a" });
  });
});

describe("remapOnReorderDay", () => {
  it("follows the day permutation (move day 0 to position 2)", () => {
    // 3 days, from=0 → to=2: old 0→2, old 1→0, old 2→1.
    expect(remapOnReorderDay({ "0": "a", "1": "b" }, [2, 0, 1])).toEqual({
      "2": "a",
      "0": "b",
    });
  });

  it("leaves entries in place when the mapping is missing their index", () => {
    expect(remapOnReorderDay({ "5": "a" }, [1, 0])).toEqual({ "5": "a" });
  });
});

describe("remapOnCopyDay", () => {
  it("copies the source day's objective onto the target", () => {
    expect(remapOnCopyDay({ "0": "a" }, 0, 3)).toEqual({ "0": "a", "3": "a" });
  });

  it("clears the target's objective when the source has none", () => {
    expect(remapOnCopyDay({ "3": "b" }, 0, 3)).toEqual({});
  });
});
