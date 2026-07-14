"use client";

import type { WorkoutExercise } from "@/types/training";
import type { ExerciseLog } from "../progress/types";

import { Icon } from "@iconify/react";

import { CardioStatsGrid, StrengthStatsGrid } from "./exercise-progress-stats";
import { ExerciseVolumeChart } from "./exercise-volume-chart";
import { ExerciseHistoryTable } from "./exercise-history-table";
import { computeCardioStats, computeStrengthStats } from "./helpers";

interface Props {
  /** When null, the card renders as an orphan: no prescription row, no edit/delete. */
  prescribed: WorkoutExercise | null;
  /** Display name override — used for orphan cards where `prescribed` is null. */
  exerciseName?: string;
  /** Strength vs cardio variant — the parent (tab or orphan section) decides. */
  variant: "strength" | "cardio";
  logs: ExerciseLog[];
  isExpanded: boolean;
  onToggle: () => void;
  onPlayVideo: (url: string, name: string) => void;
  /** In-plan actions (edit, delete, external video). Omitted for orphan cards. */
  actions?: React.ReactNode;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function StrengthPrescriptionRow({
  prescribed,
}: {
  prescribed: WorkoutExercise;
}) {
  return (
    <div className="text-sm text-gray-600 mt-1">
      {prescribed.sets && prescribed.reps && (
        <span>
          {prescribed.sets} × {prescribed.reps}
        </span>
      )}
      {prescribed.rest && <span className="ml-2">· {prescribed.rest}</span>}
      {prescribed.rir && <span className="ml-2">· RIR {prescribed.rir}</span>}
      {prescribed.trainingSystem && (
        <span className="ml-2">· {prescribed.trainingSystem}</span>
      )}
      {prescribed.tempo && (
        <span className="ml-2">· Tempo {prescribed.tempo}</span>
      )}
    </div>
  );
}

function CardioPrescriptionRow({
  prescribed,
}: {
  prescribed: WorkoutExercise;
}) {
  const parts: string[] = [];

  if (prescribed.duration) parts.push(`${prescribed.duration} min`);
  if (prescribed.distance) parts.push(`${prescribed.distance} km`);
  if (prescribed.intensity) parts.push(String(prescribed.intensity));
  if (prescribed.cardioType) parts.push(String(prescribed.cardioType));

  if (parts.length === 0) return null;

  return <div className="text-sm text-gray-600 mt-1">{parts.join(" · ")}</div>;
}

export function ExerciseProgressCard({
  prescribed,
  exerciseName,
  variant,
  logs,
  isExpanded,
  onToggle,
  onPlayVideo,
  actions,
  dragHandleProps,
}: Props) {
  const name = prescribed?.name ?? exerciseName ?? "Ejercicio";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
      <div className="flex items-start gap-3 p-3">
        {dragHandleProps ? (
          <div
            className="flex items-center justify-center mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            {...dragHandleProps}
          >
            <Icon icon="solar:hamburger-menu-linear" width={16} />
          </div>
        ) : null}

        {prescribed?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            src={prescribed.imageUrl}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Icon
              className="text-gray-400"
              icon={
                variant === "cardio"
                  ? "solar:heart-pulse-bold"
                  : "solar:dumbbell-bold"
              }
              width={28}
            />
          </div>
        )}

        <button
          aria-expanded={isExpanded}
          className="flex-1 text-left min-w-0"
          type="button"
          onClick={onToggle}
        >
          <p className="font-medium text-gray-900 truncate">{name}</p>
          {prescribed ? (
            variant === "cardio" ? (
              <CardioPrescriptionRow prescribed={prescribed} />
            ) : (
              <StrengthPrescriptionRow prescribed={prescribed} />
            )
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">
              {logs.length} sesiones registradas · fuera del plan vigente
            </p>
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
          <button
            aria-label={isExpanded ? "Colapsar" : "Expandir"}
            className="p-1 rounded hover:bg-gray-100"
            type="button"
            onClick={onToggle}
          >
            <Icon
              className={`text-gray-400 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              icon="solar:alt-arrow-down-linear"
              width={18}
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100">
          {variant === "strength" ? (
            <StrengthStatsGrid stats={computeStrengthStats(logs)} />
          ) : (
            <CardioStatsGrid stats={computeCardioStats(logs)} />
          )}

          <ExerciseVolumeChart logs={logs} variant={variant} />

          <ExerciseHistoryTable
            exerciseName={name}
            logs={logs}
            variant={variant}
            onPlayVideo={onPlayVideo}
          />

          {prescribed?.description && (
            <p className="text-xs text-gray-500">{prescribed.description}</p>
          )}
          {prescribed?.notes && (
            <p className="text-xs text-gray-500 italic">
              Notas: {prescribed.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
