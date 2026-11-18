import type { FormConfigData, QuestionConfig } from "./types";

/**
 * Lógica condicional de visibilidad — fuente única de verdad.
 *
 * Hasta ahora esta función vivía duplicada en `lib/forms/validation.ts` y
 * `components/client-dashboard/dynamic-form-modal.tsx`. Se consolida aquí
 * para evitar divergencia cliente/servidor y para poder extenderla (p.ej.
 * para `choice` / `multi_choice`) en un solo lugar.
 *
 * Reglas:
 * - Sin `conditionalOn`: siempre visible.
 * - Legacy rating → follow-up: `conditionalValue === true` con parent `rating`
 *   (answer numérico 1–5) cuenta como truthy.
 * - Boolean: igualdad exacta.
 * - Number: `<=` (originalmente pensado para "rating ≤ 3" en preguntas de
 *   insatisfacción, mantenido por compatibilidad).
 * - String: igualdad exacta si el parent guarda un string (choice).
 *   Si el parent guarda un array (multi_choice), `array.includes(string)`.
 * - Fallback: truthy check sobre el answer del parent.
 */
export function shouldShowQuestion(
  question: QuestionConfig,
  answers: Record<string, unknown>
): boolean {
  if (!question.conditionalOn) {
    return true;
  }

  const conditionalAnswer = answers[question.conditionalOn];

  // Legacy: conditionalValue === true con parent rating (1–5) → mostrar.
  if (
    question.conditionalValue === true &&
    typeof conditionalAnswer === "number" &&
    conditionalAnswer >= 1 &&
    conditionalAnswer <= 5
  ) {
    return true;
  }

  if (typeof question.conditionalValue === "boolean") {
    return conditionalAnswer === question.conditionalValue;
  }

  if (typeof question.conditionalValue === "number") {
    return (
      typeof conditionalAnswer === "number" &&
      conditionalAnswer <= question.conditionalValue
    );
  }

  if (typeof question.conditionalValue === "string") {
    // choice: string exacto. multi_choice: array.includes.
    if (Array.isArray(conditionalAnswer)) {
      return conditionalAnswer.includes(question.conditionalValue);
    }

    return conditionalAnswer === question.conditionalValue;
  }

  return Boolean(conditionalAnswer);
}

// ── Editor: "Mostrar solo si…" ──────────────────────────────────────────
// Solo preguntas Sí/No y de opciones pueden controlar otra: su respuesta se
// entiende sin ambigüedad (la regla numérica `<=` de arriba es legacy).

const PARENT_TYPES = new Set(["boolean", "choice", "multi_choice"]);

/** Preguntas en el orden en que las ve el cliente (páginas, luego lista). */
function inFormOrder(config: FormConfigData): QuestionConfig[] {
  const firstPage = config.pages[0]?.id;
  const pages = [...config.pages].sort((a, b) => a.order - b.order);

  return pages.flatMap((page) =>
    config.questions.filter((q) => (q.pageId || firstPage) === page.id)
  );
}

/**
 * Preguntas que pueden controlar a `childId`: Sí/No u opciones, activas y
 * ANTERIORES en el formulario (el cliente las responde antes; además así no
 * puede haber ciclos).
 */
export function conditionParentCandidates(
  config: FormConfigData,
  childId: string
): QuestionConfig[] {
  const ordered = inFormOrder(config);
  const childIndex = ordered.findIndex((q) => q.id === childId);

  return ordered
    .slice(0, Math.max(childIndex, 0))
    .filter((q) => q.enabled && PARENT_TYPES.has(q.type));
}

export interface ConditionOption {
  /** Clave para un Select: "true" / "false" o el id de la opción. */
  key: string;
  value: boolean | string;
  label: string;
}

export function conditionOptions(parent: QuestionConfig): ConditionOption[] {
  if (parent.type === "boolean") {
    return [
      { key: "true", value: true, label: "Sí" },
      { key: "false", value: false, label: "No" },
    ];
  }

  return (parent.choices ?? []).map((c) => ({
    key: c.id,
    value: c.id,
    label: c.label,
  }));
}

/** «Solo si «¿Has entrenado hoy?»: Sí» — null si no es condicional. */
export function describeCondition(
  config: FormConfigData,
  question: QuestionConfig
): string | null {
  if (!question.conditionalOn) return null;
  const parent = config.questions.find((q) => q.id === question.conditionalOn);

  if (!parent) return "Condicional";
  const option = conditionOptions(parent).find(
    (o) => o.value === question.conditionalValue
  );
  const title = parent.shortLabel || parent.label;

  if (!option) return `Solo si «${title}»`;

  return parent.type === "multi_choice"
    ? `Solo si «${title}» incluye ${option.label}`
    : `Solo si «${title}»: ${option.label}`;
}

/**
 * Al borrar una pregunta, sus dependientes dejan de ser condicionales: con
 * el padre ausente quedarían ocultas para siempre.
 */
export function removeConditionsOn(
  questions: QuestionConfig[],
  parentId: string
): QuestionConfig[] {
  return questions.map((q) => {
    if (q.conditionalOn !== parentId) return q;
    const { conditionalOn: _on, conditionalValue: _value, ...rest } = q;

    void _on;
    void _value;

    return rest;
  });
}
