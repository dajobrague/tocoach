// Números del resumen de cierre de sesión ("¡Sesión completada!"). Puro:
// suma sobre los logs que la vista activa ya tiene cargados (sin red) y
// reutiliza las reglas de la tarjeta de compartir (computeShareCardStats)
// para que series y volumen coincidan con la imagen que se comparte.

import { computeShareCardStats } from "@/lib/training/share-card-stats";

export interface SummaryLog {
  exercise_id?: string;
  finalized_at?: string | null;
  sets?: Array<{ reps: number | null; weight_kg: number | null }> | null;
}

export interface SessionSummary {
  sets: number;
  volumeKg: number;
  /** null si no hay hora de inicio o el intervalo no es creíble. */
  durationMinutes: number | null;
}

// ponytail: tope fijo de 5 h; una hora de inicio mal tecleada daría
// duraciones absurdas. Afinar si aparecen sesiones legítimas más largas.
const MAX_MINUTES = 300;

export function summarizeSession(
  logs: SummaryLog[],
  scheduledDate: string,
  startHHMM: string | null | undefined
): SessionSummary {
  const stats = computeShareCardStats(
    logs.map((log) => ({
      exerciseId: log.exercise_id ?? "",
      exerciseName: "",
      sets: log.sets ?? [],
      durationSeconds: null,
      distanceMeters: null,
    })),
    new Map()
  );

  return {
    sets: stats.sets,
    volumeKg: stats.volumeKg,
    durationMinutes: durationMinutes(logs, scheduledDate, startHHMM),
  };
}

function durationMinutes(
  logs: SummaryLog[],
  scheduledDate: string,
  startHHMM: string | null | undefined
): number | null {
  if (!startHHMM || !/^\d{2}:\d{2}/.test(startHHMM)) return null;
  // Hora local del cliente, igual que la registra "Hora de inicio".
  const start = new Date(
    `${scheduledDate}T${startHHMM.slice(0, 5)}:00`
  ).getTime();
  const end = Math.max(
    ...logs
      .map((log) => (log.finalized_at ? Date.parse(log.finalized_at) : NaN))
      .filter(Number.isFinite)
  );
  const minutes = Math.round((end - start) / 60000);

  return Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_MINUTES
    ? minutes
    : null;
}
