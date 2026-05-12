"use client";

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { computeSessionVolume } from "./helpers";
import { HistoryDateFilter } from "./history-date-filter";

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

function StrengthSetRow({
  set,
  videoUrl,
  videoIsLegacy,
  exerciseName,
  onPlayVideo,
}: {
  set: ExerciseLogSet;
  /** Resolved video for this set: per-set video, or legacy session-level video on set 1. */
  videoUrl: string | null;
  /** True when videoUrl is the session-level legacy video (not specific to this set). */
  videoIsLegacy: boolean;
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-100 rounded-md px-1.5 py-1 w-fit">
      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
        {set.set_number}
      </span>
      <span className="text-gray-900 tabular-nums whitespace-nowrap">
        <span className="font-semibold">{set.reps ?? "—"}</span>
        <span className="text-gray-400 mx-0.5">reps</span>
        <span className="text-gray-400 mx-0.5">×</span>
        <span className="font-semibold">
          {set.weight_kg != null ? set.weight_kg : "—"}
        </span>
        <span className="text-gray-400 ml-0.5">kg</span>
      </span>
      {videoUrl ? (
        <button
          aria-label={
            videoIsLegacy
              ? `Ver video de ${exerciseName} (sesión completa)`
              : `Ver video de ${exerciseName} serie ${set.set_number}`
          }
          className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors shrink-0 -mr-0.5 ${
            videoIsLegacy
              ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              : "text-blue-600 hover:text-blue-800 hover:bg-blue-100"
          }`}
          title={videoIsLegacy ? "Video de la sesión completa" : undefined}
          type="button"
          onClick={() => onPlayVideo(videoUrl, exerciseName)}
        >
          <Icon icon="solar:play-circle-bold" width={15} />
        </button>
      ) : null}
    </div>
  );
}

function SessionHeader({
  log,
  exerciseName,
  onPlayVideo,
  /** Strength sessions render videos per set; cardio keeps the session-level button. */
  showSessionVideoButton = true,
}: {
  log: ExerciseLog;
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
  showSessionVideoButton?: boolean;
}) {
  return (
    <header className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold text-gray-700 capitalize tabular-nums">
        {formatLongDate(log.scheduled_date)}
      </p>
      {showSessionVideoButton && log.video_url ? (
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

  // Per-set videos (migration 091). Legacy sessions stored a single video at
  // exercise_logs.video_url; when no per-set videos exist we surface that on
  // set 1 with a muted treatment so the trainer can still see it.
  const anyPerSetVideo = sets.some((s) => Boolean(s.video_url));
  const legacyVideoUrl = log.video_url ?? null;

  return (
    <article className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <SessionHeader
        exerciseName={exerciseName}
        log={log}
        showSessionVideoButton={false}
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
          <div className="flex flex-wrap gap-1.5">
            {sets.map((set, idx) => {
              const perSetVideo = set.video_url ?? null;
              const showLegacyHere =
                !anyPerSetVideo && idx === 0 && legacyVideoUrl;
              const resolvedUrl =
                perSetVideo ?? (showLegacyHere ? legacyVideoUrl : null);
              const isLegacy = !perSetVideo && Boolean(showLegacyHere);

              return (
                <StrengthSetRow
                  key={set.set_number}
                  exerciseName={exerciseName}
                  set={set}
                  videoIsLegacy={isLegacy}
                  videoUrl={resolvedUrl}
                  onPlayVideo={onPlayVideo}
                />
              );
            })}
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
  const [dateFilter, setDateFilter] = useState<string>("");

  // Reset filter and page when the underlying dataset changes (exercise
  // switch, refetch). Keying on logs.length missed refetches that returned
  // the same count but different rows — the filter could then hide every
  // row of the new dataset until manually cleared. Hashing the first/last
  // ids captures a row-identity change without iterating the whole array.
  const datasetKey = useMemo(() => {
    if (logs.length === 0) return "empty";
    const first = logs[0]?.id ?? "";
    const last = logs[logs.length - 1]?.id ?? "";

    return `${logs.length}:${first}:${last}`;
  }, [logs]);

  useEffect(() => {
    setPage(1);
    setDateFilter("");
  }, [datasetKey]);

  // Reset page to 1 whenever the filter changes.
  useEffect(() => {
    setPage(1);
  }, [dateFilter]);

  // Distinct dates with sessions — fed into the calendar popover so days
  // with data are highlighted and the rest are non-clickable.
  const distinctDates = useMemo(() => {
    const set = new Set<string>();

    for (const l of logs) {
      if (l.scheduled_date) set.add(l.scheduled_date);
    }

    return Array.from(set);
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </div>
    );
  }

  const orderedLogs = [...logs].reverse();
  const filteredLogs = dateFilter
    ? orderedLogs.filter((l) => l.scheduled_date === dateFilter)
    : orderedLogs;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filteredLogs.length);
  const pageLogs = filteredLogs.slice(startIdx, endIdx);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-gray-700">
          Historial{" "}
          <span className="text-gray-400 font-normal">
            ·{" "}
            {dateFilter
              ? `${filteredLogs.length} ${filteredLogs.length === 1 ? "sesión" : "sesiones"} en esta fecha`
              : `${logs.length} ${logs.length === 1 ? "sesión" : "sesiones"}`}
          </span>
        </p>
        <HistoryDateFilter
          datesWithSessions={distinctDates}
          value={dateFilter}
          onChange={setDateFilter}
        />
      </div>
      {filteredLogs.length === 0 ? (
        <div className="text-xs text-gray-400 italic px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
          Sin registros para esta fecha.
        </div>
      ) : (
        <>
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
            total={filteredLogs.length}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
