"use client";

// Métricas de un ejercicio en el microciclo, ancladas a un icono de gráfica
// en cada fila. Reusa los mismos bloques que Entrenamiento/Cardio
// (stats grid + volumen + historial de ../workouts) sobre el historial
// COMPLETO del ejercicio — el día seleccionado ya muestra sus propios sets
// en la fila, así que aquí la pregunta es "¿cómo progresa este ejercicio?".

import type { ExerciseLog } from "../progress/types";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ExerciseHistoryTable } from "../workouts/exercise-history-table";
import {
  CardioStatsGrid,
  StrengthStatsGrid,
} from "../workouts/exercise-progress-stats";
import { ExerciseVolumeChart } from "../workouts/exercise-volume-chart";
import {
  computeCardioStats,
  computeStrengthStats,
  logsToSessionSets,
} from "../workouts/helpers";

import { computeE1rmSeries, computeRepMaxes } from "@/lib/training/e1rm";

/** 97.5 → "97,5 kg". */
function formatKg(value: number): string {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg`;
}

/**
 * Tira compacta de récords bajo la gráfica: el 1RM estimado de la última
 * sesión + la mejor marca y unos pocos rangos de reps. El popover mide 600px y
 * scrollea a los 520, así que esto es UNA línea — no otra tabla.
 */
function RecordsStrip({ logs }: { logs: ExerciseLog[] }) {
  const sessions = logsToSessionSets(logs);
  const repMaxes = computeRepMaxes(sessions);
  const series = computeE1rmSeries(sessions);
  const current = series[series.length - 1]?.e1rm ?? null;

  if (repMaxes.length === 0 && current === null) return null;

  // La "mejor marca" es la de mayor 1RM estimado, no la de más kilos:
  // 100 kg × 3 supera a 105 kg × 1 y el peso suelto no lo ve.
  const best = repMaxes.reduce<(typeof repMaxes)[number] | null>(
    (acc, record) => (acc === null || record.e1rm > acc.e1rm ? record : acc),
    null
  );
  const others = repMaxes
    .filter((record) => record.bucket !== best?.bucket)
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, 3);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-large border border-gray-200 bg-gray-50/60 px-3 py-2 text-[11px] tabular-nums">
      {current !== null ? (
        <span className="font-semibold text-blue-600">
          1RM est. {formatKg(current)}
        </span>
      ) : null}
      {best !== null ? (
        <>
          {current !== null ? <span className="text-gray-300">·</span> : null}
          <span className="font-semibold text-gray-900">
            🏅 {formatKg(best.weightKg)} ({best.reps}{" "}
            {best.reps === 1 ? "rep" : "reps"})
          </span>
        </>
      ) : null}
      {others.map((record) => (
        <span key={record.bucket} className="text-gray-500">
          <span className="mr-2 text-gray-300">·</span>
          {record.bucket}×{formatKg(record.weightKg)}
        </span>
      ))}
    </div>
  );
}

interface Props {
  exerciseName: string;
  /** Categoría de librería — todo lo que no sea "cardio" rinde como strength. */
  category: string | undefined;
  /** Historial all-time del ejercicio (de useClientExerciseLogs). */
  logs: ExerciseLog[];
  onPlayVideo?: ((url: string, name: string) => void) | undefined;
}

const noop = () => {};

export function ExerciseMetricsPopover({
  exerciseName,
  category,
  logs,
  onPlayVideo,
}: Props) {
  const variant = category === "cardio" ? "cardio" : "strength";

  return (
    <Popover placement="bottom-end" shouldBlockScroll={false}>
      <PopoverTrigger>
        <Button
          isIconOnly
          aria-label={`Ver métricas de ${exerciseName}`}
          className="text-gray-400 hover:text-primary"
          size="sm"
          title="Métricas del ejercicio"
          variant="light"
        >
          <Icon icon="solar:chart-2-linear" width={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(600px,calc(100vw-2rem))] p-0">
        <div className="w-full max-h-[520px] overflow-y-auto p-4 space-y-4 text-left">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {exerciseName}
            </p>
            <p className="text-[11px] text-gray-500">
              Historial completo del ejercicio
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Icon
                className="text-gray-300"
                icon="solar:chart-2-linear"
                width={32}
              />
              <p className="text-xs text-gray-500">
                Sin registros todavía para este ejercicio.
              </p>
            </div>
          ) : (
            <>
              {variant === "strength" ? (
                <StrengthStatsGrid stats={computeStrengthStats(logs)} />
              ) : (
                <CardioStatsGrid stats={computeCardioStats(logs)} />
              )}

              <ExerciseVolumeChart logs={logs} variant={variant} />

              {variant === "strength" ? <RecordsStrip logs={logs} /> : null}

              <ExerciseHistoryTable
                exerciseName={exerciseName}
                logs={logs}
                variant={variant}
                onPlayVideo={onPlayVideo ?? noop}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
