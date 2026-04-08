"use client";

import type { ExerciseGroup } from "./types";

import { Icon } from "@iconify/react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "./helpers";
import { StatCard, Sparkline } from "./ui-atoms";
import { LogTable } from "./exercise-chart";

export function CardioExerciseCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: ExerciseGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { exercise, logs } = group;
  const durations = logs.map((l) => l.duration_minutes ?? 0);
  const distances = logs.map((l) => l.distance_km ?? 0);
  const hasDuration = durations.some((d) => d > 0);
  const hasDistance = distances.some((d) => d > 0);
  const lastLog = logs[logs.length - 1];
  const bestDuration = Math.max(...durations);
  const bestDistance = Math.max(...distances);

  const sparkData = hasDuration ? durations : distances;
  const sparkColor = hasDuration ? "#059669" : "#d97706";

  const lastValue = lastLog?.duration_minutes
    ? `${lastLog.duration_minutes} min`
    : lastLog?.distance_km
      ? `${lastLog.distance_km} km`
      : (lastLog?.intensity ?? "—");

  const chartData = logs.map((l) => ({
    date: formatDate(l.scheduled_date),
    duration: l.duration_minutes ?? 0,
    distance: l.distance_km ?? 0,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <Icon
            className="text-green-600"
            icon="solar:heart-pulse-bold"
            width={16}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {exercise.name}
          </p>
          <span className="text-xs text-gray-400">{logs.length} reg.</span>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-bold text-green-700">{lastValue}</span>
          <div className="w-16">
            <Sparkline color={sparkColor} data={sparkData} height={20} />
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
              accent="green"
              label="Registros"
              value={String(logs.length)}
            />
            <StatCard
              accent="green"
              label="Mejor duración"
              value={bestDuration > 0 ? `${bestDuration} min` : "—"}
            />
            <StatCard
              accent="green"
              label="Mejor distancia"
              value={bestDistance > 0 ? `${bestDistance} km` : "—"}
            />
            <StatCard label="Último" value={lastValue} />
          </div>

          {chartData.length > 1 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Progresión de cardio
              </h3>
              <ResponsiveContainer height={250} width="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #d1d5db",
                      fontSize: "12px",
                      color: "#111827",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", color: "#374151" }}
                  />
                  {hasDuration && (
                    <Line
                      activeDot={{ r: 6 }}
                      dataKey="duration"
                      dot={{ r: 4, fill: "#059669" }}
                      name="Duración (min)"
                      stroke="#059669"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  )}
                  {hasDistance && (
                    <Line
                      activeDot={{ r: 6 }}
                      dataKey="distance"
                      dot={{ r: 4, fill: "#d97706" }}
                      name="Distancia (km)"
                      stroke="#d97706"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-gray-500">
                Se necesitan al menos 2 registros para mostrar la gráfica
              </p>
            </div>
          )}

          <LogTable
            columns={[
              { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
              {
                label: "Duración",
                render: (l) =>
                  l.duration_minutes ? `${l.duration_minutes} min` : "—",
              },
              {
                label: "Distancia",
                render: (l) => (l.distance_km ? `${l.distance_km} km` : "—"),
              },
              { label: "Intensidad", render: (l) => l.intensity ?? "—" },
              {
                label: "FC media",
                render: (l) =>
                  l.avg_heart_rate ? `${l.avg_heart_rate} bpm` : "—",
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
