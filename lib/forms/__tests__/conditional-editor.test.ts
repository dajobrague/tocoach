import type { FormConfigData, QuestionConfig } from "../types";

import { describe, expect, it } from "vitest";

import {
  conditionOptions,
  conditionParentCandidates,
  describeCondition,
  removeConditionsOn,
  shouldShowQuestion,
} from "../conditional";

const q = (over: Partial<QuestionConfig>): QuestionConfig =>
  ({
    icon: "x",
    enabled: true,
    required: false,
    type: "text",
    label: over.id,
    ...over,
  }) as QuestionConfig;

const config: FormConfigData = {
  pages: [
    { id: "p2", title: "Sesión", icon: "x", order: 1 },
    { id: "p1", title: "Mañana", icon: "x", order: 0 },
  ],
  questions: [
    q({ id: "rpe", type: "scale", pageId: "p2" }),
    q({
      id: "trained",
      label: "¿Has entrenado?",
      type: "boolean",
      pageId: "p1",
    }),
    q({ id: "sleep", type: "number", pageId: "p1" }),
    q({
      id: "kind",
      label: "Tipo",
      type: "multi_choice",
      choices: [
        { id: "gym", label: "Gimnasio" },
        { id: "run", label: "Correr" },
      ],
      pageId: "p2",
      enabled: false,
    }),
    q({
      id: "notes",
      pageId: "p2",
      conditionalOn: "trained",
      conditionalValue: true,
    }),
  ],
};

describe("editor de condiciones", () => {
  it("solo ofrece Sí/No u opciones, activas y anteriores (orden de páginas)", () => {
    // "trained" está en la página 1 aunque venga después en la lista.
    expect(conditionParentCandidates(config, "rpe").map((x) => x.id)).toEqual([
      "trained",
    ]);
    // nada antes de la primera pregunta
    expect(conditionParentCandidates(config, "trained")).toEqual([]);
    // "kind" está desactivada → no cuenta
    expect(conditionParentCandidates(config, "notes").map((x) => x.id)).toEqual(
      ["trained"]
    );
  });

  it("opciones de respuesta y texto del badge", () => {
    expect(conditionOptions(config.questions[1]!).map((o) => o.label)).toEqual([
      "Sí",
      "No",
    ]);
    expect(describeCondition(config, config.questions[4]!)).toBe(
      "Solo si «¿Has entrenado?»: Sí"
    );
    expect(
      describeCondition(
        config,
        q({ id: "x", conditionalOn: "kind", conditionalValue: "run" })
      )
    ).toBe("Solo si «Tipo» incluye Correr");
  });

  it("borrar el padre libera a sus dependientes", () => {
    const out = removeConditionsOn(config.questions, "trained");

    expect(out[4]).not.toHaveProperty("conditionalOn");
    expect(shouldShowQuestion(out[4]!, {})).toBe(true);
  });

  it("la regla del cliente encaja con lo que guarda el editor", () => {
    const child = config.questions[4]!;

    expect(shouldShowQuestion(child, { trained: true })).toBe(true);
    expect(shouldShowQuestion(child, { trained: false })).toBe(false);
    expect(shouldShowQuestion(child, {})).toBe(false);
  });
});
