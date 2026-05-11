// Pure helpers consumed by the new ExerciseProgressCard family.
// Kept dependency-free so behavior is obvious from inspection and so they
// can be tested in isolation if a test runner is added later.

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

/**
 * Session volume = sum across sets of (reps * weight_kg).
 * Missing weight or reps contribute zero — a partial set never poisons the metric.
 */
export function computeSessionVolume(log: ExerciseLog): number {
  if (!log.sets || log.sets.length === 0) return 0;

  return log.sets.reduce((acc, s: ExerciseLogSet) => {
    const reps = s.reps ?? 0;
    const weight = s.weight_kg ?? 0;

    return acc + reps * weight;
  }, 0);
}

export interface StrengthStats {
  maxWeight: number;
  lastWeight: number;
  avgWeight: number;
  sessionsCount: number;
}

export function computeStrengthStats(logs: ExerciseLog[]): StrengthStats {
  if (logs.length === 0) {
    return { maxWeight: 0, lastWeight: 0, avgWeight: 0, sessionsCount: 0 };
  }

  const sessionMaxWeights: number[] = [];

  for (const log of logs) {
    const setWeights = (log.sets ?? [])
      .map((s) => s.weight_kg ?? 0)
      .filter((w) => w > 0);

    if (setWeights.length > 0) {
      sessionMaxWeights.push(Math.max(...setWeights));
    }
  }

  if (sessionMaxWeights.length === 0) {
    return {
      maxWeight: 0,
      lastWeight: 0,
      avgWeight: 0,
      sessionsCount: logs.length,
    };
  }

  const sum = sessionMaxWeights.reduce((a, b) => a + b, 0);
  const last = sessionMaxWeights[sessionMaxWeights.length - 1] ?? 0;

  return {
    maxWeight: Math.max(...sessionMaxWeights),
    lastWeight: last,
    avgWeight: Math.round((sum / sessionMaxWeights.length) * 10) / 10,
    sessionsCount: logs.length,
  };
}

export interface CardioStats {
  bestDistanceKm: number;
  lastDistanceKm: number;
  totalDistanceKm: number;
  sessionsCount: number;
}

export function computeCardioStats(logs: ExerciseLog[]): CardioStats {
  if (logs.length === 0) {
    return {
      bestDistanceKm: 0,
      lastDistanceKm: 0,
      totalDistanceKm: 0,
      sessionsCount: 0,
    };
  }

  const distances = logs.map((l) => l.distance_km ?? 0);
  const last = distances[distances.length - 1] ?? 0;

  return {
    bestDistanceKm: Math.max(...distances),
    lastDistanceKm: last,
    totalDistanceKm: Math.round(distances.reduce((a, b) => a + b, 0) * 10) / 10,
    sessionsCount: logs.length,
  };
}

export interface VolumeChartPoint {
  date: string;
  volume: number;
}

export function buildVolumeChartData(logs: ExerciseLog[]): VolumeChartPoint[] {
  return logs.map((l) => ({
    date: l.scheduled_date,
    volume: computeSessionVolume(l),
  }));
}
