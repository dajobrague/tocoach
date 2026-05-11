"use client";

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";
import type { DayMetrics, PrescribedExercise } from "./types";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { formatPercent } from "./adherence";

function formatDateLong(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function parseRepsNumber(reps: string | null | undefined): number {
  if (reps == null) return 0;
  const m = String(reps).match(/\d+/);

  return m ? parseInt(m[0]) : 0;
}

function exerciseAdherence(
  p: PrescribedExercise,
  logs: ExerciseLog[]
): {
  ejercicios: number;
  series: number;
  carga: number;
  loggedSets: number;
  loggedLoad: number;
  prescribedLoad: number;
} {
  const sets = logs
    .filter((l) => l.exercise_id === p.exerciseId)
    .flatMap((l) => l.sets ?? []);
  const loggedSets = sets.length;
  const loggedLoad = sets.reduce(
    (acc, s) => acc + (s.reps ?? 0) * (s.weight_kg ?? 0),
    0
  );

  const ejercicios = loggedSets > 0 ? 1 : 0;
  const prescribedSets = p.prescribedSets ?? 0;
  const series =
    prescribedSets === 0 ? 0 : Math.min(loggedSets / prescribedSets, 1);
  const prescribedReps = parseRepsNumber(p.prescribedReps);
  const prescribedLoad =
    prescribedSets * prescribedReps * (p.prescribedWeightKg ?? 0);
  const carga =
    prescribedLoad === 0 ? 1 : Math.min(loggedLoad / prescribedLoad, 1);

  return {
    ejercicios,
    series,
    carga,
    loggedSets,
    loggedLoad,
    prescribedLoad,
  };
}

// ─── Compact KPI chip ────────────────────────────────────────────────────────

const CHIP_ACCENTS: Record<
  string,
  { bg: string; border: string; label: string; value: string }
> = {
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    label: "text-green-600",
    value: "text-green-800",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "text-amber-600",
    value: "text-amber-800",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    label: "text-gray-500",
    value: "text-gray-900",
  },
};

function pctAccent(pct: number): keyof typeof CHIP_ACCENTS {
  if (pct >= 0.9) return "green";
  if (pct >= 0.5) return "amber";

  return "gray";
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: keyof typeof CHIP_ACCENTS;
}) {
  const c = CHIP_ACCENTS[accent] ?? CHIP_ACCENTS.gray!;

  return (
    <div className={`${c.bg} rounded-md px-2.5 py-1.5 border ${c.border}`}>
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${c.label}`}
      >
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${c.value}`}>{value}</p>
    </div>
  );
}

