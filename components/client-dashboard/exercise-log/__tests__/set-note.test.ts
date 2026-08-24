import type { ExerciseLogFormDraft } from "@/lib/client/exercise-log-draft";

import { describe, expect, it } from "vitest";

import {
  buildBaseFormData,
  hasMeaningfulFormData,
  type ExerciseShape,
} from "../helpers";

// Nota por serie ("8 izq / 10 der"): el input de reps es numérico, así
// que las diferencias por lado en ejercicios unilaterales viajan como
// nota de texto por set, guardada en exercise_log_sets.metadata.note.

const exercise = (overrides: Partial<ExerciseShape> = {}): ExerciseShape => ({
  id: "ex-1",
  name: "Curl con mancuerna",
  sets: 2,
  reps: "10",
  ...overrides,
});

const emptyForm = (
  sets: ExerciseLogFormDraft["sets"]
): ExerciseLogFormDraft => ({
  sets,
  durationCompleted: "",
  distanceCompleted: "",
  intensityCompleted: "",
  avgHeartRate: "",
  notes: "",
});

describe("buildBaseFormData — nota por serie", () => {
  it("hidrata metadata.note del log existente como note del draft", () => {
    const form = buildBaseFormData(exercise(), {
      finalized_at: "2026-08-20T10:00:00Z",
      sets: [
        {
          set_number: 1,
          reps: 10,
          weight_kg: 12,
          metadata: { note: "8 izq / 10 der" },
        },
        { set_number: 2, reps: 10, weight_kg: 12, metadata: {} },
      ],
    });

    expect(form.sets[0]?.note).toBe("8 izq / 10 der");
    expect(form.sets[1]?.note).toBeUndefined();
  });

  it("sets sin metadata (logs viejos) no llevan note", () => {
    const form = buildBaseFormData(exercise(), {
      finalized_at: "2026-08-20T10:00:00Z",
      sets: [{ set_number: 1, reps: 8, weight_kg: 20 }],
    });

    expect(form.sets[0]?.note).toBeUndefined();
  });

  it("una nota sola (sin reps/peso) cuenta como datos usables del log", () => {
    // Si el cliente solo dejó la nota, al reabrir debe verla — no caer a
    // la prescripción como si el log estuviera vacío.
    const form = buildBaseFormData(exercise(), {
      finalized_at: null,
      sets: [
        {
          set_number: 1,
          reps: null,
          weight_kg: null,
          metadata: { note: "molestia hombro" },
        },
      ],
    });

    expect(form.sets).toHaveLength(1);
    expect(form.sets[0]?.note).toBe("molestia hombro");
  });
});

describe("hasMeaningfulFormData — nota por serie", () => {
  it("una nota de serie sin reps ni peso ya es contenido", () => {
    const form = emptyForm([{ reps: "", weight: "", note: "8 izq / 10 der" }]);

    expect(hasMeaningfulFormData(form, false)).toBe(true);
  });

  it("nota vacía o solo espacios no cuenta", () => {
    const form = emptyForm([{ reps: "", weight: "", note: "   " }]);

    expect(hasMeaningfulFormData(form, false)).toBe(false);
  });
});
