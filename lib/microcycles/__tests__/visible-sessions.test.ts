import { describe, expect, it } from "vitest";

import { filterToActiveProgramSessions } from "../visible-sessions";

describe("filterToActiveProgramSessions", () => {
  const rows = [
    { id: "s-full-a", program_id: "prog-fullbody" },
    { id: "s-full-b", program_id: "prog-fullbody" },
    { id: "s-torso-a", program_id: "prog-torso" },
    { id: "s-orphan", program_id: null },
  ];

  it("keeps only sessions whose program is active", () => {
    const visible = filterToActiveProgramSessions(rows, ["prog-fullbody"]);

    expect(visible).toEqual(new Set(["s-full-a", "s-full-b"]));
  });

  it("drops sessions from paused programs even when referenced by an active microcycle", () => {
    const visible = filterToActiveProgramSessions(rows, ["prog-fullbody"]);

    expect(visible.has("s-torso-a")).toBe(false);
  });

  it("drops sessions with no resolvable program (defensive)", () => {
    const visible = filterToActiveProgramSessions(rows, [
      "prog-fullbody",
      "prog-torso",
    ]);

    expect(visible.has("s-orphan")).toBe(false);
  });

  it("returns empty set when there are no active programs", () => {
    expect(filterToActiveProgramSessions(rows, [])).toEqual(new Set());
  });

  it("returns empty set for empty input", () => {
    expect(filterToActiveProgramSessions([], ["prog-fullbody"])).toEqual(
      new Set()
    );
  });
});
