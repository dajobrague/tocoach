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
import { computeCardioStats, computeStrengthStats } from "../workouts/helpers";

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
