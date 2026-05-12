"use client";

import type { ExerciseLog } from "../progress/types";

import { ExerciseLineChart } from "../progress/exercise-chart";
import { formatDate } from "../progress/helpers";

import { buildVolumeChartData } from "./helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
}

export function ExerciseVolumeChart({ logs, variant }: Props) {
  if (logs.length === 0) return null;

  if (variant === "strength") {
    const points = buildVolumeChartData(logs);
    // Bodyweight fallback: si ningún log tiene volumen kg·reps (típico
    // calistenia o sesión sin peso registrado), graficamos total reps
    // para no mostrar una línea plana en 0. Análogo al fallback
    // distance→duration de cardio.
    const hasVolume = points.some((p) => p.volume > 0);
    const data = points.map((p) => ({
      date: formatDate(p.date),
      volume: p.volume,
      reps: p.totalReps,
    }));

    return (
      <ExerciseLineChart
        data={data}
        lines={
          hasVolume
            ? [
                {
                  key: "volume",
                  label: "Volumen (kg·reps)",
                  color: "#2563eb",
                  formatter: (v) => `${v} kg·reps`,
                },
              ]
            : [
                {
                  key: "reps",
                  label: "Reps totales",
                  color: "#2563eb",
                  formatter: (v) => `${v} reps`,
                },
              ]
        }
        title={hasVolume ? "Volumen por sesión" : "Reps por sesión"}
        yFormatter={(v) => `${v}`}
      />
    );
  }

  // Cardio: prefer distance_km when any session has a non-zero value;
  // fall back to duration_minutes so bodyweight cardio (no distance) still charts.
  const hasDistance = logs.some((l) => (l.distance_km ?? 0) > 0);
  const sortedLogs = [...logs].sort((a, b) => {
    const da = a.scheduled_date ?? "";
    const db = b.scheduled_date ?? "";

    return da.localeCompare(db);
  });
  const data = sortedLogs.map((l) => ({
    date: formatDate(l.scheduled_date),
    distance: l.distance_km ?? 0,
    duration: l.duration_minutes ?? 0,
  }));

  return (
    <ExerciseLineChart
      data={data}
      lines={
        hasDistance
          ? [
              {
                key: "distance",
                label: "Distancia (km)",
                color: "#16a34a",
                formatter: (v) => `${v} km`,
              },
            ]
          : [
              {
                key: "duration",
                label: "Duración (min)",
                color: "#16a34a",
                formatter: (v) => `${v} min`,
              },
            ]
      }
      title={hasDistance ? "Distancia por sesión" : "Duración por sesión"}
      yFormatter={(v) => `${v}`}
    />
  );
}
