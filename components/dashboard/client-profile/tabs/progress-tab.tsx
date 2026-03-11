"use client";

import { Button, Select, SelectItem, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseLog {
  id: string;
  exercise_id: string;
  exercises: {
    id: string;
    name: string;
    category: string;
    muscle_groups: string[] | null;
  };
  scheduled_date: string;
  completed_at: string;
  sets_completed: number | null;
  reps_completed: string | null;
  weight_kg: number | null;
  weight_used: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  intensity: string | null;
  avg_heart_rate: number | null;
  notes: string | null;
}

interface ExerciseGroup {
  exercise: ExerciseLog["exercises"];
  logs: ExerciseLog[];
}

interface FormResponse {
  id: string;
  response_date: string;
  answers: Record<string, any>;
}

interface ProgressTabProps {
  clientId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { key: "30", label: "30 días" },
  { key: "90", label: "3 meses" },
  { key: "180", label: "6 meses" },
  { key: "365", label: "1 año" },
];

const CARDIO_CATEGORIES = new Set(["cardio"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCardioExercise(category: string): boolean {
  return CARDIO_CATEGORIES.has(category);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    strength: "Fuerza",
    cardio: "Cardio",
    flexibility: "Flexibilidad",
    balance: "Equilibrio",
    plyometric: "Pliométrico",
    olympic: "Olímpico",
    powerlifting: "Powerlifting",
    bodyweight: "Peso corporal",
    other: "Otro",
  };

  return labels[category] || category;
}

function buildDateRange(days: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  start.setDate(start.getDate() - parseInt(days));

  return {
    start: start.toISOString().split("T")[0]!,
    end: end.toISOString().split("T")[0]!,
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function DateRangeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {DATE_RANGES.map((r) => (
        <Button
          key={r.key}
          color={value === r.key ? "primary" : "default"}
          size="sm"
          variant={value === r.key ? "solid" : "flat"}
          onPress={() => onChange(r.key)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <Icon icon={icon} width={48} />
      <p className="text-base font-medium text-gray-500">{title}</p>
      {subtitle && (
        <p className="text-sm text-center max-w-xs text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Entrenamientos section ───────────────────────────────────────────────────

function EntrenamientosSection({
  logs,
  isLoading,
  error,
  onRetry,
}: {
  logs: ExerciseLog[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const strengthLogs = useMemo(
    () =>
      logs.filter(
        (l) => l.exercises && !isCardioExercise(l.exercises.category)
      ),
    [logs]
  );

  const byExercise = useMemo<Record<string, ExerciseGroup>>(() => {
    return strengthLogs.reduce(
      (acc, log) => {
        const key = log.exercise_id;

        if (!acc[key]) acc[key] = { exercise: log.exercises, logs: [] };
        acc[key].logs.push(log);

        return acc;
      },
      {} as Record<string, ExerciseGroup>
    );
  }, [strengthLogs]);

  const exerciseList = useMemo(
    () =>
      Object.values(byExercise).sort((a, b) =>
        a.exercise.name.localeCompare(b.exercise.name)
      ),
    [byExercise]
  );

  useEffect(() => {
    if (exerciseList.length > 0 && !byExercise[selectedExerciseId]) {
      setSelectedExerciseId(exerciseList[0]?.exercise.id ?? "");
    }
  }, [exerciseList, byExercise, selectedExerciseId]);

  const selectedGroup = selectedExerciseId
    ? byExercise[selectedExerciseId]
    : null;

  const chartData = useMemo(
    () =>
      selectedGroup?.logs.map((log) => ({
        date: formatDate(log.scheduled_date),
        weight: log.weight_kg ?? 0,
        weightLabel: log.weight_used ?? "",
      })) ?? [],
    [selectedGroup]
  );

  const bestWeight = useMemo(
    () =>
      selectedGroup
        ? Math.max(...selectedGroup.logs.map((l) => l.weight_kg ?? 0))
        : 0,
    [selectedGroup]
  );

  if (isLoading)
    return (
      <div className="flex justify-center h-48 items-center">
        <Spinner color="primary" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
        <Icon icon="solar:danger-circle-bold" width={36} />
        <p className="text-sm font-medium">{error}</p>
        <Button size="sm" variant="flat" onPress={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  if (strengthLogs.length === 0)
    return (
      <EmptyState
        icon="solar:dumbbell-bold"
        subtitle="Los registros aparecerán aquí cuando el cliente complete entrenamientos de fuerza"
        title="Sin registros de entrenamiento"
      />
    );

  return (
    <div className="space-y-5">
      <Select
        className="max-w-sm"
        label="Ejercicio"
        placeholder="Selecciona un ejercicio"
        selectedKeys={selectedExerciseId ? [selectedExerciseId] : []}
        onSelectionChange={(keys) => {
          const k = Array.from(keys)[0] as string;

          if (k) setSelectedExerciseId(k);
        }}
      >
        {exerciseList.map(({ exercise }) => (
          <SelectItem key={exercise.id} textValue={exercise.name}>
            <div className="flex flex-col">
              <span className="font-medium">{exercise.name}</span>
              <span className="text-xs text-default-400">
                {getCategoryLabel(exercise.category)}
              </span>
            </div>
          </SelectItem>
        ))}
      </Select>

      {selectedGroup && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              accent="blue"
              label="Registros"
              value={String(selectedGroup.logs.length)}
            />
            <StatCard
              accent="blue"
              label="Mejor peso"
              value={bestWeight > 0 ? `${bestWeight} kg` : "—"}
            />
            <StatCard
              label="Primer registro"
              value={selectedGroup.logs[0]?.weight_used ?? "—"}
            />
            <StatCard
              accent="green"
              label="Último registro"
              value={
                selectedGroup.logs[selectedGroup.logs.length - 1]
                  ?.weight_used ?? "—"
              }
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
              { label: "Notas", render: (l) => l.notes ?? "—", truncate: true },
            ]}
            logs={[...selectedGroup.logs].reverse()}
          />
        </>
      )}
    </div>
  );
}

// ─── Cardio section ───────────────────────────────────────────────────────────

function CardioSection({
  logs,
  isLoading,
  error,
  onRetry,
}: {
  logs: ExerciseLog[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const cardioLogs = useMemo(
    () =>
      logs.filter((l) => l.exercises && isCardioExercise(l.exercises.category)),
    [logs]
  );

  const byExercise = useMemo<Record<string, ExerciseGroup>>(() => {
    return cardioLogs.reduce(
      (acc, log) => {
        const key = log.exercise_id;

        if (!acc[key]) acc[key] = { exercise: log.exercises, logs: [] };
        acc[key].logs.push(log);

        return acc;
      },
      {} as Record<string, ExerciseGroup>
    );
  }, [cardioLogs]);

  const exerciseList = useMemo(
    () =>
      Object.values(byExercise).sort((a, b) =>
        a.exercise.name.localeCompare(b.exercise.name)
      ),
    [byExercise]
  );

  useEffect(() => {
    if (exerciseList.length > 0 && !byExercise[selectedExerciseId]) {
      setSelectedExerciseId(exerciseList[0]?.exercise.id ?? "");
    }
  }, [exerciseList, byExercise, selectedExerciseId]);

  const selectedGroup = selectedExerciseId
    ? byExercise[selectedExerciseId]
    : null;

  const chartData = useMemo(
    () =>
      selectedGroup?.logs.map((log) => ({
        date: formatDate(log.scheduled_date),
        duration: log.duration_minutes ?? 0,
        distance: log.distance_km ?? 0,
      })) ?? [],
    [selectedGroup]
  );

  const hasDuration = chartData.some((d) => d.duration > 0);
  const hasDistance = chartData.some((d) => d.distance > 0);
  const bestDuration = useMemo(
    () =>
      selectedGroup
        ? Math.max(...selectedGroup.logs.map((l) => l.duration_minutes ?? 0))
        : 0,
    [selectedGroup]
  );
  const bestDistance = useMemo(
    () =>
      selectedGroup
        ? Math.max(...selectedGroup.logs.map((l) => l.distance_km ?? 0))
        : 0,
    [selectedGroup]
  );

  if (isLoading)
    return (
      <div className="flex justify-center h-48 items-center">
        <Spinner color="primary" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
        <Icon icon="solar:danger-circle-bold" width={36} />
        <p className="text-sm font-medium">{error}</p>
        <Button size="sm" variant="flat" onPress={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  if (cardioLogs.length === 0)
    return (
      <EmptyState
        icon="solar:heart-pulse-bold"
        subtitle="Los registros aparecerán aquí cuando el cliente complete sesiones de cardio"
        title="Sin registros de cardio"
      />
    );

  return (
    <div className="space-y-5">
      <Select
        className="max-w-sm"
        label="Ejercicio cardio"
        placeholder="Selecciona un ejercicio"
        selectedKeys={selectedExerciseId ? [selectedExerciseId] : []}
        onSelectionChange={(keys) => {
          const k = Array.from(keys)[0] as string;

          if (k) setSelectedExerciseId(k);
        }}
      >
        {exerciseList.map(({ exercise }) => (
          <SelectItem key={exercise.id} textValue={exercise.name}>
            {exercise.name}
          </SelectItem>
        ))}
      </Select>

      {selectedGroup && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              accent="green"
              label="Registros"
              value={String(selectedGroup.logs.length)}
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
            <StatCard
              label="Último registro"
              value={
                selectedGroup.logs[selectedGroup.logs.length - 1]?.intensity ??
                (selectedGroup.logs[selectedGroup.logs.length - 1]
                  ?.duration_minutes
                  ? `${selectedGroup.logs[selectedGroup.logs.length - 1]?.duration_minutes} min`
                  : "—")
              }
            />
          </div>

          {chartData.length > 1 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Progresión de cardio
              </h3>
              <ResponsiveContainer height={280} width="100%">
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
              { label: "Notas", render: (l) => l.notes ?? "—", truncate: true },
            ]}
            logs={[...selectedGroup.logs].reverse()}
          />
        </>
      )}
    </div>
  );
}

// ─── NEAT section ─────────────────────────────────────────────────────────────

function NeatSection({
  clientId,
  daysRange,
}: {
  clientId: string;
  daysRange: string;
}) {
  const [stepsData, setStepsData] = useState<{ date: string; steps: number }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { start, end } = buildDateRange(daysRange);

    try {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=habits&start_date=${start}&end_date=${end}&days=${daysRange}`
      );
      const json = await res.json();

      if (!json.success) {
        setError("No se pudieron cargar los datos de NEAT.");

        return;
      }

      const responses: FormResponse[] = json.responses || [];
      const points = responses
        .map((r) => {
          const steps = Number(r.answers?.steps ?? r.answers?.pasos ?? 0);

          return { date: r.response_date, steps };
        })
        .filter((p) => p.steps > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      setStepsData(points);
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, daysRange]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

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
      <div className="flex justify-center h-48 items-center">
        <Spinner color="primary" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
        <Icon icon="solar:danger-circle-bold" width={36} />
        <p className="text-sm font-medium">{error}</p>
        <Button size="sm" variant="flat" onPress={fetchSteps}>
          Reintentar
        </Button>
      </div>
    );
  if (stepsData.length === 0)
    return (
      <EmptyState
        icon="solar:walking-bold"
        subtitle="Los pasos diarios aparecerán aquí cuando el cliente registre hábitos"
        title="Sin datos de pasos"
      />
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          accent="purple"
          label="Días registrados"
          value={String(stepsData.length)}
        />
        <StatCard
          accent="purple"
          label="Media de pasos"
          value={avgSteps > 0 ? avgSteps.toLocaleString("es-ES") : "—"}
        />
        <StatCard
          accent="purple"
          label="Mejor día"
          value={maxSteps > 0 ? maxSteps.toLocaleString("es-ES") : "—"}
        />
      </div>

      {chartData.length > 1 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Pasos diarios
          </h3>
          <ResponsiveContainer height={280} width="100%">
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
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">
            Se necesitan al menos 2 registros para mostrar la gráfica
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            Historial de pasos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Fecha
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Pasos
                </th>
              </tr>
            </thead>
            <tbody>
              {[...stepsData].reverse().map((p, idx) => (
                <tr
                  key={p.date}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx === 0 ? "bg-violet-50" : ""}`}
                >
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {formatDate(p.date)}
                  </td>
                  <td className="px-6 py-3 font-bold text-violet-700">
                    {p.steps.toLocaleString("es-ES")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<
  string,
  { border: string; label: string; value: string; bg: string }
> = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "text-blue-600",
    value: "text-blue-800",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    label: "text-green-600",
    value: "text-green-800",
  },
  purple: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    label: "text-violet-600",
    value: "text-violet-800",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    label: "text-gray-500",
    value: "text-gray-900",
  },
};

function StatCard({
  label,
  value,
  accent = "gray",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const c = ACCENT_COLORS[accent] ?? ACCENT_COLORS["gray"]!;

  return (
    <div className={`${c.bg} rounded-xl p-4 border ${c.border}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${c.label} mb-1`}
      >
        {label}
      </p>
      <p className={`text-xl font-bold ${c.value} truncate`}>{value}</p>
    </div>
  );
}

function ExerciseLineChart({
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
      <ResponsiveContainer height={280} width="100%">
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
            tickFormatter={yFormatter}
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

function LogTable<T extends ExerciseLog>({
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

// ─── Sub-tab nav ──────────────────────────────────────────────────────────────

type SubTab = "entrenamientos" | "cardio" | "neat";

const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
  {
    key: "entrenamientos",
    label: "Entrenamientos",
    icon: "solar:dumbbell-bold",
  },
  { key: "cardio", label: "Cardio", icon: "solar:heart-pulse-bold" },
  { key: "neat", label: "NEAT / Pasos", icon: "solar:walking-bold" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProgressTab({ clientId }: ProgressTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("entrenamientos");
  const [daysRange, setDaysRange] = useState("90");
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { start, end } = buildDateRange(daysRange);

    try {
      const res = await fetch(
        `/api/clients/${clientId}/exercise-logs/trainer?startDate=${start}&endDate=${end}`
      );
      const json = await res.json();

      if (!json.success) {
        setError("No se pudieron cargar los registros.");

        return;
      }

      setLogs(json.exerciseLogs || []);
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, daysRange]);

  useEffect(() => {
    if (activeSubTab !== "neat") {
      fetchLogs();
    }
  }, [fetchLogs, activeSubTab]);

  return (
    <div className="space-y-5 py-6">
      {/* Sub-tab nav + date range */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
              }`}
              onClick={() => setActiveSubTab(tab.key)}
            >
              <Icon icon={tab.icon} width={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <DateRangeSelector value={daysRange} onChange={setDaysRange} />
      </div>

      {/* Section content */}
      {activeSubTab === "entrenamientos" && (
        <EntrenamientosSection
          error={error}
          isLoading={isLoading}
          logs={logs}
          onRetry={fetchLogs}
        />
      )}
      {activeSubTab === "cardio" && (
        <CardioSection
          error={error}
          isLoading={isLoading}
          logs={logs}
          onRetry={fetchLogs}
        />
      )}
      {activeSubTab === "neat" && (
        <NeatSection clientId={clientId} daysRange={daysRange} />
      )}
    </div>
  );
}
