import type { ExerciseLog, ExerciseGroup } from "./types";

import { getLocalYmd } from "@/lib/forms/client-helpers";

const CARDIO_CATEGORIES = new Set(["cardio"]);

export function isCardio(category: string): boolean {
  return CARDIO_CATEGORIES.has(category);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    strength: "Fuerza",
    cardio: "Cardio",
    flexibility: "Flexibilidad",
    balance: "Equilibrio",
    plyometric: "Pliométrico",
    olympic: "Olímpico",
    powerlifting: "Powerlifting",
    bodyweight: "Peso corporal",
    other: "Otro",
  };

  return labels[category] || category;
}

export function buildDateRange(days: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  start.setDate(start.getDate() - parseInt(days));

  // Local Y-M-D so the range matches what the trainer sees on their
  // calendar. `toISOString()` would silently shift one or both ends across
  // the UTC boundary depending on the trainer's timezone, dropping logs
  // that were recorded near midnight local.
  return {
    start: getLocalYmd(start),
    end: getLocalYmd(end),
  };
}

export function groupLogsByExercise(logs: ExerciseLog[]): ExerciseGroup[] {
  const map: Record<string, ExerciseGroup> = {};

  for (const log of logs) {
    if (!log.exercises) continue;
    const key = log.exercise_id;

    if (!map[key]) map[key] = { exercise: log.exercises, logs: [] };
    map[key].logs.push(log);
  }

  return Object.values(map).sort((a, b) =>
    a.exercise.name.localeCompare(b.exercise.name)
  );
}

export const DATE_RANGES = [
  { key: "30", label: "30 días" },
  { key: "90", label: "3 meses" },
  { key: "180", label: "6 meses" },
  { key: "365", label: "1 año" },
];
