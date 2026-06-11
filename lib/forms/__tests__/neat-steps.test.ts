import type { QuestionConfig } from "../types";

import { describe, expect, it } from "vitest";

import { isStepsQuestion, relaxStepsRequirement } from "../neat-steps";
import { validateFormResponse } from "../validation";

const baseQuestion = (
  overrides: Partial<QuestionConfig> & Pick<QuestionConfig, "id" | "type">
): QuestionConfig => ({
  label: overrides.id,
  icon: "solar:walking-bold",
  enabled: true,
  required: false,
  ...overrides,
});

describe("isStepsQuestion", () => {
  it("matches canonical ids", () => {
    expect(isStepsQuestion(baseQuestion({ id: "steps", type: "number" }))).toBe(
      true
    );
    expect(isStepsQuestion(baseQuestion({ id: "pasos", type: "number" }))).toBe(
      true
    );
  });

  it("matches renamed ids containing step/paso", () => {
    expect(
      isStepsQuestion(baseQuestion({ id: "daily_steps", type: "number" }))
    ).toBe(true);
    expect(
      isStepsQuestion(baseQuestion({ id: "pasos_diarios", type: "number" }))
    ).toBe(true);
  });

  it("matches by unit", () => {
    expect(
      isStepsQuestion(
        baseQuestion({ id: "custom_123", type: "number", unit: "pasos" })
      )
    ).toBe(true);
  });

  it("does not match unrelated questions", () => {
    expect(
      isStepsQuestion(baseQuestion({ id: "sleep_hours", type: "number" }))
    ).toBe(false);
  });
});

describe("relaxStepsRequirement", () => {
  const stepsRequired = baseQuestion({
    id: "steps",
    type: "number",
    required: true,
  });
  const sleepRequired = baseQuestion({
    id: "sleep_hours",
    type: "number",
    required: true,
  });

  it("drops the required flag on steps questions when the client has no NEAT cards", () => {
    const relaxed = relaxStepsRequirement([stepsRequired, sleepRequired]);

    expect(relaxed.find((q) => q.id === "steps")?.required).toBe(false);
    expect(relaxed.find((q) => q.id === "sleep_hours")?.required).toBe(true);
  });

  it("does not mutate the input config", () => {
    relaxStepsRequirement([stepsRequired]);

    expect(stepsRequired.required).toBe(true);
  });

  it("makes a submission without a steps answer pass server validation", () => {
    // Regression: clients without NEAT cards never see the steps question
    // (filtered out client-side), so the server must not require it either.
    const config = [stepsRequired, sleepRequired];
    const submission = {
      form_type: "habits" as const,
      response_date: "2026-06-11",
      answers: { sleep_hours: 8 },
    };

    expect(validateFormResponse(submission, config).valid).toBe(false);
    expect(
      validateFormResponse(submission, relaxStepsRequirement(config)).valid
    ).toBe(true);
  });
});
