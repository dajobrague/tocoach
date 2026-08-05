// Consulta compartida de progresión por ejercicio (rebanada Progreso + 1RM).
//
// La usan los dos endpoints gemelos — el del cliente
// (/api/client/exercises/[exerciseId]/progression) y el del entrenador
// (/api/clients/[clientId]/exercises/[exerciseId]/progression) — para que
// ambos lados vean EXACTAMENTE los mismos números. Toda la matemática vive en
// lib/training/e1rm.ts; acá solo se trae la data y se mapea.
//
// Solo cuentan los logs FINALIZADOS (finalized_at not null). Los autosaves son
// texto a medio escribir: si contaran, un "100" tecleado camino a "10" se
// convertiría en un récord fantasma.

import type { SessionSets } from "@/lib/training/e1rm";

import {
  computeE1rmSeries,
  computeRepMaxes,
  type RepMax,
} from "@/lib/training/e1rm";

export interface ProgressionPoint {
  date: string;
  e1rm: number;
  reps: number;
  weightKg: number;
  /** Volumen del día = Σ reps × peso de TODAS las series de esa fecha. */
  volumeKg: number;
}

export interface Progression {
  /** Ascendente por fecha. */
  e1rmSeries: ProgressionPoint[];
  repMaxes: RepMax[];
  currentE1rm: number | null;
  bestE1rm: number | null;
  /** Nº de fechas con punto computable (no cuenta días sin peso/reps). */
  totalSessions: number;
}

/** Máximo de logs traídos: defensa contra payloads desbocados. */
const MAX_LOGS = 2000;

type SupabaseLike = {
  from: (table: string) => any;
};

interface ProgressionRow {
  id: string;
  finalized_at: string | null;
  scheduled_sessions: { scheduled_date: string | null } | null;
  exercise_log_sets: Array<{
    reps: number | null;
    weight_kg: number | null;
  }> | null;
}

/**
 * Progresión de un ejercicio para un cliente en los últimos `days` días.
 * No lanza por datos vacíos: sin logs devuelve la forma vacía. Los errores de
 * Supabase sí se propagan — el endpoint decide el status.
 */
export async function fetchProgression(
  supabase: SupabaseLike,
  clientId: string,
  exerciseId: string,
  days: number
): Promise<Progression> {
  const since = progressionWindowStart(days);

  const { data, error } = await supabase
    .from("exercise_logs")
    .select(
      "id, finalized_at, scheduled_sessions!inner(scheduled_date), exercise_log_sets(reps, weight_kg)"
    )
    .eq("client_id", clientId)
    .eq("exercise_id", exerciseId)
    .not("finalized_at", "is", null)
    .gte("scheduled_sessions.scheduled_date", since)
    .order("completed_at", { ascending: true })
    .limit(MAX_LOGS);

  if (error) {
    throw new Error(error.message);
  }

  return buildProgression((data ?? []) as ProgressionRow[]);
}

/**
 * Mapeo puro fila → contrato. Separado de la consulta para poder testearlo sin
 * Supabase (y para que el POST de logs pueda reutilizar la misma normalización).
 */
export function buildProgression(rows: ProgressionRow[]): Progression {
  const sessions: SessionSets[] = [];
  const volumeByDate = new Map<string, number>();

  for (const row of rows) {
    const date = row.scheduled_sessions?.scheduled_date ?? "";

    if (date === "") continue;

    const sets = (row.exercise_log_sets ?? []).map((set) => ({
      reps: set.reps,
      weight_kg: set.weight_kg,
    }));

    sessions.push({ date, sets });

    // Series sin reps o sin peso aportan 0 al volumen del día.
    let volume = 0;

    for (const set of sets) {
      if (set.reps === null || set.weight_kg === null) continue;
      if (!Number.isFinite(set.reps) || !Number.isFinite(set.weight_kg)) {
        continue;
      }
      volume += set.reps * set.weight_kg;
    }

    volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + volume);
  }

  const e1rmSeries: ProgressionPoint[] = computeE1rmSeries(sessions).map(
    (point) => ({ ...point, volumeKg: volumeByDate.get(point.date) ?? 0 })
  );

  const last = e1rmSeries[e1rmSeries.length - 1];
  const bestE1rm =
    e1rmSeries.length > 0
      ? e1rmSeries.reduce((max, p) => (p.e1rm > max ? p.e1rm : max), 0)
      : null;

  return {
    e1rmSeries,
    repMaxes: computeRepMaxes(sessions),
    currentE1rm: last?.e1rm ?? null,
    bestE1rm,
    totalSessions: e1rmSeries.length,
  };
}

/**
 * Inicio de la ventana en YYYY-MM-DD. scheduled_date guarda la fecha LOCAL del
 * cliente y el día del servidor (UTC en prod) puede ir hasta un día por
 * delante, así que se ancla al calendario UTC y se resta un día extra de
 * tolerancia: la sesión de hace exactamente `days` días locales nunca cae
 * fuera según la hora. Aritmética pura sobre el calendario UTC — nada de Date
 * en zona local del servidor.
 */
export function progressionWindowStart(
  days: number,
  now: Date = new Date()
): string {
  const anchorMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  return new Date(anchorMs - (days + 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** ?days → entero acotado a 1..730. Default 365. */
export function parseDaysParam(raw: string | null): number {
  const parsed = parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed)) return 365;

  return Math.min(Math.max(parsed, 1), 730);
}
