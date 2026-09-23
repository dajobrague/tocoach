import { describe, expect, it } from "vitest";

import { computeShareCardStats } from "../share-card-stats";

const bench = (sets: Array<[number, number]>) => ({
  exerciseId: "bench",
  exerciseName: "Press banca",
  sets: sets.map(([reps, weight_kg]) => ({ reps, weight_kg })),
  durationSeconds: null,
  distanceMeters: null,
});

describe("computeShareCardStats", () => {
  it("suma series, reps y volumen e ignora filas vacías", () => {
    const stats = computeShareCardStats(
      [
        bench([
          [5, 80],
          [5, 80],
        ]),
        {
          exerciseId: "bike",
          exerciseName: "Bici",
          sets: [{ reps: null, weight_kg: null }],
          durationSeconds: 900,
          distanceMeters: 5000,
        },
      ],
      new Map()
    );

    expect(stats).toMatchObject({
      exercises: 2,
      sets: 2,
      reps: 10,
      volumeKg: 800,
      cardioSeconds: 900,
      cardioMeters: 5000,
      records: [],
    });
  });

  it("marca un récord solo si supera el historial previo", () => {
    const prior = new Map([
      ["bench", [{ date: "2026-09-01", sets: [{ reps: 5, weight_kg: 85 }] }]],
    ]);

    expect(
      computeShareCardStats(
        [
          bench([
            [5, 90],
            [5, 87.5],
          ]),
        ],
        prior
      ).records
    ).toEqual([{ exerciseName: "Press banca", reps: 5, weightKg: 90 }]);

    expect(computeShareCardStats([bench([[5, 80]])], prior).records).toEqual(
      []
    );
  });

  it("sin historial no celebra (primera vez)", () => {
    expect(
      computeShareCardStats([bench([[5, 100]])], new Map()).records
    ).toEqual([]);
  });
});
