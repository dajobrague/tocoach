// Highlights de la tarjeta "Comparte tu sesión" (llamada JC, 15 sep: imagen
// tipo Strava que el cliente sube a Stories). Puro: la ruta
// /api/client/scheduled-sessions/[date]/share-card trae los logs y esto
// solo suma. Los récords reutilizan la misma regla que el confeti de
// "¡Nuevo récord!" (lib/training/e1rm.ts), comparando contra días ANTERIORES.

import {
  type SessionSets,
  type SetInput,
  computeRepMaxes,
  diffRecords,
  estimateOneRepMax,
} from "./e1rm";

export interface ShareCardLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetInput[];
  durationSeconds: number | null;
  distanceMeters: number | null;
}

export interface ShareCardRecord {
  exerciseName: string;
  reps: number;
  weightKg: number;
}

export interface ShareCardStats {
  exercises: number;
  sets: number;
  reps: number;
  /** Σ peso × reps de las series con ambos valores. */
  volumeKg: number;
  cardioSeconds: number;
  cardioMeters: number;
  /** Un récord por ejercicio (el de mayor e1RM), orden de aparición. */
  records: ShareCardRecord[];
}

const positive = (value: number | null): number =>
  value !== null && Number.isFinite(value) && value > 0 ? value : 0;

export function computeShareCardStats(
  logs: ShareCardLog[],
  /** Sesiones previas (fecha < la de la tarjeta) por exercise_id. */
  priorByExercise: Map<string, SessionSets[]>
): ShareCardStats {
  const stats: ShareCardStats = {
    exercises: logs.length,
    sets: 0,
    reps: 0,
    volumeKg: 0,
    cardioSeconds: 0,
    cardioMeters: 0,
    records: [],
  };

  for (const log of logs) {
    for (const set of log.sets) {
      const reps = positive(set.reps);
      const weight = positive(set.weight_kg);

      // Una fila sin reps ni peso (cardio, serie vacía) no es una serie.
      if (reps === 0 && weight === 0) continue;
      stats.sets += 1;
      stats.reps += reps;
      stats.volumeKg += reps * weight;
    }
    stats.cardioSeconds += positive(log.durationSeconds);
    stats.cardioMeters += positive(log.distanceMeters);

    // Sin historial previo todo sería "récord": igual que el confeti, callar.
    const prior = computeRepMaxes(priorByExercise.get(log.exerciseId) ?? []);

    if (prior.length === 0) continue;

    let best: (ShareCardRecord & { e1rm: number }) | null = null;

    for (const record of diffRecords(prior, log.sets) ?? []) {
      const e1rm = estimateOneRepMax(record.weightKg, record.reps) ?? 0;

      if (best === null || e1rm > best.e1rm) {
        best = {
          exerciseName: log.exerciseName,
          reps: record.reps,
          weightKg: record.weightKg,
          e1rm,
        };
      }
    }

    if (best !== null) {
      stats.records.push({
        exerciseName: best.exerciseName,
        reps: best.reps,
        weightKg: best.weightKg,
      });
    }
  }

  stats.volumeKg = Math.round(stats.volumeKg);

  return stats;
}
