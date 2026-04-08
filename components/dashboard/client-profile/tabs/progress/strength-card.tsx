"use client";

import type { ExerciseGroup } from "./types";

import { Icon } from "@iconify/react";

import { formatDate } from "./helpers";
import { StatCard, Sparkline } from "./ui-atoms";
import { ExerciseLineChart, LogTable } from "./exercise-chart";

export function StrengthExerciseCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: ExerciseGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { exercise, logs } = group;
  const weights = logs.map((l) => l.weight_kg ?? 0);
  const lastLog = logs[logs.length - 1];
  const bestWeight = Math.max(...weights);

  const chartData = logs.map((l) => ({
    date: formatDate(l.scheduled_date),
    weight: l.weight_kg ?? 0,
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
            {lastLog?.weight_used ?? "—"}
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
            <StatCard label="Primer reg." value={logs[0]?.weight_used ?? "—"} />
            <StatCard
              accent="green"
              label="Último reg."
              value={lastLog?.weight_used ?? "—"}
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
                label: "Series × Reps",
                render: (l) =>
                  l.sets_completed && l.reps_completed
                    ? `${l.sets_completed} × ${l.reps_completed}`
                    : "—",
              },
              {
                label: "Peso",
                render: (l) => (
                  <span className="font-bold text-blue-700">
                    {l.weight_used ?? "—"}
                  </span>
                ),
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
