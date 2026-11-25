// Series alternas (JC, nov): 2–3 ejercicios CONSECUTIVOS de una sesión que se
// hacen por turnos, una serie de cada uno. Cada miembro guarda la misma clave
// en session_exercises.metadata.alt_group; el grupo es la racha de vecinos con
// esa clave. Si un ejercicio se arrastra fuera, deja de ser vecino y el grupo
// se deshace solo: no hay ids de grupo que mantener.

export const ALT_GROUP_KEY = "alt_group";
// Seis: más filas por serie ya no caben cómodas en la pantalla del cliente.
export const ALT_GROUP_MAX = 6;

type Key = string | null | undefined;

/** Rachas [inicio, fin] de 2+ vecinos con la misma clave. */
export function altGroupRuns(keys: readonly Key[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = 0;

  for (let i = 1; i <= keys.length; i++) {
    if (i < keys.length && keys[i] && keys[i] === keys[start]) continue;
    if (keys[start] && i - start >= 2) runs.push([start, i - 1]);
    start = i;
  }

  return runs;
}

/**
 * Claves tras arrastrar un ejercicio, con la lista YA en su nuevo orden:
 *  - soltado entre dos miembros de un grupo → entra en él (la biserie pasa a
 *    triserie); si el grupo está lleno o el ejercicio no puede agruparse
 *    (cardio), el movimiento se rechaza;
 *  - sacado de su grupo (ya sin vecinos de su clave) → queda suelto;
 *  - el grupo que se queda con un solo ejercicio se deshace.
 */
export function regroupAfterMove(
  keys: readonly Key[],
  movedIndex: number,
  canJoin: boolean
): { keys: Array<string | null> } | { refused: "full" | "not-allowed" } {
  const next: Array<string | null> = keys.map((k) => k ?? null);
  const before = next[movedIndex - 1] ?? null;
  const after = next[movedIndex + 1] ?? null;
  const own = next[movedIndex] ?? null;

  if (before && before === after && own !== before) {
    if (!canJoin) return { refused: "not-allowed" };
    const others = next.filter((k, i) => i !== movedIndex && k === before);

    if (others.length >= ALT_GROUP_MAX) return { refused: "full" };
    next[movedIndex] = before;
  } else if (own && own !== before && own !== after) {
    next[movedIndex] = null;
  }

  return { keys: clearLoneKeys(next) };
}

/** Quien se queda sin vecino de su clave va suelto. */
export function clearLoneKeys(keys: readonly Key[]): Array<string | null> {
  const inRun = new Set<number>();

  for (const [a, b] of altGroupRuns(keys)) {
    for (let i = a; i <= b; i++) inRun.add(i);
  }

  return keys.map((k, i) => (inRun.has(i) ? (k ?? null) : null));
}

/** "90" → "90s": hay descansos guardados como número suelto. */
export function restWithUnit(rest: string | undefined): string | undefined {
  return rest && /^\d+$/.test(rest.trim()) ? `${rest.trim()}s` : rest;
}

/** Nombre técnico según el nº de ejercicios: biserie, triserie o circuito (4+). */
export function altGroupName(count: number): string {
  return count >= 4 ? "Circuito" : count === 3 ? "Triserie" : "Biserie";
}

/** "Descansa 90s después de hacer los dos." — el descanso va tras el grupo. */
export function altGroupRestLine(
  count: number,
  rest: string | undefined
): string {
  const all = count >= 4 ? "todos" : count === 3 ? "los tres" : "los dos";

  return rest
    ? `Alterna una serie de cada ejercicio. Descansa ${rest} después de hacer ${all}.`
    : "Alterna una serie de cada ejercicio.";
}
