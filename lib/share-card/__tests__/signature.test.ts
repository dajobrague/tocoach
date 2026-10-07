import { describe, expect, it } from "vitest";

import { layoutSignature } from "../signature";

const set = (weightKg: number, reps: number, record = false) => ({
  weightKg,
  reps,
  record,
});

describe("layoutSignature", () => {
  it("una barra por serie, dentro del ancho y la más cargada a tope", () => {
    const bars = layoutSignature(
      [
        { kind: "strength", sets: [set(80, 8), set(105, 5, true)] },
        { kind: "strength", sets: [set(200, 10), set(200, 8)] },
        { kind: "cardio", minutes: 25 },
      ],
      936
    );
    const last = bars[bars.length - 1]!;

    expect(bars).toHaveLength(4 + 13);
    expect(last.x + last.width).toBeLessThanOrEqual(936 + 0.001);
    expect(bars[2]!.height).toBe(1);
    expect(bars.filter((bar) => bar.record)).toHaveLength(1);
    expect(bars.every((bar) => bar.height > 0 && bar.height <= 1)).toBe(true);
  });

  it("muchas series se estrechan sin salirse del ancho", () => {
    const sets = Array.from({ length: 6 }, () => set(50, 10));
    const bars = layoutSignature(
      Array.from({ length: 10 }, () => ({ kind: "strength" as const, sets })),
      888
    );
    const last = bars[bars.length - 1]!;

    expect(last.x + last.width).toBeCloseTo(888, 3);
  });

  it("ejercicio sin peso usa las reps y nada queda en cero", () => {
    const bars = layoutSignature(
      [{ kind: "strength", sets: [set(0, 12), set(0, 6)] }],
      936
    );

    expect(bars[0]!.height).toBeGreaterThan(bars[1]!.height);
    expect(layoutSignature([], 936)).toEqual([]);
  });
});
