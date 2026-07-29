"use client";

import type { ExerciseLog } from "../progress/types";

import { useState } from "react";

import { ExerciseLineChart } from "../progress/exercise-chart";
import { formatDate } from "../progress/helpers";

import { buildE1rmChartData, buildVolumeChartData } from "./helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
}

type StrengthMetric = "e1rm" | "volume";

/** Segmentado compacto del header del chart de fuerza. */
function MetricToggle({
  metric,
  onChange,
}: {
  metric: StrengthMetric;
  onChange: (metric: StrengthMetric) => void;
}) {
  const options: { key: StrengthMetric; label: string }[] = [
    { key: "e1rm", label: "e1RM" },
    { key: "volume", label: "Volumen" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.key}
          className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
            metric === option.key
              ? "bg-white font-semibold text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          type="button"
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ExerciseVolumeChart({ logs, variant }: Props) {
  // e1RM por defecto: responde "¿está más fuerte?", que es la pregunta real.
  // El volumen sigue a un clic porque explica el POR QUÉ (más trabajo total).
  const [metric, setMetric] = useState<StrengthMetric>("e1rm");

  if (logs.length === 0) return null;

  if (variant === "strength") {
    const toggle = <MetricToggle metric={metric} onChange={setMetric} />;

    if (metric === "e1rm") {
      // Solo sesiones finalizadas y solo series con peso+reps: el núcleo
      // descarta lo que no computa, así que un día a peso corporal no genera
      // punto en lugar de aplastar la línea a 0.
      const data = buildE1rmChartData(logs).map((p) => ({
        date: formatDate(p.date),
        e1rm: Math.round(p.e1rm * 10) / 10,
      }));

      return (
        <ExerciseLineChart
          data={data}
          headerRight={toggle}
          lines={[
            {
              key: "e1rm",
              label: "1RM estimado",
              color: "#2563eb",
              formatter: (v) => `${v} kg`,
            },
          ]}
          title="1RM estimado por sesión"
          yFormatter={(v) => `${v}`}
        />
      );
    }

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
        headerRight={toggle}
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
