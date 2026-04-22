import type { QuestionConfig } from "./types";

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
