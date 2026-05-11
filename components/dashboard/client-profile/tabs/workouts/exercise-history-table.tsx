"use client";

import type { ExerciseLog } from "../progress/types";

import { Icon } from "@iconify/react";
import { Fragment } from "react";

import { formatDate } from "../progress/helpers";

import { computeSessionVolume } from "./helpers";

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
      const weight = s.weight_kg != null ? `${s.weight_kg}` : "—";

      return `${reps}×${weight}`;
    })
    .join(" · ");
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}

export function ExerciseHistoryTable({
  logs,
  variant,
  exerciseName,
  onPlayVideo,
}: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic px-3 py-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </div>
    );
  }

  // Most recent first.
  const orderedLogs = [...logs].reverse();

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <header className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700">
          Historial{" "}
          <span className="text-gray-400 font-normal">
            · {logs.length} {logs.length === 1 ? "sesión" : "sesiones"}
          </span>
        </h4>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-white">
              <th
                className="text-left font-medium text-gray-500 px-3 py-1.5 uppercase tracking-wide text-[10px] w-20"
                scope="col"
              >
                Fecha
              </th>
              <th
                className="text-left font-medium text-gray-500 px-3 py-1.5 uppercase tracking-wide text-[10px]"
                scope="col"
              >
                {variant === "strength"
                  ? "Series · reps × kg"
                  : "Duración · distancia · intensidad"}
              </th>
              {variant === "strength" ? (
                <th
                  className="text-right font-medium text-gray-500 px-3 py-1.5 uppercase tracking-wide text-[10px] w-24"
                  scope="col"
                >
                  Volumen
                </th>
              ) : null}
              <th aria-label="Video" className="w-10 px-2 py-1.5" scope="col" />
            </tr>
          </thead>
          <tbody>
            {orderedLogs.map((log) => {
              const summary =
                variant === "strength"
                  ? summarizeStrengthSets(log)
                  : [
                      log.duration_minutes != null
                        ? `${log.duration_minutes} min`
                        : null,
                      log.distance_km != null ? `${log.distance_km} km` : null,
                      log.intensity ?? null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—";

              const volume =
                variant === "strength" ? computeSessionVolume(log) : null;

              return (
                <Fragment key={log.id}>
                  <tr className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-1.5 text-gray-600 tabular-nums whitespace-nowrap">
                      {formatDate(log.scheduled_date)}
                    </td>
                    <td className="px-3 py-1.5 text-gray-800 tabular-nums">
                      {summary}
                    </td>
                    {variant === "strength" ? (
                      <td className="px-3 py-1.5 text-right text-gray-700 tabular-nums whitespace-nowrap font-medium">
                        {volume! > 0 ? formatNumber(volume!) : "—"}
                      </td>
                    ) : null}
                    <td className="px-2 py-1 text-center">
                      {log.video_url ? (
                        <button
                          aria-label={`Ver video de ${exerciseName} del ${formatDate(log.scheduled_date)}`}
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center justify-center w-7 h-7 rounded hover:bg-blue-50 transition-colors"
                          type="button"
                          onClick={() =>
                            onPlayVideo(log.video_url!, exerciseName)
                          }
                        >
                          <Icon icon="solar:play-circle-bold" width={16} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {log.notes ? (
                    <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50/60">
                      <td className="px-3 pt-0 pb-1.5 align-top" />
                      <td
                        className="px-3 pt-0 pb-1.5 text-[11px] text-gray-500 italic leading-snug"
                        colSpan={variant === "strength" ? 3 : 2}
                      >
                        <span className="text-gray-400 not-italic">↳ </span>
                        {log.notes}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
