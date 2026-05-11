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
    const data = buildVolumeChartData(logs).map((p) => ({
      date: formatDate(p.date),
      volume: p.volume,
    }));

    return (
      <ExerciseLineChart
        data={data}
        lines={[
          {
            key: "volume",
            label: "Volumen (kg·reps)",
            color: "#2563eb",
            formatter: (v) => `${v} kg·reps`,
          },
        ]}
        title="Volumen por sesión"
        yFormatter={(v) => `${v}`}
      />
    );
  }

  // Cardio: prefer distance_km when any session has a non-zero value;
  // fall back to duration_minutes so bodyweight cardio (no distance) still charts.
  const hasDistance = logs.some((l) => (l.distance_km ?? 0) > 0);
  const data = logs.map((l) => ({
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
