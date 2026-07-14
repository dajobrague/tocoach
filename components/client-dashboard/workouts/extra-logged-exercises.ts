// Ejercicios "extra" a mostrar en la vista de sesión activa: logs del día
// que no están en el template de la sesión. Extraído de ActiveSessionView
// para poder testearlo puro.
//
// Historia: a20f148 añadió el append de logs off-template para que el
// trabajo realmente hecho no desapareciera de la vista (fix de "0%
// adherencia" tras reestructurar sesiones). Pero no filtraba por sesión:
// los logs de OTRA sesión del mismo día se "sumaban" a la sesión activa
// como si fueran prescritos (7 ejercicios → el cliente veía 9 y los hacía
// todos, y el trainer no veía nada raro en su editor). Ahora solo se
// anexan logs atribuidos a ESTA sesión — los de otras sesiones se ven en
// su propia tarjeta/sección de sesiones registradas. Los logs sin
// atribución (session_id null, legacy/ad-hoc) se conservan para no
// ocultar trabajo hecho.

export interface ExtraLogCandidate {
  exercise_id?: string;
  /** Sesión a la que pertenece el log (via scheduled_sessions.session_id). */
  session_id?: string | null;
  exercises?: { name?: string } | null;
  exercise_name?: string;
}

export interface ExtraLoggedExercise {
  order: number;
  name: string;
  exercise_id: string;
}

export function collectExtraLoggedExercises(
  logsForDate: ExtraLogCandidate[],
  activeSessionId: string,
  templateExerciseIds: Set<string>
): ExtraLoggedExercise[] {
  const seen = new Set<string>();
  const extras: ExtraLoggedExercise[] = [];

  for (const log of logsForDate) {
    const eid = log.exercise_id;

    if (!eid || templateExerciseIds.has(eid) || seen.has(eid)) continue;
    if (log.session_id != null && log.session_id !== activeSessionId) continue;
    seen.add(eid);

    extras.push({
      order: 1000 + extras.length,
      name: log.exercises?.name ?? log.exercise_name ?? eid,
      exercise_id: eid,
    });
  }

  return extras;
}
