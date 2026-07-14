import type { ExerciseLogFormDraft } from "@/lib/client/exercise-log-draft";

import { describe, expect, it } from "vitest";

import { shouldAutosaveDraft } from "../helpers";

// El form se hidrata PRELLENADO (reps de la prescripción, peso de
// lastUsedWeights), así que "tiene contenido" no implica "el cliente
// registró algo". Regresión: clientes que entraban a mirar una sesión
// por curiosidad y tocaban cualquier input creaban un log fantasma
// "En curso" con los valores prescritos — esos logs aparecían
// solapados en otras sesiones del día y como sesiones a medias en la
// vista del trainer.

const prefilled = (): ExerciseLogFormDraft => ({
  sets: [
    { reps: "12", weight: "80" },
    { reps: "12", weight: "80" },
    { reps: "10", weight: "80" },
  ],
  durationCompleted: "",
  distanceCompleted: "",
  intensityCompleted: "",
  avgHeartRate: "",
  notes: "",
});

const sig = (d: ExerciseLogFormDraft) => JSON.stringify(d);

describe("shouldAutosaveDraft", () => {
  it("does NOT autosave when the form is untouched (not dirty)", () => {
    const form = prefilled();

    expect(shouldAutosaveDraft(form, false, false, sig(form))).toBe(false);
  });

  it("does NOT autosave prefilled prescription values that match the hydrated baseline", () => {
    // Caso fantasma: el cliente abrió el modal por curiosidad, tocó un
    // input (dirty=true) pero el contenido sigue siendo el prellenado.
    const form = prefilled();

    expect(shouldAutosaveDraft(form, false, true, sig(form))).toBe(false);
  });

  it("autosaves once the client actually changes a value", () => {
    const baseline = prefilled();
    const edited = prefilled();

    edited.sets[0] = { reps: "11", weight: "82,5" };

    expect(shouldAutosaveDraft(edited, false, true, sig(baseline))).toBe(true);
  });

  it("does NOT autosave a form that differs from baseline but has no content", () => {
    const baseline = prefilled();
    const emptied: ExerciseLogFormDraft = {
      sets: [{ reps: "", weight: "" }],
      durationCompleted: "",
      distanceCompleted: "",
      intensityCompleted: "",
      avgHeartRate: "",
      notes: "",
    };

    expect(shouldAutosaveDraft(emptied, false, true, sig(baseline))).toBe(
      false
    );
  });

  it("applies the same baseline rule to cardio prefills", () => {
    const cardio: ExerciseLogFormDraft = {
      sets: [{ reps: "", weight: "" }],
      durationCompleted: "30",
      distanceCompleted: "5",
      intensityCompleted: "",
      avgHeartRate: "",
      notes: "",
    };

    // Prellenado intacto → no guardar.
    expect(shouldAutosaveDraft(cardio, true, true, sig(cardio))).toBe(false);

    // El cliente cambió la duración → guardar.
    const edited = { ...cardio, durationCompleted: "32" };

    expect(shouldAutosaveDraft(edited, true, true, sig(cardio))).toBe(true);
  });
});
