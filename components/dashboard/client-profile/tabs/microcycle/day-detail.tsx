"use client";

import type { ExerciseLog } from "../progress/types";
import type { DayMetrics, PrescribedExercise } from "./types";

import { Icon } from "@iconify/react";

import { formatPercent } from "./adherence";

function formatDateLong(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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

  const prescribedReps = (() => {
    if (p.prescribedReps == null) return 0;
    const m = String(p.prescribedReps).match(/\d+/);

    return m ? parseInt(m[0]) : 0;
  })();
  const prescribedLoad =
    prescribedSets * prescribedReps * (p.prescribedWeightKg ?? 0);
  const carga =
    prescribedLoad === 0 ? 1 : Math.min(loggedLoad / prescribedLoad, 1);

  return { ejercicios, series, carga, loggedSets, loggedLoad };
}

interface Props {
  day: DayMetrics;
  orphanLogs: ExerciseLog[];
}

export function DayDetail({ day, orphanLogs }: Props) {
  if (day.classification === "rest") {
    return (
      <section className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 capitalize">
        {formatDateLong(day.date)} — día de descanso o sin sesión programada.
        {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-white border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {formatDateLong(day.date)}
          {day.scheduledSession?.session
            ? ` · ${day.scheduledSession.session.name}`
            : ""}
        </p>
        {day.classification === "future" ? (
          <p className="text-xs text-gray-500 mt-0.5">
            Día programado — aún por entrenarse.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">
            Ejercicios {formatPercent(day.adherence.ejercicios)}
            {" · "}
            Series {formatPercent(day.adherence.series)}
            {" · "}
            Carga {formatPercent(day.adherence.carga)}
          </p>
        )}
      </header>

      {day.prescribed.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {day.prescribed.map((p) => (
            <PrescribedRow
              key={p.exerciseId}
              isFuture={day.classification === "future"}
              logs={day.logs}
              prescribed={p}
            />
          ))}
        </ul>
      ) : null}

      {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
    </section>
  );
}

function PrescribedRow({
  prescribed,
  logs,
  isFuture,
}: {
  prescribed: PrescribedExercise;
  logs: ExerciseLog[];
  isFuture: boolean;
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
  const statusSymbol =
    status === "complete"
      ? "●"
      : status === "partial"
        ? "◐"
        : status === "pending"
          ? "○"
          : "·";
  const statusColor =
    status === "complete"
      ? "text-green-600"
      : status === "partial"
        ? "text-amber-500"
        : status === "pending"
          ? "text-gray-400"
          : "text-gray-300";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`text-lg leading-none mt-0.5 ${statusColor}`}
        >
          {statusSymbol}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {prescribed.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
            Prescrito · {prescribed.prescribedSets ?? "—"} ×{" "}
            {prescribed.prescribedReps ?? "—"}
            {prescribed.prescribedWeightKg
              ? ` @ ${prescribed.prescribedWeightKg}kg`
              : ""}
          </p>
          {isFuture ? null : (
            <p className="text-xs text-gray-700 mt-0.5 tabular-nums">
              Ejecutado · {totalSets} series · {Math.round(stats.loggedLoad)}{" "}
              kg·reps
              {" — "}E {formatPercent(stats.ejercicios)} · S{" "}
              {formatPercent(stats.series)} · C {formatPercent(stats.carga)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function OrphanSection({ logs }: { logs: ExerciseLog[] }) {
  // Group by exercise name for a tidy listing.
  const byExercise = new Map<string, number>();

  for (const log of logs) {
    if (!log.exercises) continue;
    byExercise.set(
      log.exercises.name,
      (byExercise.get(log.exercises.name) ?? 0) + 1
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
      <p className="text-[11px] font-semibold text-gray-600 mb-1 inline-flex items-center gap-1">
        <Icon icon="solar:list-bold" width={12} />
        También registró
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
