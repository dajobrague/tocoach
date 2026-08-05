import { describe, expect, it } from "vitest";

import {
  bestSetByE1rm,
  computeE1rmSeries,
  computeRepMaxes,
  diffRecords,
  estimateOneRepMax,
  repBucket,
} from "./e1rm";

describe("estimateOneRepMax", () => {
  it("1 rep = el peso levantado, sin fórmula", () => {
    expect(estimateOneRepMax(105, 1)).toBe(105);
  });

  it("2-6 reps usa Brzycki", () => {
    // 100kg × 5 → 100 * 36 / 32 = 112.5
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(112.5, 5);
    expect(estimateOneRepMax(95, 6)).toBeCloseTo((95 * 36) / 31, 5);
    expect(estimateOneRepMax(100, 2)).toBeCloseTo((100 * 36) / 35, 5);
  });

  it("7+ reps usa Epley", () => {
    // 85kg × 8 → 85 * (1 + 8/30) ≈ 107.67
    expect(estimateOneRepMax(85, 8)).toBeCloseTo(85 * (1 + 8 / 30), 5);
    expect(estimateOneRepMax(70, 15)).toBeCloseTo(70 * 1.5, 5);
  });

  it("la frontera 6/7 cambia de fórmula", () => {
    expect(estimateOneRepMax(100, 6)).toBeCloseTo((100 * 36) / 31, 5);
    expect(estimateOneRepMax(100, 7)).toBeCloseTo(100 * (1 + 7 / 30), 5);
  });

  it("series no computables devuelven null", () => {
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(80, null)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(80, 0)).toBeNull();
    expect(estimateOneRepMax(-10, 5)).toBeNull();
    expect(estimateOneRepMax(Number.NaN, 5)).toBeNull();
  });
});

describe("repBucket", () => {
  it("agrupa 12 o más en '12+'", () => {
    expect(repBucket(11)).toBe("11");
    expect(repBucket(12)).toBe("12+");
    expect(repBucket(20)).toBe("12+");
  });
});

describe("bestSetByE1rm", () => {
  it("elige la serie con mayor e1RM, no la de mayor peso", () => {
    // 95×6 (e1rm ≈110.3) le gana a 100×1 (e1rm 100)
    const best = bestSetByE1rm([
      { reps: 1, weight_kg: 100 },
      { reps: 6, weight_kg: 95 },
    ]);

    expect(best?.weightKg).toBe(95);
    expect(best?.reps).toBe(6);
  });

  it("null cuando ninguna serie computa", () => {
    expect(bestSetByE1rm([{ reps: 10, weight_kg: null }])).toBeNull();
    expect(bestSetByE1rm([])).toBeNull();
  });
});

