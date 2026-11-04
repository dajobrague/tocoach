import type { FormConfigData, QuestionConfig } from "@/lib/forms/types";

import { RATING_MAX, flattenQuestions } from "@/lib/forms/types";

/**
 * Formulario post-entreno (`form_type = 'workout'`).
 *
 * - Lo configura el entrenador en /trainer/settings/forms/workout. La
 *   plantilla del tenant ES la configuración (sin copia por cliente) y
 *   `form_templates.is_active` es el interruptor: apagado = el cliente no ve
 *   nada y el entrenador tampoco ve respuestas.
 * - Una respuesta por cliente y día (UNIQUE de form_responses). Se enlaza a la
 *   sesión completada con `response_date` = fecha programada y
 *   `metadata.session_id` / `metadata.scheduled_session_id`.
 */

export const WORKOUT_FORM_TEMPLATE_NAME = "Formulario post-entreno";

export const DEFAULT_WORKOUT_CONFIG: FormConfigData = {
  pages: [
    {
      id: "workout_feedback",
      title: "Cómo fue el entreno",
      icon: "solar:dumbbell-large-minimalistic-bold",
      order: 0,
    },
  ],
  questions: [
    {
      id: "workout_feeling",
      label: "Sensaciones",
      fullQuestion: "¿Cómo te has sentido?",
      icon: "solar:emoji-funny-circle-bold",
      type: "rating",
      enabled: true,
      required: true,
      pageId: "workout_feedback",
    },
    {
      id: "workout_rpe",
      label: "Dureza (RPE)",
      fullQuestion: "¿Qué tan duro fue el entreno? (RPE de 1 a 10)",
      icon: "solar:fire-bold",
      type: "number",
      unit: "/10",
      min: 1,
      max: 10,
      enabled: true,
      required: true,
      pageId: "workout_feedback",
    },
    {
      id: "workout_note",
      label: "Nota",
      fullQuestion: "¿Algo que quieras contarle a tu entrenador?",
      icon: "solar:pen-new-square-bold",
      type: "text",
      enabled: true,
      required: false,
      pageId: "workout_feedback",
    },
  ],
};

export interface WorkoutResponseLink {
  session_id: string;
  scheduled_session_id?: string;
}

/** Enlace sesión ↔ respuesta guardado en `form_responses.metadata`. */
export function readWorkoutLink(metadata: unknown): WorkoutResponseLink | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;

  if (typeof m.session_id !== "string" || m.session_id.length === 0) {
    return null;
  }

  return typeof m.scheduled_session_id === "string"
    ? {
        session_id: m.session_id,
        scheduled_session_id: m.scheduled_session_id,
      }
    : { session_id: m.session_id };
}

/** `session_id` del POST: string no vacía y acotada (es un uuid). */
export function parseWorkoutSessionId(metadata: unknown): string | null {
  const link = readWorkoutLink(metadata);

  if (!link || link.session_id.length > 64) return null;

  return link.session_id;
}

/** La respuesta (de las del día) que pertenece a esta sesión, si hay. */
export function findWorkoutResponseForSession<T extends { metadata?: unknown }>(
  responses: readonly T[],
  sessionId: string
): T | null {
  return (
    responses.find(
      (r) => readWorkoutLink(r.metadata)?.session_id === sessionId
    ) ?? null
  );
}

export interface WorkoutAnswerLine {
  id: string;
  label: string;
  value: string;
  /** Texto libre: se pinta como cita, no como dato. */
  isText: boolean;
}

function formatAnswer(q: QuestionConfig, answer: unknown): string | null {
  if (answer === undefined || answer === null || answer === "") return null;

  switch (q.type) {
    case "rating":
      return typeof answer === "number" ? `${answer}/${RATING_MAX}` : null;
    case "number": {
      if (typeof answer !== "number" || Number.isNaN(answer)) return null;
      const n = answer.toLocaleString("es-ES", { maximumFractionDigits: 2 });

      if (!q.unit) return n;

      return q.unit.startsWith("/") ? `${n}${q.unit}` : `${n} ${q.unit}`;
    }
    case "boolean":
      return typeof answer === "boolean" ? (answer ? "Sí" : "No") : null;
    case "text":
      return typeof answer === "string" ? answer.trim() || null : null;
    case "choice": {
      const choice = q.choices?.find((c) => c.id === answer);

      return choice?.label ?? null;
    }
    case "multi_choice": {
      if (!Array.isArray(answer)) return null;
      const labels = answer
        .map((id) => q.choices?.find((c) => c.id === id)?.label)
        .filter((l): l is string => typeof l === "string");

      return labels.length > 0 ? labels.join(", ") : null;
    }
    default:
      // photo / group: no caben en un resumen compacto.
      return null;
  }
}

/**
 * Respuestas legibles en el orden de la plantilla (incluye subpreguntas de
 * grupos). Preguntas sin respuesta o desactivadas no aparecen.
 */
export function summarizeWorkoutAnswers(
  config: QuestionConfig[] | FormConfigData,
  answers: Record<string, unknown>
): WorkoutAnswerLine[] {
  const out: WorkoutAnswerLine[] = [];

  for (const q of flattenQuestions(config)) {
    if (!q.enabled) continue;
    const value = formatAnswer(q, answers[q.id]);

    if (value === null) continue;
    out.push({
      id: q.id,
      label: q.shortLabel || q.label,
      value,
      isText: q.type === "text",
    });
  }

  return out;
}
