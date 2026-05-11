"use client";

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { computeSessionVolume } from "./helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}

const PAGE_SIZE = 5;

function formatLongDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const formatted = d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

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
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
        {set.set_number}
      </span>
      <span className="text-gray-900 tabular-nums">
        <span className="font-semibold">{set.reps ?? "—"}</span>
        <span className="text-gray-400 mx-0.5">reps</span>
        <span className="text-gray-400 mx-0.5">×</span>
        <span className="font-semibold">
          {set.weight_kg != null ? set.weight_kg : "—"}
        </span>
        <span className="text-gray-400 ml-0.5">kg</span>
      </span>
    </div>
  );
}

function SessionHeader({
  log,
  exerciseName,
  onPlayVideo,
}: {
  log: ExerciseLog;
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}) {
  return (
    <header className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold text-gray-700 capitalize tabular-nums">
        {formatLongDate(log.scheduled_date)}
      </p>
      {log.video_url ? (
        <button
          aria-label={`Ver video de ${exerciseName}`}
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
          type="button"
          onClick={() => onPlayVideo(log.video_url!, exerciseName)}
        >
          <Icon icon="solar:play-circle-bold" width={13} />
          Video
        </button>
      ) : null}
    </header>
  );
}

function NotesBlock({ notes }: { notes: string }) {
  return (
    <div className="text-[11px] text-gray-600 bg-amber-50 border-l-2 border-amber-300 px-2 py-1 rounded-r leading-snug">
      <span className="font-medium text-amber-700">Notas · </span>
      {notes}
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
    <article className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <SessionHeader
        exerciseName={exerciseName}
        log={log}
        onPlayVideo={onPlayVideo}
      />

      <div className="px-2.5 py-2 space-y-2">
        <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-gray-500">
          <span>
            <span className="font-semibold text-gray-900 text-xs tabular-nums">
              {sets.length}
            </span>{" "}
            series
          </span>
          {maxWeight > 0 ? (
            <span>
              ·{" "}
              <span className="font-semibold text-gray-900 text-xs tabular-nums">
                {maxWeight}
              </span>{" "}
              kg máx
            </span>
          ) : null}
          {volume > 0 ? (
            <span>
              · Volumen{" "}
              <span className="font-semibold text-gray-900 text-xs tabular-nums">
                {formatNumber(volume)}
              </span>{" "}
              kg·reps
            </span>
          ) : null}
        </div>

        {sets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
            {sets.map((set) => (
              <StrengthSetRow key={set.set_number} set={set} />
            ))}
          </div>
        ) : null}

        {log.notes ? <NotesBlock notes={log.notes} /> : null}
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
    <article className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <SessionHeader
        exerciseName={exerciseName}
        log={log}
        onPlayVideo={onPlayVideo}
      />

      <div className="px-2.5 py-2 space-y-1.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">
              Duración
            </p>
            <p className="text-xs font-semibold text-gray-900 tabular-nums mt-0.5">
              {log.duration_minutes != null
                ? `${log.duration_minutes} min`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">
              Distancia
            </p>
            <p className="text-xs font-semibold text-gray-900 tabular-nums mt-0.5">
              {log.distance_km != null ? `${log.distance_km} km` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">
              Intensidad
            </p>
            <p className="text-xs font-semibold text-gray-900 mt-0.5">
              {log.intensity ?? "—"}
            </p>
          </div>
        </div>

        {log.notes ? <NotesBlock notes={log.notes} /> : null}
      </div>
    </article>
  );
}

function PaginationControls({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <p className="text-[10px] text-gray-500 tabular-nums">
        {rangeStart}–{rangeEnd} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          aria-label="Página anterior"
          className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          disabled={page === 1}
          type="button"
          onClick={() => onChange(page - 1)}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={14} />
        </button>
        <span className="text-[10px] font-medium text-gray-600 tabular-nums px-1.5">
          {page} / {totalPages}
        </span>
        <button
          aria-label="Página siguiente"
          className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          disabled={page === totalPages}
          type="button"
          onClick={() => onChange(page + 1)}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={14} />
        </button>
      </div>
    </div>
  );
}

export function ExerciseHistoryTable({
  logs,
  variant,
  exerciseName,
  onPlayVideo,
}: Props) {
  const [page, setPage] = useState(1);

  // Reset to page 1 when the dataset changes (refetch, exercise switch).
  useEffect(() => {
    setPage(1);
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </div>
    );
  }

  const orderedLogs = [...logs].reverse();
  const totalPages = Math.max(1, Math.ceil(orderedLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, orderedLogs.length);
  const pageLogs = orderedLogs.slice(startIdx, endIdx);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          Historial{" "}
          <span className="text-gray-400 font-normal">
            · {logs.length} {logs.length === 1 ? "sesión" : "sesiones"}
          </span>
        </p>
      </div>
      <div className="space-y-1.5">
        {pageLogs.map((log) =>
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
      <PaginationControls
        page={safePage}
        rangeEnd={endIdx}
        rangeStart={startIdx + 1}
        total={orderedLogs.length}
        totalPages={totalPages}
        onChange={setPage}
      />
    </div>
  );
}
