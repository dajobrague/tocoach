import type { AdapterContext } from "../adapters/types";
import type { FormResponse } from "@/lib/forms/types";

import { describe, expect, it } from "vitest";

import { mergeResponses } from "../adapters/form-question";

const row = (date: string, answers: Record<string, unknown>) =>
  ({ response_date: date, answers }) as unknown as FormResponse;

const ctx = {
  formResponses: {
    habits: [
      row("2026-11-01", { body_weight: 80 }),
      row("2026-11-02", { sleep: 7 }), // sin peso: lo rellena el check-in
    ],
    checkins: [
      row("2026-11-01", { body_weight: 99 }), // la fuente principal gana
      row("2026-11-02", { body_weight: 79.5, waist: 82 }),
      row("2026-11-03", { body_weight: "" }), // vacío: no cuenta
      row("2026-11-04", { old_weight: 78 }),
      row("2026-11-04", { body_weight: 70 }), // ya cubierto por old_weight
    ],
  },
} as unknown as AdapterContext;

const weights = (rows: FormResponse[]) =>
  rows
    .filter((r) => r.answers && "body_weight" in r.answers)
    .map((r) => [r.response_date, r.answers?.body_weight]);

describe("mergeResponses", () => {
  it("returns the main source untouched without also_from", () => {
    expect(
      mergeResponses(ctx, { formType: "habits", questionId: "body_weight" })
    ).toBe(ctx.formResponses.habits);
  });

  it("fills only the days the main source lacks, first extra source wins", () => {
    const merged = mergeResponses(ctx, {
      formType: "habits",
      questionId: "body_weight",
      mergeFrom: [
        { formType: "checkins", questionId: "old_weight" },
        { formType: "checkins", questionId: "body_weight" },
      ],
    });

    expect(weights(merged)).toEqual([
      ["2026-11-01", 80],
      ["2026-11-04", 78],
      ["2026-11-02", 79.5],
    ]);
  });
});
