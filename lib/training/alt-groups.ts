// Series alternas (JC, nov): 2–3 ejercicios CONSECUTIVOS de una sesión que se
// hacen por turnos, una serie de cada uno. Cada miembro guarda la misma clave
// en session_exercises.metadata.alt_group; el grupo es la racha de vecinos con
// esa clave. Si un ejercicio se arrastra fuera, deja de ser vecino y el grupo
// se deshace solo: no hay ids de grupo que mantener.

export const ALT_GROUP_KEY = "alt_group";
export const ALT_GROUP_MAX = 3;

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

/** "90" → "90s": hay descansos guardados como número suelto. */
export function restWithUnit(rest: string | undefined): string | undefined {
  return rest && /^\d+$/.test(rest.trim()) ? `${rest.trim()}s` : rest;
}

/** Nombre técnico según el nº de ejercicios: biserie (2) o triserie (3). */
export function altGroupName(count: number): string {
  return count >= 3 ? "Triserie" : "Biserie";
}

/** "Descansa 90s después de hacer los dos." — el descanso va tras el grupo. */
export function altGroupRestLine(
  count: number,
  rest: string | undefined
): string {
  const all = count >= 3 ? "los tres" : "los dos";

  return rest
    ? `Alterna una serie de cada ejercicio. Descansa ${rest} después de hacer ${all}.`
    : "Alterna una serie de cada ejercicio.";
}
