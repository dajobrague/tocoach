"use client";

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

import { Icon } from "@iconify/react";

import { computeSessionVolume } from "./helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const formatted = d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // "lun, 22 may" → "Lun · 22 may"
  return formatted.replace(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[\.,]?\s/, (_m, w) => {
    const cap = w.charAt(0).toUpperCase() + w.slice(1);

    return `${cap} · `;
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}

function StrengthSetRow({ set }: { set: ExerciseLogSet }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
        {set.set_number}
      </span>
      <span className="text-gray-900 tabular-nums">
        <span className="font-semibold">{set.reps ?? "—"}</span>
        <span className="text-gray-400 mx-1">reps</span>
        <span className="text-gray-400 mx-1">×</span>
        <span className="font-semibold">
          {set.weight_kg != null ? set.weight_kg : "—"}
        </span>
        <span className="text-gray-400 ml-1">kg</span>
      </span>
    </div>
  );
}

function StrengthSessionCard({
  log,
  exerciseName,
  onPlayVideo,
}: {
  log: ExerciseLog;
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}) {
  const sets = log.sets ?? [];
  const volume = computeSessionVolume(log);
  const maxWeight =
    sets.length > 0 ? Math.max(...sets.map((s) => s.weight_kg ?? 0)) : 0;

  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-700 capitalize tabular-nums">
          {formatLongDate(log.scheduled_date)}
        </p>
        {log.video_url ? (
          <button
            aria-label={`Ver video de ${exerciseName}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            type="button"
            onClick={() => onPlayVideo(log.video_url!, exerciseName)}
          >
            <Icon icon="solar:play-circle-bold" width={14} />
            Video
          </button>
        ) : null}
      </header>

      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-baseline gap-3 text-[11px] text-gray-500">
          <span>
            <span className="font-semibold text-gray-900 text-sm tabular-nums">
              {sets.length}
            </span>{" "}
            series
          </span>
          {maxWeight > 0 ? (
            <span>
              ·{" "}
              <span className="font-semibold text-gray-900 text-sm tabular-nums">
                {maxWeight}
              </span>{" "}
              kg máx
            </span>
          ) : null}
          {volume > 0 ? (
            <span>
              · Volumen{" "}
              <span className="font-semibold text-gray-900 text-sm tabular-nums">
                {formatNumber(volume)}
              </span>{" "}
              kg·reps
            </span>
          ) : null}
        </div>

        {sets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
            {sets.map((set) => (
              <StrengthSetRow key={set.set_number} set={set} />
            ))}
          </div>
        ) : null}

        {log.notes ? (
          <div className="text-[11px] text-gray-600 bg-amber-50 border-l-2 border-amber-300 px-2 py-1.5 rounded-r leading-snug">
            <span className="font-medium text-amber-700 not-italic">
              Notas ·{" "}
            </span>
            {log.notes}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CardioSessionCard({
  log,
  exerciseName,
  onPlayVideo,
}: {
  log: ExerciseLog;
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}) {
  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-700 capitalize tabular-nums">
          {formatLongDate(log.scheduled_date)}
        </p>
        {log.video_url ? (
          <button
            aria-label={`Ver video de ${exerciseName}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            type="button"
            onClick={() => onPlayVideo(log.video_url!, exerciseName)}
          >
            <Icon icon="solar:play-circle-bold" width={14} />
            Video
          </button>
        ) : null}
      </header>

      <div className="px-3 py-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
              Duración
            </p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums mt-0.5">
              {log.duration_minutes != null
                ? `${log.duration_minutes} min`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
              Distancia
            </p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums mt-0.5">
              {log.distance_km != null ? `${log.distance_km} km` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
              Intensidad
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {log.intensity ?? "—"}
            </p>
          </div>
        </div>

        {log.notes ? (
          <div className="text-[11px] text-gray-600 bg-amber-50 border-l-2 border-amber-300 px-2 py-1.5 rounded-r leading-snug">
            <span className="font-medium text-amber-700 not-italic">
              Notas ·{" "}
            </span>
            {log.notes}
          </div>
        ) : null}
      </div>
    </article>
  );
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

  const orderedLogs = [...logs].reverse();

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">
        Historial{" "}
        <span className="text-gray-400 font-normal">
          · {logs.length} {logs.length === 1 ? "sesión" : "sesiones"}
        </span>
      </p>
      <div className="space-y-2">
        {orderedLogs.map((log) =>
          variant === "strength" ? (
            <StrengthSessionCard
              key={log.id}
              exerciseName={exerciseName}
              log={log}
              onPlayVideo={onPlayVideo}
            />
          ) : (
            <CardioSessionCard
              key={log.id}
              exerciseName={exerciseName}
              log={log}
              onPlayVideo={onPlayVideo}
            />
          )
        )}
      </div>
    </div>
  );
}
