/**
 * Helper para generar `id`s únicos de `ChoiceOption` a partir de un label
 * libre. Los `id`s son INMUTABLES una vez creados: al renombrar el label,
 * el id queda como estaba, porque es la clave que se guarda en
 * `form_responses.answers` y se usa en matches condicionales.
 */

/**
 * Convierte una cadena libre en un slug tipo `opcion_foo_bar`.
 * - Minúsculas.
 * - Quita acentos.
 * - Reemplaza cualquier secuencia no alfanumérica por `_`.
 * - Trim de `_` al principio/final.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita marcas diacríticas
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Genera un id único basado en `label`, garantizando que no colisione con
 * `existingIds`. Si el label es vacío o slugs a "", usa `"option"` como base.
 *
 *   generateChoiceId("Muy bueno", [])                 // "muy_bueno"
 *   generateChoiceId("Muy bueno", ["muy_bueno"])      // "muy_bueno_2"
 *   generateChoiceId("", [])                          // "option"
 *   generateChoiceId("!!", ["option", "option_2"])    // "option_3"
 */
export function generateChoiceId(
  label: string,
  existingIds: readonly string[]
): string {
  const base = slugify(label) || "option";
  const taken = new Set(existingIds);

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;

  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }

  return `${base}_${suffix}`;
}
