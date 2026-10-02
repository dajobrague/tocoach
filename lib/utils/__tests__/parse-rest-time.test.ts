import { describe, expect, it } from "vitest";

import { parseRestTimeToSeconds } from "@/lib/utils/exercise-utils";

describe("parseRestTimeToSeconds", () => {
  it.each([
    ["90", 90],
    ["90s", 90],
    ["90 seg", 90],
    ["2 min", 120],
    ["2min", 120],
    ["1min 30s", 90],
    ["1 min 30 s", 90],
    ["1,5 min", 90],
    ["1:30", 90],
    ["2-3 min", 180],
    ["2'", 120],
    ["45''", 45],
  ])("%s → %i", (input, expected) => {
    expect(parseRestTimeToSeconds(input)).toBe(expected);
  });

  it.each(["", "  ", "0", "El necesario para rendir al 100%"])(
    "%s → null",
    (input) => {
      expect(parseRestTimeToSeconds(input)).toBeNull();
    }
  );
});
