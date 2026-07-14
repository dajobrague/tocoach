import { describe, expect, it } from "vitest";

import { isWithinLogWindow, isYmd, shiftYmd } from "../log-window";

/** The client logging-window predicate (pure, no DOM/DB). */

describe("isYmd", () => {
  it("accepts a real date and rejects bad ones", () => {
    expect(isYmd("2026-06-10")).toBe(true);
    expect(isYmd("2026-6-1")).toBe(false);
    expect(isYmd("2026-13-40")).toBe(false);
    expect(isYmd("nope")).toBe(false);
  });
});

describe("shiftYmd", () => {
  it("shifts across month boundaries", () => {
    expect(shiftYmd("2026-06-10", -30)).toBe("2026-05-11");
    expect(shiftYmd("2026-06-30", 1)).toBe("2026-07-01");
  });
});

describe("isWithinLogWindow (default 30 days back)", () => {
  const TODAY = "2026-06-10";

  it("allows today and yesterday", () => {
    expect(isWithinLogWindow(TODAY, TODAY)).toBe(true);
    expect(isWithinLogWindow("2026-06-09", TODAY)).toBe(true);
  });

  it("rejects any future date", () => {
    expect(isWithinLogWindow("2026-06-11", TODAY)).toBe(false);
  });

  it("allows exactly 30 days back, rejects 31", () => {
    expect(isWithinLogWindow(shiftYmd(TODAY, -30), TODAY)).toBe(true);
    expect(isWithinLogWindow(shiftYmd(TODAY, -31), TODAY)).toBe(false);
  });
});
