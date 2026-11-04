import type { FormConfigData } from "@/lib/forms/types";

import { describe, expect, it } from "vitest";

import { formResponseDraftStorageKey } from "@/lib/client/checkin-draft";
import { FORM_RESPONSE_UPSERT_CONFLICT, isFormType } from "@/lib/forms/types";
import { validateFormResponse, validateQuestionsConfig } from "@/lib/forms";
import {
  DEFAULT_WORKOUT_CONFIG,
  findWorkoutResponseForSession,
  parseWorkoutSessionId,
  readWorkoutLink,
  summarizeWorkoutAnswers,
} from "@/lib/forms/workout";

describe("isFormType", () => {
  it("acepta los tres tipos y nada más", () => {
    expect(isFormType("checkins")).toBe(true);
    expect(isFormType("habits")).toBe(true);
    expect(isFormType("workout")).toBe(true);
    expect(isFormType("Workout")).toBe(false);
    expect(isFormType(null)).toBe(false);
    expect(isFormType(undefined)).toBe(false);
  });
});

describe("plantilla por defecto", () => {
  it("es válida para el editor/servidor", () => {
    expect(validateQuestionsConfig(DEFAULT_WORKOUT_CONFIG).valid).toBe(true);
  });

  it("exige sensaciones y RPE, la nota es opcional", () => {
    const ok = validateFormResponse(
      {
        form_type: "workout",
        response_date: "2026-11-04",
        answers: { workout_feeling: 4, workout_rpe: 8 },
      },
      DEFAULT_WORKOUT_CONFIG
    );
    const missing = validateFormResponse(
      {
        form_type: "workout",
        response_date: "2026-11-04",
        answers: { workout_note: "bien" },
      },
      DEFAULT_WORKOUT_CONFIG
    );

    expect(ok.valid).toBe(true);
    expect(missing.valid).toBe(false);
  });
});

describe("enlace respuesta ↔ sesión", () => {
  it("lee session_id del metadata", () => {
    expect(readWorkoutLink({ session_id: "s1" })).toEqual({
      session_id: "s1",
    });
    expect(
      readWorkoutLink({ session_id: "s1", scheduled_session_id: "row1" })
    ).toEqual({ session_id: "s1", scheduled_session_id: "row1" });
    expect(readWorkoutLink(null)).toBeNull();
    expect(readWorkoutLink({ session_id: "" })).toBeNull();
    expect(readWorkoutLink({ session_id: 7 })).toBeNull();
  });

  it("rechaza ids absurdos en el POST", () => {
    expect(parseWorkoutSessionId({ session_id: "x".repeat(65) })).toBeNull();
    expect(parseWorkoutSessionId({})).toBeNull();
    expect(parseWorkoutSessionId({ session_id: "abc" })).toBe("abc");
  });

  it("encuentra la respuesta de ESA sesión, no la de otra del mismo día", () => {
    const responses = [
      { id: "a", metadata: { session_id: "fuerza" } },
      { id: "b", metadata: {} },
    ];

    expect(findWorkoutResponseForSession(responses, "fuerza")?.id).toBe("a");
    expect(findWorkoutResponseForSession(responses, "cardio")).toBeNull();
  });
});

describe("summarizeWorkoutAnswers", () => {
  it("formatea en el orden de la plantilla y salta lo vacío", () => {
    expect(
      summarizeWorkoutAnswers(DEFAULT_WORKOUT_CONFIG, {
        workout_rpe: 8,
        workout_feeling: 4,
        workout_note: "  ",
        stale_key: 3,
      })
    ).toEqual([
      {
        id: "workout_feeling",
        label: "Sensaciones",
        value: "4/5",
        isText: false,
      },
      {
        id: "workout_rpe",
        label: "Dureza (RPE)",
        value: "8/10",
        isText: false,
      },
    ]);
  });

  it("choice → etiqueta, boolean → Sí/No, desactivadas fuera", () => {
    const config: FormConfigData = {
      pages: [{ id: "p", title: "P", icon: "x", order: 0 }],
      questions: [
        {
          id: "mood",
          label: "Ánimo",
          icon: "x",
          type: "choice",
          enabled: true,
          required: false,
          choices: [
            { id: "c1", label: "Genial" },
            { id: "c2", label: "Regular" },
          ],
        },
        {
          id: "pain",
          label: "Dolor",
          icon: "x",
          type: "boolean",
          enabled: true,
          required: false,
        },
        {
          id: "off",
          label: "Off",
          icon: "x",
          type: "number",
          enabled: false,
          required: false,
        },
      ],
    };

    expect(
      summarizeWorkoutAnswers(config, { mood: "c1", pain: false, off: 3 }).map(
        (l) => l.value
      )
    ).toEqual(["Genial", "No"]);
  });
});

describe("una respuesta por sesión", () => {
  it("el upsert incluye la sesión en la clave de conflicto", () => {
    expect(FORM_RESPONSE_UPSERT_CONFLICT.split(",")).toEqual([
      "tenant_host",
      "client_id",
      "form_type",
      "response_date",
      "scheduled_session_id",
    ]);
  });

  it("el borrador del post-entreno es por sesión; el de hábitos no cambia", () => {
    expect(formResponseDraftStorageKey("7", "habits", "2026-11-04")).toBe(
      "tc_form_response_draft:7:habits:2026-11-04"
    );
    expect(
      formResponseDraftStorageKey("7", "workout", "2026-11-04", "s1")
    ).not.toBe(formResponseDraftStorageKey("7", "workout", "2026-11-04", "s2"));
  });
});
