"use client";

import type { ExerciseLog } from "../progress/types";

import { Icon } from "@iconify/react";

import { formatDate } from "../progress/helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}

function summarizeStrengthSets(log: ExerciseLog) {
  if (!log.sets || log.sets.length === 0) return "—";

  return log.sets
    .map((s) => {
      const reps = s.reps ?? "—";
      const weight = s.weight_kg != null ? `${s.weight_kg}kg` : "—";

      return `${reps}×${weight}`;
    })
    .join(" · ");
}

function summarizeCardio(log: ExerciseLog) {
  const parts: string[] = [];

  if (log.duration_minutes != null) parts.push(`${log.duration_minutes} min`);
  if (log.distance_km != null) parts.push(`${log.distance_km} km`);
  if (log.intensity) parts.push(log.intensity);

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function ExerciseHistoryTable({
  logs,
  variant,
  exerciseName,
  onPlayVideo,
}: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </p>
    );
  }

  // Most recent first.
  const orderedLogs = [...logs].reverse();

  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {orderedLogs.map((log) => (
        <div key={log.id} className="px-3 py-2 flex items-start gap-3 text-sm">
          <span className="text-xs font-medium text-gray-500 w-16 shrink-0 tabular-nums mt-0.5">
            {formatDate(log.scheduled_date)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-800 leading-snug break-words">
              {variant === "strength"
                ? summarizeStrengthSets(log)
                : summarizeCardio(log)}
            </p>
            {log.notes ? (
              <p className="text-[11px] text-gray-500 italic mt-0.5 leading-snug">
                {log.notes}
              </p>
            ) : null}
          </div>
          {log.video_url ? (
            <button
              aria-label="Ver video"
              className="text-blue-600 hover:text-blue-800 p-0.5 -mt-0.5 rounded hover:bg-blue-50 transition-colors shrink-0"
              type="button"
              onClick={() => onPlayVideo(log.video_url!, exerciseName)}
            >
              <Icon icon="solar:play-circle-bold" width={18} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
