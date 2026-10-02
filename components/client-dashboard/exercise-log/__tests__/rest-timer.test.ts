import { describe, expect, it } from "vitest";

import { formatCountdown, remainingMs } from "../hooks/use-rest-timer";

describe("remainingMs", () => {
  it("resta contra el fin absoluto y nunca baja de 0", () => {
    expect(remainingMs(10_000, 4_000)).toBe(6_000);
    expect(remainingMs(10_000, 12_000)).toBe(0);
  });

  it("sigue correcto tras un salto largo (pestaña en segundo plano)", () => {
    const endAt = 1_000 + 90_000;

    expect(remainingMs(endAt, 1_000 + 60_000)).toBe(30_000);
  });
});

describe("formatCountdown", () => {
  it.each([
    [90_000, "1:30"],
    [60_000, "1:00"],
    [5_000, "0:05"],
    [4_100, "0:05"],
    [1, "0:01"],
    [0, "0:00"],
    [-500, "0:00"],
    [605_000, "10:05"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
