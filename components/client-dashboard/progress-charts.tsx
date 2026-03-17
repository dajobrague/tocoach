"use client";

import { Icon } from "@iconify/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  contentStyle: {
    borderRadius: "10px",
    border: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: "12px",
    color: "#111827",
    padding: "8px 12px",
  },
};

function ChartHeader({
  label,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-foreground/70 tracking-wide">
          {label}
        </p>
        <div className={`${iconBg} p-1.5 rounded-full`}>
          <Icon className={`${iconColor} text-base`} icon={icon} />
        </div>
      </div>
      <p className="text-4xl font-bold mb-0.5 text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-sm text-foreground/60 mb-3">{subtitle}</p>
    </>
  );
}

// ─── Weight Chart ─────────────────────────────────────────────────────────────

export function WeightChart({
  data,
  currentValue,
}: {
  data: { date: string; weight: number }[];
  currentValue: number;
}) {
  const hasData = data.some((d) => d.weight > 0);

  if (!hasData) return <EmptyState label="Sin datos de peso" />;

  const filtered = data.filter((d) => d.weight > 0);
  const min = Math.min(...filtered.map((d) => d.weight));
  const max = Math.max(...filtered.map((d) => d.weight));
  const domainPad = Math.max((max - min) * 0.15, 0.5);

  return (
    <div>
      <ChartHeader
        icon="solar:body-bold"
        iconBg="bg-warning/10"
        iconColor="text-warning"
        label="PESO"
        subtitle="kg hoy"
        value={currentValue || 0}
      />
      <ResponsiveContainer height={160} width="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="weightGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[min - domainPad, max + domainPad]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number) => [`${v} kg`, "Peso"]}
          />
          <Area
            connectNulls
            activeDot={{
              r: 4,
              fill: "#f59e0b",
              stroke: "#fff",
              strokeWidth: 2,
            }}
            dataKey="weight"
            fill="url(#weightGrad)"
            stroke="#f59e0b"
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sleep Chart ──────────────────────────────────────────────────────────────

