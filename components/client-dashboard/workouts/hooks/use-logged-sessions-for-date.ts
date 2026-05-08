// Deriva "qué sesiones registró el cliente en una fecha X" a partir
// del cache de useExerciseLogs(clientId).
//
// El endpoint /api/clients/:id/exercise-logs ya carga 30 días para
// atrás (ver `getDateRange` en use-client-queries.ts), así que para
// este selector de semana siempre tenemos los datos disponibles sin
// pedidos extra. Agrupamos por (scheduled_date + session_id) y
// completamos el nombre / tipo desde el cache de programs.
//
// Nota: si el trainer borró la sesión (template) después del log,
// session sigue existiendo en BD pero no aparece en programs — en ese
// caso devolvemos un placeholder "Sesión eliminada" para que el
// cliente al menos pueda borrar sus logs huérfanos.

import type { SessionType, WorkoutProgram } from "@/types/training";

import { useMemo } from "react";

interface ExerciseLog {
  id: string;
  scheduled_date?: string;
  session_id?: string;
  exercise_id?: string;
}

export interface LoggedSession {
  sessionId: string;
  name: string;
  sessionType: SessionType | null;
  exercisesLogged: number;
  exercisesTotal: number;
  // true cuando el template original ya no existe en programs[].
  templateMissing: boolean;
}

interface SessionTemplate {
  id: string;
  name?: string;
  session_type?: SessionType | null;
  exercises?: unknown[];
}

function indexSessionTemplates(
  programs: WorkoutProgram[]
): Map<string, SessionTemplate> {
  const map = new Map<string, SessionTemplate>();

  for (const program of programs) {
    const sessions = (program as unknown as { sessions?: SessionTemplate[] })
      .sessions;

    if (!Array.isArray(sessions)) continue;
    for (const s of sessions) {
      if (s && typeof s.id === "string") {
        map.set(s.id, s);
      }
    }
  }

  return map;
}

export function useLoggedSessionsForDate(
  exerciseLogs: ExerciseLog[],
  programs: WorkoutProgram[],
  scheduledDate: string
): LoggedSession[] {
  return useMemo(() => {
    const logsByDate = exerciseLogs.filter(
      (l) =>
        l.scheduled_date === scheduledDate && typeof l.session_id === "string"
    );

    if (logsByDate.length === 0) return [];

    const templateById = indexSessionTemplates(programs);

    // Agrupar logs por session_id.
    const bySession = new Map<string, ExerciseLog[]>();

    for (const log of logsByDate) {
      const sid = log.session_id as string;
      const arr = bySession.get(sid) ?? [];

      arr.push(log);
      bySession.set(sid, arr);
    }

    const result: LoggedSession[] = [];

    for (const [sessionId, logs] of bySession.entries()) {
      const template = templateById.get(sessionId);
      const totalFromTemplate = Array.isArray(template?.exercises)
        ? template?.exercises.length
        : undefined;

      result.push({
        sessionId,
        name: template?.name ?? "Sesión eliminada",
        sessionType: template?.session_type ?? null,
        exercisesLogged: logs.length,
        exercisesTotal: totalFromTemplate ?? logs.length,
        templateMissing: !template,
      });
    }

    // Orden estable: por nombre asc para no parpadear entre re-renders.
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  }, [exerciseLogs, programs, scheduledDate]);
}
