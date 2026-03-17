"use client";

import type { ExerciseLog } from "./types";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── ExerciseLineChart ────────────────────────────────────────────────────────

export function ExerciseLineChart({
  data,
  lines,
  yFormatter,
  title,
}: {
  data: Record<string, any>[];
  lines: {
    key: string;
    label: string;
    color: string;
    formatter?: (v: any) => string;
  }[];
  yFormatter?: (v: any) => string;
  title: string;
}) {
  if (data.length < 2) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-gray-500">
          Se necesitan al menos 2 registros para mostrar la gráfica
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer height={250} width="100%">
        <LineChart
          data={data}
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
            {...(yFormatter ? { tickFormatter: yFormatter } : {})}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "12px",
              color: "#111827",
            }}
            formatter={(value, name) => {
              const line = lines.find(
                (l) => l.label === name || l.key === name
              );

              return [
                line?.formatter ? line.formatter(value) : value,
                line?.label ?? String(name),
              ];
            }}
          />
          {lines.map((l) => (
            <Line
              key={l.key}
              activeDot={{ r: 6 }}
              dataKey={l.key}
              dot={{ r: 4, fill: l.color }}
              name={l.label}
              stroke={l.color}
              strokeWidth={2.5}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── LogTable ─────────────────────────────────────────────────────────────────

export function LogTable<T extends ExerciseLog>({
  logs,
  columns,
}: {
  logs: T[];
  columns: {
    label: string;
    render: (log: T) => React.ReactNode;
    truncate?: boolean;
  }[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">
          Historial de registros
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.label}
                  className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr
                key={log.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx === 0 ? "bg-blue-50" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.label}
                    className={`px-6 py-3 text-gray-700 ${col.truncate ? "max-w-[200px] truncate" : ""}`}
                  >
                    {col.render(log)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
