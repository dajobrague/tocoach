import { describe, expect, it } from "vitest";

import { DEFAULT_INTAKE_CONFIG } from "../intake";
import { validateFormResponse, validateQuestionsConfig } from "../validation";

describe("DEFAULT_INTAKE_CONFIG", () => {
  it("is a valid form config", () => {
    expect(validateQuestionsConfig(DEFAULT_INTAKE_CONFIG).valid).toBe(true);
  });

  it("asks injury/allergy details only when the answer is yes", () => {
    const base = {
      intake_goal: ["perder_grasa"],
      intake_experience: "menos_1",
      intake_days: 3,
    };

    expect(
      validateFormResponse(
        {
          form_type: "intake",
          response_date: "2026-11-18",
          answers: { ...base, intake_injuries: false, intake_allergies: false },
        },
        DEFAULT_INTAKE_CONFIG
      ).valid
    ).toBe(true);

    expect(
      validateFormResponse(
        {
          form_type: "intake",
          response_date: "2026-11-18",
          answers: { ...base, intake_injuries: true, intake_allergies: false },
        },
        DEFAULT_INTAKE_CONFIG
      ).valid
    ).toBe(false);
  });
});
