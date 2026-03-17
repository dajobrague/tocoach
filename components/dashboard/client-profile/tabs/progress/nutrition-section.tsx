"use client";

import type { NutritionPoint } from "./types";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DATE_RANGES = [
  { key: "30", label: "30 días" },
  { key: "90", label: "3 meses" },
  { key: "180", label: "6 meses" },
  { key: "365", label: "1 año" },
];

const COLORS = {
  protein: "#6366f1",
  carbs: "#10b981",
  fats: "#f59e0b",
  calories: "#ef4444",
  caloriesLight: "#fca5a5",
  average: "#8b5cf6",
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function fmtDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: string;
}) {
  const map: Record<
    string,
    { bg: string; border: string; ic: string; val: string }
  > = {
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      ic: "text-amber-500",
      val: "text-amber-800",
    },
    indigo: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      ic: "text-indigo-500",
      val: "text-indigo-800",
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      ic: "text-emerald-500",
      val: "text-emerald-800",
    },
    red: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      ic: "text-rose-500",
      val: "text-rose-800",
    },
    purple: {
      bg: "bg-violet-50",
      border: "border-violet-200",
      ic: "text-violet-500",
      val: "text-violet-800",
    },
  };
  const c = map[color] || map.amber!;

  return (
    <div className={`${c.bg} ${c.border} rounded-xl p-4 border`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={c.ic} icon={icon} width={16} />
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
      </div>
      <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function MacroRing({
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
  const gradient = `conic-gradient(${COLORS.protein} 0deg ${pDeg}deg, ${COLORS.carbs} ${pDeg}deg ${pDeg + cDeg}deg, ${COLORS.fats} ${pDeg + cDeg}deg 360deg)`;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative w-44 h-44 flex-shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-800">{total}g</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            total / día
          </span>
        </div>
      </div>
      <div className="space-y-4 flex-1 w-full">
        {[
          {
            label: "Proteína",
            value: protein,
            pct: pPct,
            color: COLORS.protein,
            bg: "bg-indigo-500",
            kcal: protein * 4,
          },
          {
            label: "Carbohidratos",
            value: carbs,
            pct: cPct,
            color: COLORS.carbs,
            bg: "bg-emerald-500",
            kcal: carbs * 4,
          },
          {
            label: "Grasas",
            value: fats,
            pct: fPct,
            color: COLORS.fats,
            bg: "bg-amber-500",
            kcal: fats * 9,
          },
        ].map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${m.bg}`} />
                <span className="text-sm font-medium text-gray-700">
                  {m.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">
                  {m.value}g
                </span>
                <span className="text-xs text-gray-400 ml-1.5">({m.pct}%)</span>
                <span className="text-[10px] text-gray-300 ml-1.5">
                  {m.kcal} kcal
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${m.pct}%`, backgroundColor: m.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsistencyGrid({ data }: { data: NutritionPoint[] }) {
  const weeks = useMemo(() => {
    if (data.length === 0) return [];
    const loggedDates = new Set(data.map((d) => d.date));
    const end = new Date();
    const start = new Date();

    start.setDate(end.getDate() - 83);
    start.setDate(start.getDate() - start.getDay() + 1);

    const result: {
      weekLabel: string;
      days: { date: string; logged: boolean; dayName: string }[];
    }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const days: { date: string; logged: boolean; dayName: string }[] = [];

      for (let d = 0; d < 7; d++) {
        const ds = cursor.toISOString().split("T")[0]!;
        const isFuture = cursor > end;

        days.push({
          date: ds,
          logged: !isFuture && loggedDates.has(ds),
          dayName: DAY_NAMES[d]!,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push({
        weekLabel: fmtDate(weekStart.toISOString().split("T")[0]!),
        days,
      });
    }

    return result;
  }, [data]);

  const totalDays = weeks.reduce(
    (s, w) => s + w.days.filter((d) => d.logged).length,
    0
  );
  const totalPossible = weeks.reduce(
    (s, w) =>
      s +
      w.days.filter((d) => new Date(d.date + "T00:00:00") <= new Date()).length,
    0
  );
  const pct =
    totalPossible > 0 ? Math.round((totalDays / totalPossible) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            Consistencia de registro
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Últimas 12 semanas</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{pct}%</p>
          <p className="text-[10px] text-gray-400">
            {totalDays} de {totalPossible} días
          </p>
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="flex flex-col gap-1.5 pt-5">
          {DAY_NAMES.map((d) => (
            <div key={d} className="h-4 flex items-center">
              <span className="text-[9px] text-gray-400 w-6 text-right">
                {d}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 flex-1 overflow-hidden">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-1.5">
              <span className="text-[8px] text-gray-300 text-center h-3 leading-3 truncate">
                {wi % 2 === 0 ? w.weekLabel : ""}
              </span>
              {w.days.map((d, di) => {
                const isFuture = new Date(d.date + "T00:00:00") > new Date();

                return (
                  <div
                    key={di}
                    className={`w-4 h-4 rounded-sm ${
                      isFuture
                        ? "bg-gray-50 border border-dashed border-gray-200"
                        : d.logged
                          ? "bg-emerald-500"
                          : "bg-gray-100"
                    }`}
                    title={`${d.date} — ${d.logged ? "Registrado" : isFuture ? "Futuro" : "Sin registro"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[9px] text-gray-400">Menos</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
        <span className="text-[9px] text-gray-400">Más</span>
      </div>
    </div>
  );
}

const sharedTooltip = {
  contentStyle: {
    borderRadius: "12px",
    border: "none",
    boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
    fontSize: "13px",
    color: "#111827",
  },
};

export function NutritionProgressView({ clientId }: { clientId: string }) {
  const [daysRange, setDaysRange] = useState("90");
  const [data, setData] = useState<NutritionPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(startDate.getDate() - parseInt(daysRange));
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    try {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=habits&start_date=${start}&end_date=${end}`
      );
      const json = await res.json();

      if (json.success) {
        const responses = json.responses || [];
        const points: NutritionPoint[] = responses
          .map((r: any) => ({
            date: r.response_date,
            calories: Number(r.answers?.calories ?? r.answers?.calorias ?? 0),
            protein: Number(r.answers?.protein ?? r.answers?.proteina ?? 0),
            carbs: Number(r.answers?.carbs ?? r.answers?.carbohidratos ?? 0),
            fats: Number(r.answers?.fats ?? r.answers?.grasas ?? 0),
          }))
          .filter((p: NutritionPoint) => p.calories > 0 || p.protein > 0)
          .sort((a: NutritionPoint, b: NutritionPoint) =>
            a.date.localeCompare(b.date)
          );

        setData(points);
      }
    } catch {
      /* non-critical */
    } finally {
      setIsLoading(false);
    }
  }, [clientId, daysRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const weeklyData = useMemo(() => {
    if (data.length === 0) return [];
    const weeks: Record<string, NutritionPoint[]> = {};

    data.forEach((p) => {
      const d = new Date(p.date + "T00:00:00");
      const ws = new Date(d);

      ws.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = ws.toISOString().split("T")[0]!;

      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(p);
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, points]) => ({
        week: fmtDate(weekKey),
        Calorías: Math.round(
          points.reduce((s, p) => s + p.calories, 0) / points.length
        ),
        Proteína: Math.round(
          points.reduce((s, p) => s + p.protein, 0) / points.length
        ),
        Carbos: Math.round(
          points.reduce((s, p) => s + p.carbs, 0) / points.length
        ),
        Grasas: Math.round(
          points.reduce((s, p) => s + p.fats, 0) / points.length
        ),
        días: points.length,
      }))
      .slice(-12);
  }, [data]);

  const dayOfWeekData = useMemo(() => {
    if (data.length === 0) return [];
    const buckets: Record<
      number,
      { cal: number; prot: number; count: number }
    > = {};

    data.forEach((p) => {
      const d = new Date(p.date + "T00:00:00");
      const dow = (d.getDay() + 6) % 7;

      if (!buckets[dow]) buckets[dow] = { cal: 0, prot: 0, count: 0 };
      buckets[dow].cal += p.calories;
      buckets[dow].prot += p.protein;
      buckets[dow].count++;
    });

    return DAY_NAMES.map((name, i) => {
      const b = buckets[i];

      return {
        day: name,
        Calorías: b ? Math.round(b.cal / b.count) : 0,
        Proteína: b ? Math.round(b.prot / b.count) : 0,
      };
    });
  }, [data]);

  const caloriesWithMA = useMemo(() => {
    return data.map((p, i) => {
      const window = data.slice(Math.max(0, i - 6), i + 1);
      const ma = Math.round(
        window.reduce((s, w) => s + w.calories, 0) / window.length
      );

      return { date: fmtDate(p.date), Calorías: p.calories, "Media 7d": ma };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner color="primary" label="Cargando datos de nutrición..." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Icon icon="solar:fire-bold-duotone" width={48} />
        <p className="text-base font-medium text-gray-500">
          Sin datos de nutrición
        </p>
        <p className="text-sm text-center max-w-xs text-gray-400">
          Los datos aparecerán aquí cuando el cliente registre su alimentación
          en los hábitos diarios
        </p>
      </div>
    );
  }

  const avg = (arr: NutritionPoint[], key: keyof NutritionPoint) =>
    Math.round(arr.reduce((s, p) => s + (p[key] as number), 0) / arr.length);

  const avgCalories = avg(data, "calories");
  const avgProtein = avg(data, "protein");
  const avgCarbs = avg(data, "carbs");
  const avgFats = avg(data, "fats");
  const maxCalories = Math.max(...data.map((p) => p.calories));
  const minCalories = Math.min(
    ...data.filter((p) => p.calories > 0).map((p) => p.calories)
  );

  const last7 = data.slice(-7);
  const avg7Cal = last7.length ? avg(last7, "calories") : 0;
  const avg7Prot = last7.length ? avg(last7, "protein") : 0;

  const macrosStackedData = data.map((p) => ({
    date: fmtDate(p.date),
    Proteína: p.protein,
    Carbos: p.carbs,
    Grasas: p.fats,
  }));

  const hasMacros = avgProtein > 0 || avgCarbs > 0 || avgFats > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Progreso Nutricional
          </h2>
          <p className="text-sm text-gray-500">
            {data.length} días registrados
          </p>
        </div>
        <div className="flex gap-2">
          {DATE_RANGES.map((r) => (
            <Button
              key={r.key}
              color={daysRange === r.key ? "primary" : "default"}
              size="sm"
              variant={daysRange === r.key ? "solid" : "flat"}
              onPress={() => setDaysRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          color="red"
          icon="solar:fire-bold"
          label="Media Calorías"
          subtitle="Período completo"
          value={avgCalories.toLocaleString("es-ES")}
        />
        <StatCard
          color="indigo"
          icon="solar:health-bold"
          label="Media Proteína"
          subtitle={`${avgProtein}g / día`}
          value={`${avgProtein}g`}
        />
        <StatCard
          color="emerald"
          icon="solar:leaf-bold"
          label="Media Carbos"
          subtitle={`${avgCarbs}g / día`}
          value={`${avgCarbs}g`}
        />
        <StatCard
          color="amber"
          icon="solar:waterdrop-bold"
          label="Media Grasas"
          subtitle={`${avgFats}g / día`}
          value={`${avgFats}g`}
        />
        <StatCard
          color="purple"
          icon="solar:calendar-bold"
          label="Últimos 7 días"
          subtitle={`${avg7Prot}g proteína`}
          value={`${avg7Cal} kcal`}
        />
      </div>

      {/* Calories Area + 7-day moving average */}
      {caloriesWithMA.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                Calorías diarias
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Línea púrpura = media móvil de 7 días
              </p>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>
                Máx:{" "}
                <span className="font-semibold text-gray-600">
                  {maxCalories.toLocaleString("es-ES")}
                </span>
              </span>
              <span>
                Mín:{" "}
                <span className="font-semibold text-gray-600">
                  {minCalories.toLocaleString("es-ES")}
                </span>
              </span>
            </div>
          </div>
          <ResponsiveContainer height={300} width="100%">
            <ComposedChart
              data={caloriesWithMA}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="calGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.calories}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.calories}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis
                axisLine={false}
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                width={55}
              />
              <Tooltip
                {...sharedTooltip}
                formatter={(v: number, name: string) => [
                  v.toLocaleString("es-ES") + " kcal",
                  name,
                ]}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                activeDot={{
                  r: 4,
                  fill: COLORS.calories,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                dataKey="Calorías"
                fill="url(#calGrad)"
                stroke={COLORS.calories}
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="Media 7d"
                dot={false}
                stroke={COLORS.average}
                strokeDasharray="6 3"
                strokeWidth={2.5}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Macro Distribution Ring + Consistency side by side */}
      {hasMacros && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-5">
              Distribución promedio de macros
            </h3>
            <MacroRing carbs={avgCarbs} fats={avgFats} protein={avgProtein} />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <ConsistencyGrid data={data} />
          </div>
        </div>
      )}

      {/* Weekly Calorie + Protein averages */}
      {weeklyData.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                Promedios semanales
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Calorías (barras) y proteína (línea)
              </p>
            </div>
          </div>
          <ResponsiveContainer height={300} width="100%">
            <ComposedChart
              data={weeklyData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                stroke="#f0f0f0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="week"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                width={55}
                yAxisId="cal"
              />
              <YAxis
                hide
                axisLine={false}
                orientation="right"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                width={40}
                yAxisId="prot"
              />
              <Tooltip
                {...sharedTooltip}
                formatter={(v: number, name: string) => [
                  name === "Proteína" ? `${v}g` : `${v} kcal`,
                  name === "Calorías" ? "Cal. promedio" : "Prot. promedio",
                ]}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Bar
                barSize={32}
                dataKey="Calorías"
                radius={[6, 6, 0, 0]}
                yAxisId="cal"
              >
                {weeklyData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === weeklyData.length - 1
                        ? COLORS.calories
                        : COLORS.caloriesLight
                    }
                  />
                ))}
              </Bar>
              <Line
                activeDot={{
                  r: 5,
                  fill: COLORS.protein,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                dataKey="Proteína"
                dot={{ r: 3, fill: COLORS.protein }}
                stroke={COLORS.protein}
                strokeWidth={2.5}
                type="monotone"
                yAxisId="prot"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Day of week pattern */}
      {dayOfWeekData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Patrón por día de la semana
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Calorías promedio por día
              </p>
            </div>
            <ResponsiveContainer height={260} width="100%">
              <BarChart
                data={dayOfWeekData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="#f0f0f0"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#6b7280", fontWeight: 500 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  {...sharedTooltip}
                  formatter={(v: number) => [
                    `${v.toLocaleString("es-ES")} kcal`,
                    "Promedio",
                  ]}
                />
                <Bar barSize={36} dataKey="Calorías" radius={[8, 8, 0, 0]}>
                  {dayOfWeekData.map((entry, i) => {
                    const maxDow = Math.max(
                      ...dayOfWeekData.map((d) => d.Calorías)
                    );
                    const isMax = entry.Calorías === maxDow && maxDow > 0;
                    const isWeekend = i >= 5;

                    return (
                      <Cell
                        key={i}
                        fill={
                          isMax
                            ? COLORS.calories
                            : isWeekend
                              ? "#fbbf24"
                              : "#60a5fa"
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Proteína por día de la semana
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Gramos promedio por día
              </p>
            </div>
            <ResponsiveContainer height={260} width="100%">
              <BarChart
                data={dayOfWeekData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="#f0f0f0"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#6b7280", fontWeight: 500 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  unit="g"
                  width={50}
                />
                <Tooltip
                  {...sharedTooltip}
                  formatter={(v: number) => [`${v}g`, "Proteína"]}
                />
                <Bar barSize={36} dataKey="Proteína" radius={[8, 8, 0, 0]}>
                  {dayOfWeekData.map((entry, i) => {
                    const maxDow = Math.max(
                      ...dayOfWeekData.map((d) => d.Proteína)
                    );
                    const isMax = entry.Proteína === maxDow && maxDow > 0;
                    const isWeekend = i >= 5;

                    return (
                      <Cell
                        key={i}
                        fill={
                          isMax
                            ? COLORS.protein
                            : isWeekend
                              ? "#a78bfa"
                              : "#818cf8"
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly Stacked Macros */}
      {weeklyData.length > 1 && hasMacros && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Macros semanales (apilados)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Distribución promedio de macronutrientes por semana
            </p>
          </div>
          <ResponsiveContainer height={300} width="100%">
            <BarChart
              data={weeklyData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                stroke="#f0f0f0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="week"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                unit="g"
                width={55}
              />
              <Tooltip
                {...sharedTooltip}
                formatter={(v: number, name: string) => [`${v}g`, name]}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Bar
                barSize={28}
                dataKey="Proteína"
                fill={COLORS.protein}
                radius={[0, 0, 0, 0]}
                stackId="macros"
              />
              <Bar
                barSize={28}
                dataKey="Carbos"
                fill={COLORS.carbs}
                radius={[0, 0, 0, 0]}
                stackId="macros"
              />
              <Bar
                barSize={28}
                dataKey="Grasas"
                fill={COLORS.fats}
                radius={[6, 6, 0, 0]}
                stackId="macros"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Macros Stacked Area Trend */}
      {macrosStackedData.length > 1 && hasMacros && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Macronutrientes por día (tendencia)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Evolución diaria de proteína, carbohidratos y grasas
            </p>
          </div>
          <ResponsiveContainer height={300} width="100%">
            <AreaChart
              data={macrosStackedData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="protGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.protein}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.protein}
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="carbGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.carbs}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.carbs}
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fatGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.fats} stopOpacity={0.4} />
                  <stop
                    offset="95%"
                    stopColor={COLORS.fats}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis
                axisLine={false}
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                unit="g"
                width={55}
              />
              <Tooltip
                {...sharedTooltip}
                formatter={(v: number, name: string) => [`${v}g`, name]}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                activeDot={{ r: 4 }}
                dataKey="Proteína"
                fill="url(#protGrad)"
                stroke={COLORS.protein}
                strokeWidth={2}
                type="monotone"
              />
              <Area
                activeDot={{ r: 4 }}
                dataKey="Carbos"
                fill="url(#carbGrad)"
                stroke={COLORS.carbs}
                strokeWidth={2}
                type="monotone"
              />
              <Area
                activeDot={{ r: 4 }}
                dataKey="Grasas"
                fill="url(#fatGrad)"
                stroke={COLORS.fats}
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
