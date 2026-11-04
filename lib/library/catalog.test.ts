import { describe, expect, it } from "vitest";

import {
  mapCategory,
  mapRepdbMuscles,
  searchKey,
  toCatalogRow,
  trainerCategory,
} from "./catalog";

describe("mapRepdbMuscles", () => {
  it("merges groups and keeps primary/secondary disjoint", () => {
    expect(
      mapRepdbMuscles(
        ["pectoralis_major", "serratus_anterior"],
        ["triceps_brachii", "pectoralis_major", "biceps_brachii", "brachialis"]
      )
    ).toEqual({
      primary: ["pectoral"],
      secondary: ["triceps", "biceps"],
    });
  });

  it("promotes the first secondary when every primary was dropped", () => {
    expect(
      mapRepdbMuscles(
        ["hip_flexors"],
        ["gluteus_maximus", "gluteus_medius", "quadriceps"]
      )
    ).toEqual({ primary: ["gluteo"], secondary: ["cuadriceps"] });
  });

  it("leaves an exercise with only dropped muscles empty", () => {
    expect(mapRepdbMuscles(["tibialis_anterior"], undefined)).toEqual({
      primary: [],
      secondary: [],
    });
  });
});

describe("catalog helpers", () => {
  it("shows every non-cardio type under Fuerza in the trainer app", () => {
    expect(trainerCategory("flexibility")).toBe("strength");
    expect(trainerCategory("olympic")).toBe("strength");
    expect(trainerCategory("cardio")).toBe("cardio");
  });

  it("maps categories and normalizes search text", () => {
    expect(mapCategory("stretching")).toBe("flexibility");
    expect(mapCategory("plyometrics")).toBe("plyometric");
    expect(mapCategory("weird")).toBe("other");
    expect(searchKey("  Extensión de Tríceps ")).toBe("extension de triceps");
  });

  it("builds a row with Spanish main text and i18n for the rest", () => {
    const row = toCatalogRow(
      {
        id: "bench-press",
        category: "strength",
        equipment: "barbell",
        animation: true,
        synonyms: ["flat bench"],
        primary_muscles: ["pectoralis_major"],
        name_es: "Press de banca",
        name_en: "Bench Press",
        instructions_es: ["Túmbate"],
      },
      { barbell: { name_es: "Barra" } }
    );

    expect(row).toMatchObject({
      slug: "bench-press",
      name: "Press de banca",
      equipment: "Barra",
      primary_muscles: ["pectoral"],
      has_animation: true,
      instructions: ["Túmbate"],
    });
    expect(row.search).toBe("press de banca bench press flat bench");
    expect(row.i18n.en?.name).toBe("Bench Press");
  });
});
