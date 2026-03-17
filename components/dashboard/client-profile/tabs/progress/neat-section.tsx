"use client";

import type { StepsPoint } from "./types";

import { Spinner } from "@heroui/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "./helpers";
import { StatCard } from "./ui-atoms";

export function NeatSection({
  stepsData,
  isLoading,
}: {
  stepsData: StepsPoint[];
  isLoading: boolean;
}) {
  const chartData = stepsData.map((p) => ({
    date: formatDate(p.date),
    pasos: p.steps,
  }));
  const avgSteps = stepsData.length
    ? Math.round(stepsData.reduce((s, p) => s + p.steps, 0) / stepsData.length)
    : 0;
  const maxSteps = stepsData.length
    ? Math.max(...stepsData.map((p) => p.steps))
    : 0;

  if (isLoading)
    return (
      <div className="flex justify-center h-32 items-center">
        <Spinner color="primary" />
      </div>
    );
  if (stepsData.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          accent="purple"
          icon="solar:calendar-bold"
          label="Días registrados"
          value={String(stepsData.length)}
        />
        <StatCard
          accent="purple"
          icon="solar:walking-bold"
          label="Media de pasos"
          value={avgSteps > 0 ? avgSteps.toLocaleString("es-ES") : "—"}
        />
        <StatCard
          accent="purple"
          icon="solar:cup-star-bold"
          label="Mejor día"
          value={maxSteps > 0 ? maxSteps.toLocaleString("es-ES") : "—"}
        />
      </div>

      {chartData.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Pasos diarios
          </h3>
          <ResponsiveContainer height={220} width="100%">
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
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                }
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                  fontSize: "12px",
                  color: "#111827",
                }}
                formatter={(v) => [Number(v).toLocaleString("es-ES"), "Pasos"]}
              />
              <Line
                activeDot={{ r: 6 }}
                dataKey="pasos"
                dot={{ r: 4, fill: "#7c3aed" }}
                name="Pasos"
                stroke="#7c3aed"
                strokeWidth={2.5}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
