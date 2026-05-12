// Pure helpers consumed by the new ExerciseProgressCard family.
// Kept dependency-free so behavior is obvious from inspection and so they
// can be tested in isolation if a test runner is added later.

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

/**
 * Session volume = sum across sets of (reps * weight_kg).
 * Missing weight or reps contribute zero — a partial set never poisons the metric.
 * `reps` on a logged set is stored as a number, but legacy/unknown shapes are
 * handled defensively: only finite positive numbers count.
 */
export function computeSessionVolume(log: ExerciseLog): number {
  if (!log.sets || log.sets.length === 0) return 0;

  return log.sets.reduce((acc, s: ExerciseLogSet) => {
    const reps =
      typeof s.reps === "number" && Number.isFinite(s.reps) && s.reps > 0
        ? s.reps
        : 0;
    const weight =
      typeof s.weight_kg === "number" &&
      Number.isFinite(s.weight_kg) &&
      s.weight_kg > 0
        ? s.weight_kg
        : 0;

    return acc + reps * weight;
  }, 0);
}

/**
 * Order logs by scheduled_date descending (most recent first) using a stable
 * sort. Used by stats helpers + the history table so "last weight" in the
 * stats grid and "first row" in the history table can never disagree.
 */
export function sortLogsByDateDesc(logs: ExerciseLog[]): ExerciseLog[] {
  return [...logs].sort((a, b) => {
    const da = a.scheduled_date ?? "";
    const db = b.scheduled_date ?? "";

    if (db !== da) return db.localeCompare(da);

    // Stable tiebreak on id when both are same-day; keeps order deterministic
    // across renders even if completed_at is null/null.
    const ia = String(a.id ?? "");
    const ib = String(b.id ?? "");

    return ib.localeCompare(ia);
  });
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

  // Sort desc so `lastWeight` agrees with the history table (which renders
  // newest-first). Without this, the stats grid could show 50 kg "last"
  // while the topmost row reads 60 kg.
  const ordered = sortLogsByDateDesc(logs);

  const sessionMaxWeights: number[] = [];

  for (const log of ordered) {
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
  const last = sessionMaxWeights[0] ?? 0;

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

  // Filter out sessions with no distance recorded — a 30-min bike spin
  // without distance should not pollute "best/total/last distance" with 0s.
  const ordered = sortLogsByDateDesc(logs);
  const distances = ordered
    .map((l) => l.distance_km)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const last = distances[0] ?? 0;

  return {
    bestDistanceKm: distances.length > 0 ? Math.max(...distances) : 0,
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
