import { describe, expect, it } from "vitest";

import { muscleVolume } from "./muscle-volume";

describe("muscleVolume", () => {
  it("counts primary 1 and secondary 0.5 per set (2 sets of dips)", () => {
    expect(
      muscleVolume([
        {
          sets: 2,
          primary: ["pectoral", "triceps"],
          secondary: ["deltoides_anterior"],
        },
      ])
    ).toEqual([
      { id: "pectoral", sets: 2 },
      { id: "triceps", sets: 2 },
      { id: "deltoides_anterior", sets: 1 },
    ]);
  });

  it("adds across exercises, sorts desc and skips zero-set rows", () => {
    expect(
      muscleVolume([
        { sets: 3, primary: ["pectoral"], secondary: ["triceps"] },
        { sets: 4, primary: ["triceps"] },
        { sets: 0, primary: ["dorsal"] },
        { sets: 3 },
      ])
    ).toEqual([
      { id: "triceps", sets: 5.5 },
      { id: "pectoral", sets: 3 },
    ]);
  });
});
