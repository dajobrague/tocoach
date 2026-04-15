"use client";

import type { ExerciseGroup, ExerciseLog } from "./types";

import { Icon } from "@iconify/react";

import { formatDate } from "./helpers";
import { StatCard, Sparkline } from "./ui-atoms";
import { ExerciseLineChart, LogTable } from "./exercise-chart";

function getMaxWeight(log: ExerciseLog): number {
  if (log.sets && log.sets.length > 0) {
    return Math.max(...log.sets.map((s) => s.weight_kg ?? 0));
  }

  return log.weight_kg ?? 0;
}

function formatSetsCell(log: ExerciseLog): React.ReactNode {
  if (log.sets && log.sets.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {log.sets.map((s) => (
          <div key={s.set_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {s.set_number}
            </span>
            <span>{s.reps ?? "—"} reps</span>
            <span className="text-gray-400">&middot;</span>
            <span className="font-medium">
              {s.weight_kg != null ? `${s.weight_kg}kg` : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (log.sets_completed && log.reps_completed) {
    return `${log.sets_completed} × ${log.reps_completed}`;
  }

  return "—";
}

function getDisplayWeight(log: ExerciseLog): string {
  if (log.sets && log.sets.length > 0) {
    const maxW = Math.max(...log.sets.map((s) => s.weight_kg ?? 0));

    return maxW > 0 ? `${maxW}kg` : "—";
  }

  return log.weight_used ?? "—";
}

export function StrengthExerciseCard({
  group,
  isExpanded,
  onToggle,
  onPlayVideo,
}: {
  group: ExerciseGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onPlayVideo?: (url: string, name: string) => void;
}) {
  const { exercise, logs } = group;
  const weights = logs.map((l) => getMaxWeight(l));
  const lastLog = logs[logs.length - 1];
  const bestWeight = Math.max(...weights);

  const chartData = logs.map((l) => ({
    date: formatDate(l.scheduled_date),
    weight: getMaxWeight(l),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon
            className="text-blue-600"
            icon="solar:dumbbell-bold"
            width={16}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {exercise.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{logs.length} reg.</span>
            {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
              <span className="text-xs text-gray-400">
                · {exercise.muscle_groups.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-bold text-blue-700">
            {lastLog ? getDisplayWeight(lastLog) : "—"}
          </span>
          <div className="w-16">
            <Sparkline color="#2563eb" data={weights} height={20} />
          </div>
        </div>
        <Icon
          className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          icon="solar:alt-arrow-down-linear"
          width={16}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              accent="blue"
              label="Registros"
              value={String(logs.length)}
            />
            <StatCard
              accent="blue"
              label="Mejor peso"
              value={bestWeight > 0 ? `${bestWeight} kg` : "—"}
            />
            <StatCard
              label="Primer reg."
              value={logs[0] ? getDisplayWeight(logs[0]) : "—"}
            />
            <StatCard
              accent="green"
              label="Último reg."
              value={lastLog ? getDisplayWeight(lastLog) : "—"}
            />
          </div>

          <ExerciseLineChart
            data={chartData}
            lines={[
              {
                key: "weight",
                label: "Peso (kg)",
                color: "#2563eb",
                formatter: (v) => `${v} kg`,
              },
            ]}
            title="Progresión de carga"
            yFormatter={(v) => `${v}kg`}
          />

          <LogTable
            columns={[
              { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
              {
                label: "Series",
                render: (l) => formatSetsCell(l),
              },
              {
                label: "Peso máx.",
                render: (l) => (
                  <span className="font-bold text-blue-700">
                    {getDisplayWeight(l)}
                  </span>
                ),
              },
              {
                label: "",
                render: (l) =>
                  l.video_url && onPlayVideo ? (
                    <button
                      className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                      onClick={() => onPlayVideo(l.video_url!, exercise.name)}
                    >
                      <Icon icon="solar:play-circle-bold" width={20} />
                    </button>
                  ) : null,
              },
              {
                label: "Notas",
                render: (l) => l.notes ?? "—",
                wrap: true,
              },
            ]}
            logs={[...logs].reverse()}
          />
        </div>
      )}
    </div>
  );
}
