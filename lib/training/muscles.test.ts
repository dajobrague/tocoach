import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  MUSCLES,
  legacyToMuscles,
  normalizeExerciseName,
  parseMuscles,
  pickMuscleSuggestion,
  primaryMuscleRequired,
} from "./muscles";

describe("muscle taxonomy", () => {
  it("matches the CHECK list in the migration", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "../../supabase/migrations/20261027120000_exercise_muscles.sql"
      ),
      "utf8"
    );
    const inSql = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

    expect(inSql.sort()).toEqual(MUSCLES.map((m) => m.id).sort());
  });
});

describe("parseMuscles", () => {
  it("leaves the columns alone when both fields are absent", () => {
    expect(parseMuscles(undefined, undefined)).toBeUndefined();
  });

  it("rejects unknown ids and non-arrays", () => {
    expect(parseMuscles(["pecho"], [])).toEqual({
      ok: false,
      error: "Músculo no válido",
    });
    expect(parseMuscles("pectoral", undefined)?.ok).toBe(false);
  });

  it("dedupes and drops secondaries already picked as primary", () => {
    expect(
      parseMuscles(["pectoral", "pectoral"], ["triceps", "pectoral"])
    ).toEqual({
      ok: true,
      muscles: { primary: ["pectoral"], secondary: ["triceps"] },
    });
  });
});

// Cases are real muscle_groups values from prod (Oct 27).
describe("legacyToMuscles", () => {
  const map = (groups: string[], name = "") => legacyToMuscles(groups, name);

  it("first muscle is primary, the rest secondary", () => {
    expect(map(["Pectoral", "Tríceps", "Deltoides anterior"])).toEqual({
      primary: ["pectoral"],
      secondary: ["triceps", "deltoides_anterior"],
      unknown: [],
    });
  });

  it("splits comma, semicolon and 'y' joined strings", () => {
    expect(map(["cuádriceps; isquios; glúteo mayor"]).secondary).toEqual([
      "isquiotibiales",
      "gluteo_mayor",
    ]);
    expect(map(["Gemelos (gastrocnemio, sóleo)"])).toMatchObject({
      primary: ["gemelos"],
      secondary: ["soleo"],
    });
  });

  it("keeps specific phrases over the generic word", () => {
    expect(map(["Pecho (porción superior/clavicular)"]).primary).toEqual([
      "pectoral_superior",
    ]);
    expect(map(["Hombros (deltoides posterior)"]).primary).toEqual([
      "deltoides_posterior",
    ]);
    expect(map(["Deltoides medial"]).primary).toEqual(["deltoides_lateral"]);
    expect(map(["Bíceps femoral"]).primary).toEqual(["isquiotibiales"]);
    expect(map(["Bíceps braquial", "Braquial"]).secondary).toEqual([
      "braquial",
    ]);
    expect(map(["Recto femoral"]).primary).toEqual(["cuadriceps"]);
  });

  it("resolves ambiguous words with the exercise name", () => {
    expect(map(["Hombro"], "Elevaciones laterales").primary).toEqual([
      "deltoides_lateral",
    ]);
    expect(map(["Hombros"], "Face pull").primary).toEqual([
      "deltoides_posterior",
    ]);
    expect(map(["Hombro"], "Press militar").primary).toEqual([
      "deltoides_anterior",
    ]);
    expect(map(["Trapecio"], "Encogimientos con barra").primary).toEqual([
      "trapecio_superior",
    ]);
    expect(map(["Trapecio"], "Remo con barra").primary).toEqual([
      "trapecio_medio",
    ]);
    expect(map(["Pectoral"], "Press inclinado").primary).toEqual([
      "pectoral_superior",
    ]);
  });

  it("covers typos trainers actually wrote", () => {
    expect(map(["Deltiodes anterior"]).primary).toEqual(["deltoides_anterior"]);
    expect(map(["Isquitibiales"]).primary).toEqual(["isquiotibiales"]);
    expect(map(["Aducctores"]).primary).toEqual(["aductores"]);
  });

  it("reports words it can't place instead of guessing", () => {
    expect(map(["Fullbody", "foco en cabeza corta"])).toEqual({
      primary: [],
      secondary: [],
      unknown: ["fullbody", "foco en cabeza corta"],
    });
  });
});

describe("legacyToMuscles — leftovers from the prod dry run", () => {
  it("maps singular 'deltoide', TFL and 'quads'", () => {
    expect(legacyToMuscles(["Deltoide posterior"], "").primary).toEqual([
      "deltoides_posterior",
    ]);
    expect(legacyToMuscles(["Tensor de la fascia lata"], "").primary).toEqual([
      "gluteo_medio",
    ]);
    expect(legacyToMuscles(["Quads"], "").primary).toEqual(["cuadriceps"]);
    expect(legacyToMuscles(["Braquioradial"], "").primary).toEqual([
      "antebrazo",
    ]);
  });
});

describe("primaryMuscleRequired", () => {
  it("only cardio may skip the primary muscle", () => {
    expect(primaryMuscleRequired("cardio")).toBe(false);
    expect(primaryMuscleRequired("strength")).toBe(true);
    expect(primaryMuscleRequired("")).toBe(true);
  });
});

describe("pickMuscleSuggestion", () => {
  it("returns the most common valid pick, ignoring empty and unknown rows", () => {
    const bench = {
      primary_muscles: ["pectoral"],
      secondary_muscles: ["triceps"],
    };

    expect(
      pickMuscleSuggestion([
        { primary_muscles: ["triceps"], secondary_muscles: [] },
        bench,
        bench,
        { primary_muscles: [], secondary_muscles: ["triceps"] },
        { primary_muscles: ["pecho"], secondary_muscles: [] },
      ])
    ).toEqual({ primary: ["pectoral"], secondary: ["triceps"] });
  });

  it("returns null when nobody tagged it", () => {
    expect(pickMuscleSuggestion([])).toBeNull();
  });
});

describe("normalizeExerciseName", () => {
  it("ignores case and stray spaces", () => {
    expect(normalizeExerciseName("  Remo con  Barra ")).toBe("remo con barra");
  });
});
