// NEAT ↔ pregunta de pasos: heurística compartida cliente/servidor.
//
// El modal del cliente OCULTA la pregunta de pasos del formulario de hábitos
// cuando el cliente no tiene NEAT cards configuradas (ver `visibleQuestions`
// en dynamic-form-modal.tsx). Esa decisión es puramente client-side: el
// validador del servidor (`validateFormResponse`) no sabe de NEAT cards, así
// que si el trainer marcó "pasos" como required, el server rechazaba con 400
// un formulario cuyo campo el cliente NUNCA pudo ver ni contestar — el bug
// "mando enviar y no pasa nada". La heurística vive aquí para que ambos
// lados apliquen exactamente el mismo criterio.

import type { QuestionConfig } from "./types";

/**
 * Heurística para detectar la pregunta "de pasos" del formulario de hábitos.
 *
 * Históricamente sólo se comprobaba `id === "steps" || id === "pasos"`, pero
 * trainers que renombran la pregunta (p.ej. `daily_steps`, `pasos_diarios`)
 * bypassaban el filtro. Ampliamos a unit/id-contains para atrapar más casos
 * sin falsos positivos evidentes. Mantenemos los ids canónicos como match
 * exacto por compatibilidad.
 */
export function isStepsQuestion(q: QuestionConfig): boolean {
  const id = q.id.toLowerCase();

  if (id === "steps" || id === "pasos") return true;
  if (id.includes("step") || id.includes("paso")) return true;
  if (q.unit && /^(pasos|steps)$/i.test(q.unit)) return true;

  return false;
}

/**
 * Neutraliza el `required` de las preguntas de pasos. Para clientes sin NEAT
 * cards la pregunta no se renderiza, así que exigirla equivale a bloquear el
 * envío del formulario para siempre. No muta el config de entrada.
 */
export function relaxStepsRequirement(
  questions: QuestionConfig[]
): QuestionConfig[] {
  return questions.map((q) =>
    q.required && isStepsQuestion(q) ? { ...q, required: false } : q
  );
}
