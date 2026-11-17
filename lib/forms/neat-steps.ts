// NEAT ↔ pregunta de pasos: heurística compartida cliente/servidor.
//
// Antes el modal del cliente ocultaba la pregunta de pasos a clientes sin
// NEAT cards; ya no (se ve siempre que esté activada). `relaxStepsRequirement`
// sigue en el server sólo por bundles viejos cacheados que aún la ocultan.
// `isStepsQuestion` también decide que la respuesta sea un entero.

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