describe("computeE1rmSeries", () => {
  it("un punto por fecha con la mejor serie del día, orden ascendente", () => {
    const series = computeE1rmSeries([
      { date: "2026-07-14", sets: [{ reps: 6, weight_kg: 95 }] },
      { date: "2026-07-01", sets: [{ reps: 8, weight_kg: 80 }] },
      // segundo log el mismo día (otra sesión): gana el mejor
      { date: "2026-07-01", sets: [{ reps: 5, weight_kg: 92.5 }] },
    ]);

    expect(series.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-14"]);
    // Brzycki 92,5×5 ≈ 104,1 > Epley 80×8 ≈ 101,3
    expect(series[0]?.weightKg).toBe(92.5);
  });

  it("omite días sin serie computable y fechas vacías", () => {
    const series = computeE1rmSeries([
      { date: "", sets: [{ reps: 5, weight_kg: 100 }] },
      { date: "2026-07-02", sets: [{ reps: 10, weight_kg: null }] },
    ]);

    expect(series).toEqual([]);
  });
});

describe("computeRepMaxes", () => {
  it("mejor e1RM por bucket; a igual marca gana la primera fecha", () => {
    const maxes = computeRepMaxes([
      { date: "2026-06-10", sets: [{ reps: 6, weight_kg: 95 }] },
      { date: "2026-05-01", sets: [{ reps: 6, weight_kg: 95 }] },
      { date: "2026-07-01", sets: [{ reps: 6, weight_kg: 90 }] },
      { date: "2026-07-14", sets: [{ reps: 14, weight_kg: 70 }] },
      { date: "2026-07-20", sets: [{ reps: 12, weight_kg: 72.5 }] },
    ]);

    const six = maxes.find((m) => m.bucket === "6");

    expect(six?.weightKg).toBe(95);
    expect(six?.date).toBe("2026-05-01");

    // En "12+" ordena el e1RM, no el peso: 70×14 (≈102,7) > 72,5×12 (101,5)
    const high = maxes.find((m) => m.bucket === "12+");

    expect(high?.weightKg).toBe(70);
    expect(high?.reps).toBe(14);
  });

  it("en '12+' más reps al mismo peso reemplaza el récord (rep-PR)", () => {
    const maxes = computeRepMaxes([
      { date: "2026-06-01", sets: [{ reps: 12, weight_kg: 10 }] },
      { date: "2026-07-01", sets: [{ reps: 24, weight_kg: 10 }] },
    ]);

    const high = maxes.find((m) => m.bucket === "12+");

    // Epley 10×24 = 18 > 10×12 = 14: el récord es la serie de más reps.
    expect(high?.reps).toBe(24);
    expect(high?.e1rm).toBeCloseTo(18, 5);
    expect(high?.date).toBe("2026-07-01");
  });

  it("ordena buckets numéricos con 12+ al final", () => {
    const maxes = computeRepMaxes([
      {
        date: "2026-07-01",
        sets: [
          { reps: 12, weight_kg: 70 },
          { reps: 1, weight_kg: 105 },
          { reps: 8, weight_kg: 85 },
        ],
      },
    ]);

    expect(maxes.map((m) => m.bucket)).toEqual(["1", "8", "12+"]);
  });
});

describe("diffRecords", () => {
  const prior = computeRepMaxes([
    {
      date: "2026-06-01",
      sets: [
        { reps: 6, weight_kg: 95 },
        { reps: 8, weight_kg: 85 },
      ],
    },
  ]);

  it("detecta el récord cuando se supera el peso del bucket", () => {
    const records = diffRecords(prior, [{ reps: 6, weight_kg: 97.5 }]);

    expect(records).toEqual([
      { bucket: "6", reps: 6, weightKg: 97.5, previousWeightKg: 95 },
    ]);
  });

  it("igualar el récord NO es récord", () => {
    expect(diffRecords(prior, [{ reps: 6, weight_kg: 95 }])).toBeNull();
  });

  it("bucket sin precedente → previousWeightKg null", () => {
    const records = diffRecords(prior, [{ reps: 3, weight_kg: 100 }]);

    expect(records).toEqual([
      { bucket: "3", reps: 3, weightKg: 100, previousWeightKg: null },
    ]);
  });

  it("varios sets del mismo bucket: solo el mejor cuenta", () => {
    const records = diffRecords(prior, [
      { reps: 6, weight_kg: 96 },
      { reps: 6, weight_kg: 98 },
    ]);

    expect(records).toEqual([
      { bucket: "6", reps: 6, weightKg: 98, previousWeightKg: 95 },
    ]);
  });

  it("null cuando no hay nada nuevo", () => {
    expect(diffRecords(prior, [{ reps: 8, weight_kg: 80 }])).toBeNull();
    expect(diffRecords(prior, [])).toBeNull();
  });

  it("rep-PR en '12+' al mismo peso SÍ es récord (compara e1RM, no peso)", () => {
    const prior12 = computeRepMaxes([
      { date: "2026-06-01", sets: [{ reps: 12, weight_kg: 10 }] },
    ]);

    const records = diffRecords(prior12, [{ reps: 24, weight_kg: 10 }]);

    expect(records).toEqual([
      { bucket: "12+", reps: 24, weightKg: 10, previousWeightKg: 10 },
    ]);
  });

  it("menos reps en '12+' al mismo peso NO es récord", () => {
    const prior12 = computeRepMaxes([
      { date: "2026-06-01", sets: [{ reps: 24, weight_kg: 10 }] },
    ]);

    expect(diffRecords(prior12, [{ reps: 12, weight_kg: 10 }])).toBeNull();
  });
});