// ─── Mini progress bar ───────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const fillClass =
    value >= 0.9
      ? "bg-green-500"
      : value >= 0.5
        ? "bg-amber-500"
        : value > 0
          ? "bg-gray-400"
          : "bg-gray-300";

  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        aria-label={`${pct}%`}
        className={`h-full ${fillClass} transition-all duration-200`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Per-set row (used inside expanded PrescribedRow) ────────────────────────

function ExecutedSetRow({
  set,
  exerciseName,
  onPlayVideo,
}: {
  set: ExerciseLogSet;
  exerciseName: string;
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
        {set.set_number}
      </span>
      <span className="text-gray-900 tabular-nums flex-1 min-w-0">
        <span className="font-semibold">{set.reps ?? "—"}</span>
        <span className="text-gray-400 mx-0.5">reps</span>
        <span className="text-gray-400 mx-0.5">×</span>
        <span className="font-semibold">
          {set.weight_kg != null ? set.weight_kg : "—"}
        </span>
        <span className="text-gray-400 ml-0.5">kg</span>
      </span>
      {set.video_url && onPlayVideo ? (
        <button
          aria-label={`Ver video de ${exerciseName} serie ${set.set_number}`}
          className="inline-flex items-center justify-center w-6 h-6 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors shrink-0"
          type="button"
          onClick={() => onPlayVideo(set.video_url!, exerciseName)}
        >
          <Icon icon="solar:play-circle-bold" width={15} />
        </button>
      ) : null}
    </div>
  );
}

// ─── Per-exercise prescribed row (collapsible) ────────────────────────────────

function PrescribedRow({
  prescribed,
  logs,
  isFuture,
  isExpanded,
  onToggle,
  onPlayVideo,
}: {
  prescribed: PrescribedExercise;
  logs: ExerciseLog[];
  isFuture: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}) {
  const exerciseLogs = logs.filter(
    (l) => l.exercise_id === prescribed.exerciseId
  );
  const stats = exerciseAdherence(prescribed, exerciseLogs);
  const totalSets = stats.loggedSets;
  const status = isFuture
    ? "future"
    : totalSets === 0
      ? "pending"
      : totalSets >= (prescribed.prescribedSets ?? 0)
        ? "complete"
        : "partial";
  const statusColor =
    status === "complete"
      ? "bg-green-100 text-green-700"
      : status === "partial"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-500";
  const statusSymbol =
    status === "complete"
      ? "●"
      : status === "partial"
        ? "◐"
        : status === "pending"
          ? "○"
          : "·";

  // Set list comes from the actual exercise_logs for this exercise on this date.
  const allSets = exerciseLogs.flatMap((l) => l.sets ?? []);

  // Notes — we surface the first non-empty note (sessions usually have one log
  // per exercise per date so this is plenty).
  const notes = exerciseLogs.find((l) => l.notes)?.notes ?? null;

  // Legacy session-level video: surface on set 1 if no per-set video exists.
  const anyPerSetVideo = allSets.some((s) => Boolean(s.video_url));
  const legacySessionVideo = anyPerSetVideo
    ? null
    : (exerciseLogs.find((l) => l.video_url)?.video_url ?? null);

  const canExpand = !isFuture && (allSets.length > 0 || notes !== null);

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base leading-none ${statusColor}`}
        >
          {statusSymbol}
        </span>

        <button
          aria-expanded={canExpand ? isExpanded : undefined}
          className="flex-1 min-w-0 text-left"
          disabled={!canExpand}
          type="button"
          onClick={() => {
            if (canExpand) onToggle();
          }}
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate flex-1">
              {prescribed.name}
            </p>
            {canExpand ? (
              <Icon
                className={`text-gray-400 transition-transform shrink-0 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                icon="solar:alt-arrow-down-linear"
                width={14}
              />
            ) : null}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
            Prescrito · {prescribed.prescribedSets ?? "—"} ×{" "}
            {prescribed.prescribedReps ?? "—"}
            {prescribed.prescribedWeightKg
              ? ` @ ${prescribed.prescribedWeightKg}kg`
              : ""}
          </p>

          {!isFuture && stats.prescribedLoad > 0 ? (
            <div className="mt-1.5">
              <ProgressBar value={stats.carga} />
            </div>
          ) : null}

          {!isFuture ? (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <StatChip
                accent={pctAccent(stats.ejercicios)}
                label="E"
                value={formatPercent(stats.ejercicios)}
              />
              <StatChip
                accent={pctAccent(stats.series)}
                label="S"
                value={formatPercent(stats.series)}
              />
              {stats.prescribedLoad > 0 ? (
                <StatChip
                  accent={pctAccent(stats.carga)}
                  label="C"
                  value={formatPercent(stats.carga)}
                />
              ) : (
                <StatChip accent="gray" label="C" value="—" />
              )}
            </div>
          ) : null}
        </button>
      </div>

      {isExpanded && canExpand ? (
        <div className="mt-3 ml-10 space-y-2">
          {allSets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
              {allSets.map((set) => (
                <ExecutedSetRow
                  key={`${set.id ?? set.set_number}`}
                  exerciseName={prescribed.name}
                  set={set}
                  onPlayVideo={onPlayVideo}
                />
              ))}
            </div>
          ) : null}

          {legacySessionVideo && onPlayVideo ? (
            <button
              className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Video grabado para toda la sesión"
              type="button"
              onClick={() => onPlayVideo(legacySessionVideo, prescribed.name)}
            >
              <Icon icon="solar:play-circle-bold" width={13} />
              Video de la sesión completa
            </button>
          ) : null}

          {notes ? (
            <div className="text-[11px] text-gray-600 bg-amber-50 border-l-2 border-amber-300 px-2 py-1 rounded-r leading-snug">
              <span className="font-medium text-amber-700">Notas · </span>
              {notes}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ─── Orphan "También registró" sub-section ───────────────────────────────────

function OrphanSection({ logs }: { logs: ExerciseLog[] }) {
  const byExercise = new Map<string, number>();

  for (const log of logs) {
    if (!log.exercises) continue;
    byExercise.set(
      log.exercises.name,
      (byExercise.get(log.exercises.name) ?? 0) + 1
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/40">
      <p className="text-[11px] font-semibold text-amber-700 mb-1 inline-flex items-center gap-1">
        <Icon icon="solar:list-bold" width={12} />
        También registró (fuera del plan)
      </p>
      <ul className="text-xs text-gray-700 space-y-0.5">
        {Array.from(byExercise.entries()).map(([name, count]) => (
          <li key={name} className="tabular-nums">
            · {name}{" "}
            <span className="text-gray-400">
              ({count} {count === 1 ? "registro" : "registros"})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── DayDetail (main export) ─────────────────────────────────────────────────

interface Props {
  day: DayMetrics;
  orphanLogs: ExerciseLog[];
  onPlayVideo?: (url: string, name: string) => void;
}

export function DayDetail({ day, orphanLogs, onPlayVideo }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });

  if (day.classification === "rest") {
    return (
      <section className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 capitalize">
        {formatDateLong(day.date)} — día de descanso o sin sesión programada.
        {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
      </section>
    );
  }

  const showFuture = day.classification === "future";

  return (
    <section className="rounded-lg bg-white border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {formatDateLong(day.date)}
          {day.scheduledSession?.session
            ? ` · ${day.scheduledSession.session.name}`
            : ""}
        </p>
        {showFuture ? (
          <p className="text-xs text-gray-500">
            Día programado — aún por entrenarse.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatChip
              accent={pctAccent(day.adherence.ejercicios)}
              label="Ejercicios"
              value={formatPercent(day.adherence.ejercicios)}
            />
            <StatChip
              accent={pctAccent(day.adherence.series)}
              label="Series"
              value={formatPercent(day.adherence.series)}
            />
            {day.adherence.prescribedLoadTotal > 0 ? (
              <StatChip
                accent={pctAccent(day.adherence.carga)}
                label="Carga"
                value={formatPercent(day.adherence.carga)}
              />
            ) : (
              <StatChip accent="gray" label="Carga" value="—" />
            )}
          </div>
        )}
      </header>

      {day.prescribed.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {day.prescribed.map((p) => (
            <PrescribedRow
              key={p.exerciseId}
              isExpanded={expanded.has(p.exerciseId)}
              isFuture={showFuture}
              logs={day.logs}
              prescribed={p}
              onPlayVideo={onPlayVideo}
              onToggle={() => toggle(p.exerciseId)}
            />
          ))}
        </ul>
      ) : null}

      {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
    </section>
  );
}