export function SleepChart({
  data,
  currentValue,
}: {
  data: { date: string; hours: number }[];
  currentValue: number;
}) {
  const hasData = data.some((d) => d.hours > 0);

  if (!hasData) return <EmptyState label="Sin datos de sueño" />;

  return (
    <div>
      <ChartHeader
        icon="solar:moon-sleep-bold"
        iconBg="bg-green-100"
        iconColor="text-green-600"
        label="SUEÑO"
        subtitle="horas anoche"
        value={currentValue || 0}
      />
      <ResponsiveContainer height={160} width="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 12]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number) => [`${v}h`, "Sueño"]}
          />
          <ReferenceLine
            stroke="#86efac"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            y={7}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => {
              let fill = "#d1d5db";

              if (entry.hours > 0 && entry.hours < 6) fill = "#fca5a5";
              else if (entry.hours >= 6 && entry.hours < 7) fill = "#fde68a";
              else if (entry.hours >= 7 && entry.hours <= 9) fill = "#34d399";
              else if (entry.hours > 9) fill = "#6ee7b7";

              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-3 mt-1 justify-center">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#fca5a5]" />
          <span className="text-[9px] text-foreground/40">&lt;6h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#fde68a]" />
          <span className="text-[9px] text-foreground/40">6-7h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#34d399]" />
          <span className="text-[9px] text-foreground/40">7-9h</span>
        </div>
      </div>
    </div>
  );
}

// ─── Calories Chart ───────────────────────────────────────────────────────────

export function CaloriesChart({
  data,
  currentValue,
}: {
  data: { date: string; calories: number }[];
  currentValue: number;
}) {
  const hasData = data.some((d) => d.calories > 0);

  if (!hasData) return <EmptyState label="Sin datos de calorías" />;

  const nonZero = data.filter((d) => d.calories > 0);
  const avg = nonZero.length
    ? Math.round(nonZero.reduce((s, d) => s + d.calories, 0) / nonZero.length)
    : 0;

  return (
    <div>
      <ChartHeader
        icon="solar:fire-bold"
        iconBg="bg-danger/10"
        iconColor="text-danger"
        label="CALORÍAS"
        subtitle={
          avg > 0 ? `media: ${avg.toLocaleString("es-ES")} kcal` : "hoy"
        }
        value={currentValue ? currentValue.toLocaleString("es-ES") : 0}
      />
      <ResponsiveContainer height={160} width="100%">
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="calBarGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, name: string) => [
              name === "Media"
                ? `${v} kcal`
                : `${v.toLocaleString("es-ES")} kcal`,
              name === "Media" ? "Media" : "Calorías",
            ]}
          />
          {avg > 0 && (
            <ReferenceLine
              label={{
                value: `${avg}`,
                position: "right",
                fontSize: 9,
                fill: "#a78bfa",
              }}
              stroke="#a78bfa"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              y={avg}
            />
          )}
          <Bar
            dataKey="calories"
            fill="url(#calBarGrad)"
            radius={[3, 3, 0, 0]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Protein Chart ────────────────────────────────────────────────────────────

export function ProteinChart({
  data,
  currentValue,
}: {
  data: { date: string; protein: number }[];
  currentValue: number;
}) {
  const hasData = data.some((d) => d.protein > 0);

  if (!hasData) return null;

  const nonZero = data.filter((d) => d.protein > 0);
  const avg = nonZero.length
    ? Math.round(nonZero.reduce((s, d) => s + d.protein, 0) / nonZero.length)
    : 0;

  return (
    <div>
      <ChartHeader
        icon="solar:health-bold"
        iconBg="bg-indigo-100"
        iconColor="text-indigo-500"
        label="PROTEÍNA"
        subtitle={avg > 0 ? `media: ${avg}g / día` : "hoy"}
        value={`${currentValue || 0}g`}
      />
      <ResponsiveContainer height={160} width="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="protChartGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            unit="g"
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number) => [`${v}g`, "Proteína"]}
          />
          {avg > 0 && (
            <ReferenceLine
              label={{
                value: `${avg}g`,
                position: "right",
                fontSize: 9,
                fill: "#6366f1",
              }}
              stroke="#6366f1"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              y={avg}
            />
          )}
          <Area
            activeDot={{
              r: 4,
              fill: "#6366f1",
              stroke: "#fff",
              strokeWidth: 2,
            }}
            dataKey="protein"
            fill="url(#protChartGrad)"
            stroke="#6366f1"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Macros Ring ──────────────────────────────────────────────────────────────

export function MacrosRing({
  protein,
  carbs,
  fats,
}: {
  protein: number;
  carbs: number;
  fats: number;
}) {
  const total = protein + carbs + fats;

  if (total === 0) return null;

  const pPct = Math.round((protein / total) * 100);
  const cPct = Math.round((carbs / total) * 100);
  const fPct = 100 - pPct - cPct;
  const pDeg = (protein / total) * 360;
  const cDeg = (carbs / total) * 360;
  const gradient = `conic-gradient(#6366f1 0deg ${pDeg}deg, #10b981 ${pDeg}deg ${pDeg + cDeg}deg, #f59e0b ${pDeg + cDeg}deg 360deg)`;

  const macros = [
    {
      label: "Proteína",
      g: protein,
      pct: pPct,
      color: "#6366f1",
      bg: "bg-indigo-500",
      kcal: protein * 4,
    },
    {
      label: "Carbos",
      g: carbs,
      pct: cPct,
      color: "#10b981",
      bg: "bg-emerald-500",
      kcal: carbs * 4,
    },
    {
      label: "Grasas",
      g: fats,
      pct: fPct,
      color: "#f59e0b",
      bg: "bg-amber-500",
      kcal: fats * 9,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-foreground/70 tracking-wide">
          MACROS (MEDIA)
        </p>
        <div className="bg-violet-100 p-1.5 rounded-full">
          <Icon
            className="text-violet-500 text-base"
            icon="solar:chart-2-bold"
          />
        </div>
      </div>
      <div className="flex items-center gap-5 mt-3">
        <div className="relative w-28 h-28 flex-shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: gradient }}
          />
          <div className="absolute inset-3 bg-content1 rounded-full flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-foreground">{total}g</span>
            <span className="text-[8px] text-foreground/40 uppercase">
              / día
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          {macros.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${m.bg}`} />
                  <span className="text-xs font-medium text-foreground/70">
                    {m.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-foreground">
                  {m.g}g{" "}
                  <span className="text-foreground/40 font-normal">
                    ({m.pct}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 bg-default-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Training Activity Chart ──────────────────────────────────────────────────

export function TrainingActivityChart({
  data,
  weekTotal,
}: {
  data: { date: string; strength: number; cardio: number }[];
  weekTotal: number;
}) {
  const hasData = data.some((d) => d.strength > 0 || d.cardio > 0);

  if (!hasData) return null;

  return (
    <div>
      <ChartHeader
        icon="solar:dumbbell-bold"
        iconBg="bg-blue-100"
        iconColor="text-blue-500"
        label="ACTIVIDAD DE ENTRENAMIENTO"
        subtitle="ejercicios esta semana"
        value={weekTotal}
      />
      <ResponsiveContainer height={160} width="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, name: string) => [
              `${v}`,
              name === "strength" ? "Fuerza" : "Cardio",
            ]}
          />
          <Bar
            barSize={12}
            dataKey="strength"
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
            stackId="a"
          />
          <Bar
            barSize={12}
            dataKey="cardio"
            fill="#ef4444"
            radius={[3, 3, 0, 0]}
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-foreground/50">Fuerza</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span className="text-[10px] text-foreground/50">Cardio</span>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2 text-foreground/30">
      <Icon icon="solar:chart-2-linear" width={28} />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
