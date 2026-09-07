import type { BucketedPoint } from "../types";

import { describe, expect, it } from "vitest";

import { buildTrainingCalendar } from "../calendar";

// 2026-09-02 es miércoles. 10 días consecutivos → 2 filas.
function day(ymd: string, strength: number, cardio: number): BucketedPoint {
  return { label: ymd.slice(8), value: { strength, cardio }, ymd };
}

describe("buildTrainingCalendar", () => {
  it("lays days out in Monday-first week rows and counts mixed days twice", () => {
    const cal = buildTrainingCalendar([
      day("2026-09-02", 3, 0), // mié — fuerza
      day("2026-09-03", 0, 0), // jue — descanso
      day("2026-09-04", 2, 1), // vie — ambos
      day("2026-09-05", 0, 1), // sáb — cardio
      day("2026-09-06", 0, 0), // dom — descanso
      day("2026-09-07", 4, 0), // lun — fuerza (nueva fila)
      day("2026-09-08", 0, 0), // mar — descanso
    ]);

    expect(cal.weeks).toHaveLength(2);
    expect(cal.weeks[0]?.slice(0, 2)).toEqual([null, null]);
    expect(cal.weeks[0]?.map((d) => d?.kind ?? "-")).toEqual([
      "-",
      "-",
      "strength",
      "rest",
      "both",
      "cardio",
      "rest",
    ]);
    expect(cal.weeks[1]?.map((d) => d?.kind ?? "-")).toEqual([
      "strength",
      "rest",
      "-",
      "-",
      "-",
      "-",
      "-",
    ]);
    // 7 días, pero fuerza 3 + cardio 2 + descanso 3 = 8: el mixto cuenta doble.
    expect(cal.totals).toEqual({ strength: 3, cardio: 2, rest: 3 });
  });

  it("ignores non-daily buckets (no ymd)", () => {
    const cal = buildTrainingCalendar([
      { label: "1-7 Sep", value: { strength: 5, cardio: 2 } },
    ]);

    expect(cal.weeks).toEqual([]);
    expect(cal.totals).toEqual({ strength: 0, cardio: 0, rest: 0 });
  });
});
