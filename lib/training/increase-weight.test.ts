import { describe, expect, it } from "vitest";

import { isIncreaseWeightPending } from "./increase-weight";

describe("isIncreaseWeightPending", () => {
  it("applies only to sessions after the reviewed day", () => {
    expect(isIncreaseWeightPending("2026-10-01", "2026-10-03")).toBe(true);
    expect(isIncreaseWeightPending("2026-10-01", "2026-10-01")).toBe(false);
    expect(isIncreaseWeightPending("2026-10-01", "2026-09-28")).toBe(false);
  });

  it("ignores missing or malformed flags", () => {
    expect(isIncreaseWeightPending(undefined, "2026-10-03")).toBe(false);
    expect(isIncreaseWeightPending(null, "2026-10-03")).toBe(false);
    expect(isIncreaseWeightPending("ayer", "2026-10-03")).toBe(false);
  });
});
