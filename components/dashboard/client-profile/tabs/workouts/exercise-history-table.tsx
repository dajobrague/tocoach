"use client";

import type { ExerciseLog } from "../progress/types";

import { Icon } from "@iconify/react";

import { LogTable } from "../progress/exercise-chart";
import { formatDate } from "../progress/helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}

function formatSetsCell(log: ExerciseLog) {
  if (log.sets && log.sets.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {log.sets.map((s) => (
          <div key={s.set_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {s.set_number}
            </span>
            <span>{s.reps ?? "—"} reps</span>
            <span className="text-gray-400">·</span>
            <span className="font-medium">
              {s.weight_kg != null ? `${s.weight_kg}kg` : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return "—";
}

export function ExerciseHistoryTable({
  logs,
  variant,
  exerciseName,
  onPlayVideo,
}: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </p>
    );
  }

  // Most recent first.
  const orderedLogs = [...logs].reverse();

  if (variant === "strength") {
    return (
      <LogTable
        columns={[
          { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
          { label: "Series", render: (l) => formatSetsCell(l) },
          {
            label: "",
            render: (l) =>
              l.video_url ? (
                <button
                  className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                  onClick={() => onPlayVideo(l.video_url!, exerciseName)}
                >
                  <Icon icon="solar:play-circle-bold" width={20} />
                </button>
              ) : null,
          },
          { label: "Notas", render: (l) => l.notes ?? "—", wrap: true },
        ]}
        logs={orderedLogs}
      />
    );
  }

  return (
    <LogTable
      columns={[
        { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
        {
          label: "Duración",
          render: (l) =>
            l.duration_minutes != null ? `${l.duration_minutes} min` : "—",
        },
        {
          label: "Distancia",
          render: (l) => (l.distance_km != null ? `${l.distance_km} km` : "—"),
        },
        {
          label: "Intensidad",
          render: (l) => l.intensity ?? "—",
        },
        {
          label: "",
          render: (l) =>
            l.video_url ? (
              <button
                className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                onClick={() => onPlayVideo(l.video_url!, exerciseName)}
              >
                <Icon icon="solar:play-circle-bold" width={20} />
              </button>
            ) : null,
        },
        { label: "Notas", render: (l) => l.notes ?? "—", wrap: true },
      ]}
      logs={orderedLogs}
    />
  );
}
