import type { FormConfigData, QuestionConfig } from "@/lib/forms/types";

import { describe, expect, it } from "vitest";

import {
  numberRangeError,
  parseNumberRange,
  validateFormResponse,
  validateQuestionConfig,
  withNumberRange,
} from "@/lib/forms/validation";
import { DEFAULT_WORKOUT_CONFIG } from "@/lib/forms/workout";

const q = (extra: Partial<QuestionConfig> = {}): QuestionConfig => ({
  id: "weight",
  label: "Peso",
  icon: "x",
  type: "number",
  enabled: true,
  required: false,
  ...extra,
});

const configOf = (question: QuestionConfig): FormConfigData => ({
  pages: [{ id: "p", title: "P", icon: "x", order: 0 }],
  questions: [{ ...question, pageId: "p" }],
});

describe("rango min/max en respuestas (todos los form_type)", () => {
  it("check-ins y hábitos también lo respetan", () => {
    const config = configOf(q({ min: 30, max: 300 }));

    for (const form_type of ["checkins", "habits"] as const) {
      expect(
        validateFormResponse(
          { form_type, response_date: "2026-11-04", answers: { weight: 20 } },
          config
        ).valid
      ).toBe(false);
      expect(
        validateFormResponse(
          { form_type, response_date: "2026-11-04", answers: { weight: 80 } },
          config
        ).valid
      ).toBe(true);
    }
  });

  it("sin min/max nada cambia (plantillas antiguas)", () => {
    expect(
      validateFormResponse(
        {
          form_type: "habits",
          response_date: "2026-11-04",
          answers: { weight: -999999 },
        },
        configOf(q())
      ).valid
    ).toBe(true);
  });

  it("el RPE por defecto del post-entreno va de 1 a 10", () => {
    const res = (rpe: number) =>
      validateFormResponse(
        {
          form_type: "workout",
          response_date: "2026-11-04",
          answers: { workout_feeling: 3, workout_rpe: rpe },
        },
        DEFAULT_WORKOUT_CONFIG
      );

    expect(res(1).valid).toBe(true);
    expect(res(10).valid).toBe(true);
    expect(res(0).valid).toBe(false);
    expect(res(11).errors[0]?.field).toBe("workout_rpe");
  });

  it("límites inclusivos y de un solo lado", () => {
    expect(numberRangeError({ min: 1, max: 10 }, 10)).toBeNull();
    expect(numberRangeError({ min: 1, max: 10 }, 10.5)).toBe(
      "Debe estar entre 1 y 10"
    );
    expect(numberRangeError({ min: 0 }, -1)).toBe("Debe ser 0 o más");
    expect(numberRangeError({ max: 5 }, 6)).toBe("Debe ser 5 o menos");
    expect(numberRangeError({}, 1e9)).toBeNull();
  });
});

describe("rango en la config de la pregunta", () => {
  it("rechaza min > max y valores no numéricos", () => {
    expect(validateQuestionConfig(q({ min: 10, max: 1 })).valid).toBe(false);
    expect(
      validateQuestionConfig({ ...q(), min: "1" } as unknown as QuestionConfig)
        .valid
    ).toBe(false);
    expect(validateQuestionConfig(q({ min: 1, max: 10 })).valid).toBe(true);
  });

  it("parseNumberRange: vacío = sin límite, coma decimal, errores", () => {
    expect(parseNumberRange("", "")).toEqual({ ok: true, range: {} });
    expect(parseNumberRange("1", "7,5")).toEqual({
      ok: true,
      range: { min: 1, max: 7.5 },
    });
    expect(parseNumberRange("abc", "").ok).toBe(false);
    expect(parseNumberRange("5", "2").ok).toBe(false);
  });

  it("withNumberRange quita límites que se vacían", () => {
    const next = withNumberRange(q({ min: 1, max: 10 }), { max: 8 });

    expect(next.max).toBe(8);
    expect("min" in next).toBe(false);
  });
});
