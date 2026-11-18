import type { FormConfigData, QuestionConfig } from "@/lib/forms/types";

import { describe, expect, it } from "vitest";

import {
  validateFormResponse,
  validateQuestionConfig,
} from "@/lib/forms/validation";
import { summarizeWorkoutAnswers } from "@/lib/forms/workout";

const pain: QuestionConfig = {
  id: "pain",
  label: "Dolor",
  icon: "x",
  type: "scale",
  scaleMinLabel: "Ningún dolor",
  scaleMaxLabel: "Peor dolor imaginable",
  enabled: true,
  required: true,
  pageId: "p",
};
const config: FormConfigData = {
  pages: [{ id: "p", title: "P", icon: "x", order: 0 }],
  questions: [pain],
};
const valid = (answer: unknown) =>
  validateFormResponse(
    {
      form_type: "habits",
      response_date: "2026-11-18",
      answers: { pain: answer },
    },
    config
  ).valid;

describe("escala 0–10", () => {
  it("acepta enteros de 0 a 10 (0 cuenta como respondida)", () => {
    expect(valid(0)).toBe(true);
    expect(valid(10)).toBe(true);
  });

  it("rechaza fuera de rango, decimales y texto", () => {
    expect(valid(11)).toBe(false);
    expect(valid(-1)).toBe(false);
    expect(valid(3.5)).toBe(false);
    expect(valid("5")).toBe(false);
  });

  it("la config valida los textos de los extremos", () => {
    expect(validateQuestionConfig(pain).valid).toBe(true);
    expect(
      validateQuestionConfig({ ...pain, scaleMaxLabel: "x".repeat(61) }).valid
    ).toBe(false);
  });

  it("el resumen lo muestra sobre 10", () => {
    expect(summarizeWorkoutAnswers(config, { pain: 7 })[0]?.value).toBe("7/10");
  });
});
