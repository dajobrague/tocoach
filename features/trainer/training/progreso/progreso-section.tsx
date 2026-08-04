"use client";

// Rebanada "Progreso": ¿este ejercicio está mejorando? Orden de lectura del
// mockup aprobado — selector de ejercicio en la fila de pills (por portal),
// franja de stats con separadores finos, gráfica de progresión y tabla de
// récords por repeticiones.
//
// El eje de todo es el e1RM (1RM estimado): comparar "80 kg × 10" con "100 kg
// × 3" a ojo es imposible, y el peso máximo suelto premia las series cortas.
// La matemática vive en lib/training/e1rm.ts y la ejecuta el servidor; acá
// solo se pinta lo que devuelve el endpoint de progresión.

import type { ProgressionPoint } from "./progreso-api";

import { Autocomplete, AutocompleteItem, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useLoggedExercises } from "../videos/use-videos";

import {
  bestRepMax,
  computeTrend,
  formatKg,
  formatLongDate,
  formatTickDate,
  formatVolume,
  isRecent,
  repsLabel,
} from "./progreso-format";
import { useProgression } from "./use-progreso";

// 1M/3M/1A (llamada 29 Jul): según el nivel del cliente un mes ya muestra
// cambios; dos años era un horizonte que nadie consultaba.
const RANGES = [
  { key: "1m", label: "1M", days: 30, caption: "último mes" },
  { key: "3m", label: "3M", days: 90, caption: "últimos 3 meses" },
  { key: "1a", label: "1A", days: 365, caption: "último año" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const METRICS = [
  { key: "e1rm", label: "1 RM" },
  { key: "volumeKg", label: "Volumen" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

/** Días recientes que aún cuentan como "PR reciente" en la tabla de récords. */
const RECENT_PR_DAYS = 14;

const BLUE = "#2563eb";

// ─── Piezas de presentación ─────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string | null;
  tone: "blue" | "neutral";
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={`text-[20px] font-bold tabular-nums ${
          tone === "blue" ? "text-blue-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {sub !== null ? (
        <p className="text-[11px] text-gray-500 tabular-nums">{sub}</p>
      ) : null}
    </div>
  );
}

function Chip({
  isActive,
  label,
  onPress,
}: {
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
        isActive
          ? "border-blue-500 bg-blue-50 font-semibold text-blue-600"
          : "border-gray-200 bg-white text-gray-500 hover:text-gray-700"
      }`}
      type="button"
      onClick={onPress}
    >
      {label}
    </button>
  );
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-large border border-danger-200 bg-danger-50 p-4">
      <p className="flex items-center gap-2 text-sm text-danger-700">
        <Icon icon="solar:danger-bold" width={18} />
        {error instanceof Error
          ? error.message
          : "No se pudo cargar la progresión"}
      </p>
      <button
        className="text-[12px] font-semibold text-danger-700 underline"
        type="button"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean | undefined;
  payload?: any[] | undefined;
  metric: MetricKey;
}) {
  const entry = payload?.[0]?.payload as ProgressionPoint | undefined;

  if (active !== true || entry === undefined) return null;

  return (
    <div className="rounded-medium border border-gray-200 bg-white px-3 py-2 text-[12px] shadow-md">
      <p className="font-semibold text-gray-900">
        {formatLongDate(entry.date)}
      </p>
      {metric === "e1rm" ? (
        <>
          <p className="text-blue-600 tabular-nums">
            1 RM est. {formatKg(entry.e1rm)}
          </p>
          <p className="text-gray-500 tabular-nums">
            Mejor serie: {entry.reps} × {formatKg(entry.weightKg)}
          </p>
        </>
      ) : (
        <p className="text-blue-600 tabular-nums">
          {formatVolume(entry.volumeKg)} kg·reps
        </p>
      )}
    </div>
  );
}

function ProgressionChart({
  series,
  metric,
}: {
  series: ProgressionPoint[];
  metric: MetricKey;
}) {
  const lastIndex = series.length - 1;
  const last = series[lastIndex];

  const data = useMemo(
    () =>
      series.map((point) => ({ ...point, tick: formatTickDate(point.date) })),
    [series]
  );

  if (series.length < 2 || last === undefined) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
        <Icon
          className="text-default-300"
          icon="solar:graph-up-linear"
          width={26}
        />
        <p className="text-sm text-gray-600">
          Sin registros suficientes para graficar
        </p>
      </div>
    );
  }

  const lastLabel =
    metric === "e1rm"
      ? formatKg(last.e1rm)
      : `${formatVolume(last.volumeKg)} kg·reps`;

  // Punto + valor SOLO en el último dato: la línea ya cuenta la forma, y la
  // pregunta que se hace el entrenador al abrir es "¿en cuánto va hoy?".
  const renderDot = (props: any): React.ReactElement => {
    const { cx, cy, index } = props;

    if (
      index !== lastIndex ||
      typeof cx !== "number" ||
      typeof cy !== "number"
    ) {
      return <g key={`dot-${String(index)}`} />;
    }

    return (
      <g key={`dot-${String(index)}`}>
        <circle
          cx={cx}
          cy={cy}
          fill={BLUE}
          r={4.5}
          stroke="#fff"
          strokeWidth={2}
        />
        <text
          fill={BLUE}
          fontSize={11}
          fontWeight={700}
          textAnchor="end"
          x={cx + 2}
          y={cy - 11}
        >
          {lastLabel}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer height={260} width="100%">
      <AreaChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="progresoFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.06} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f3f4f6" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="tick"
          minTickGap={28}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickFormatter={(value: number) =>
            metric === "e1rm"
              ? `${Math.round(value)}`
              : formatVolume(Number(value))
          }
          tickLine={false}
          width={metric === "e1rm" ? 42 : 58}
        />
        <Tooltip content={<ChartTooltip metric={metric} />} />
        <Area
          activeDot={{ r: 5, fill: BLUE, stroke: "#fff", strokeWidth: 2 }}
          dataKey={metric}
          dot={renderDot}
          fill="url(#progresoFill)"
          stroke={BLUE}
          strokeWidth={2.5}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Sección ────────────────────────────────────────────────────────────────

export function ProgresoSection({ clientId }: { clientId: string }) {
  const {
    exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
    refetch: refetchExercises,
  } = useLoggedExercises(clientId);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  // El texto del combobox es NUESTRO (controlado): dejar que React Aria lo
  // sincronice desde `selectedKey` con `items` controlados hace bucle infinito
  // ("Maximum update depth exceeded"). `search` es aparte para que, tras elegir
  // un ejercicio, el desplegable siga mostrando la lista completa.
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("1a");
  const [metric, setMetric] = useState<MetricKey>("e1rm");
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);

  const range = RANGES.find((entry) => entry.key === rangeKey) ?? RANGES[1];

  const { progression, isLoading, error, refetch } = useProgression(
    clientId,
    exerciseId,
    range.days
  );

  useEffect(() => {
    setToolbarEl(document.getElementById("training-progreso-toolbar"));
  }, []);

  // Primer ejercicio (el de más registros) preseleccionado: abrir en vacío
  // obligaría a un clic para ver cualquier cosa.
  useEffect(() => {
    if (exerciseId !== null) return;
    const first = exercises[0];

    if (first === undefined) return;
    setExerciseId(first.id);
    setInputValue(first.name);
  }, [exercises, exerciseId]);

  const selected = exercises.find((entry) => entry.id === exerciseId) ?? null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (term === "") return exercises;

    return exercises.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [exercises, search]);

  const series = progression?.e1rmSeries ?? [];
  const repMaxes = progression?.repMaxes ?? [];
  const trend = useMemo(() => computeTrend(series), [series]);
  const best = useMemo(() => bestRepMax(repMaxes), [repMaxes]);

  const picker = (
    <Autocomplete
      aria-label="Ejercicio"
      className="w-[240px]"
      inputProps={{ classNames: { inputWrapper: "h-9 min-h-9" } }}
      inputValue={inputValue}
      isLoading={exercisesLoading}
      items={filtered}
      placeholder="Buscar ejercicio..."
      selectedKey={exerciseId}
      size="sm"
      startContent={
        <Icon
          className="text-gray-400"
          icon="solar:dumbbell-linear"
          width={16}
        />
      }
      onInputChange={(value) => {
        setInputValue(value);
        // React Aria puede reponer el nombre del seleccionado al salir del
        // campo; eso no es una búsqueda, así que no debe filtrar la lista.
        setSearch(value === selected?.name ? "" : value);
      }}
      onSelectionChange={(key) => {
        if (key === null) return;
        const id = String(key);

        setExerciseId(id);
        setInputValue(exercises.find((entry) => entry.id === id)?.name ?? "");
        setSearch("");
      }}
    >
      {(exercise) => (
        <AutocompleteItem key={exercise.id} textValue={exercise.name}>
          <span className="text-[13px]">{exercise.name}</span>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );

  if (exercisesLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[86px] w-full rounded-large" />
        <Skeleton className="h-[340px] w-full rounded-large" />
      </div>
    );
  }

  if (exercisesError != null) {
    return <ErrorCard error={exercisesError} onRetry={refetchExercises} />;
  }

  if (exercises.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
        <Icon
          className="text-default-300"
          icon="solar:graph-up-linear"
          width={26}
        />
        <p className="text-sm text-gray-600">
          Todavía no hay registros de fuerza para este cliente
        </p>
        <p className="text-[12px] text-gray-400">
          El progreso aparece en cuanto el cliente cierre su primera sesión.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toolbarEl !== null ? createPortal(picker, toolbarEl) : null}
      {toolbarEl === null ? <div className="flex">{picker}</div> : null}

      {error != null ? (
        <ErrorCard error={error} onRetry={refetch} />
      ) : /* exerciseId null = el efecto de autoselección aún no corrió; sin
             este guardia se pintaría un frame con la franja de stats vacía. */
      isLoading || exerciseId === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[86px] w-full rounded-large" />
          <Skeleton className="h-[340px] w-full rounded-large" />
          <Skeleton className="h-[200px] w-full rounded-large" />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-large border border-gray-200">
            <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-3">
              <StatCell
                label="1 RM estimado"
                sub={
                  trend === null
                    ? null
                    : `${trend.deltaKg >= 0 ? "↑ +" : "↓ "}${formatKg(
                        Math.abs(trend.deltaKg)
                      )} ${trend.spanLabel}`
                }
                tone="blue"
                value={
                  progression?.currentE1rm != null
                    ? formatKg(progression.currentE1rm)
                    : "—"
                }
              />
              {/* "Mejor 1 RM relativo" y no "mejor serie" (llamada 29 Jul):
                  es el nivel de fuerza relativo más alto alcanzado. */}
              <StatCell
                label="Mejor 1 RM relativo"
                sub={best !== null ? formatLongDate(best.date) : null}
                tone="neutral"
                value={
                  best !== null
                    ? `${best.reps} × ${formatKg(best.weightKg)}`
                    : "—"
                }
              />
              <StatCell
                label="Sesiones con datos"
                sub={range.caption}
                tone="neutral"
                value={String(progression?.totalSessions ?? 0)}
              />
            </div>
          </div>

          <section className="overflow-hidden rounded-large border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900">
                  Progresión
                </p>
                <p className="text-[11px] text-gray-400">
                  1 RM est. = mejor serie de cada sesión (Epley ≥7 · Brzycki 2–6
                  · 1 rep = peso)
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
                  {METRICS.map((entry) => (
                    <button
                      key={entry.key}
                      className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                        metric === entry.key
                          ? "bg-white font-semibold text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      type="button"
                      onClick={() => setMetric(entry.key)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {RANGES.map((entry) => (
                    <Chip
                      key={entry.key}
                      isActive={rangeKey === entry.key}
                      label={entry.label}
                      onPress={() => setRangeKey(entry.key)}
                    />
                  ))}
                </div>
              </div>
            </header>

            <div className="px-2 py-3">
              <ProgressionChart metric={metric} series={series} />
            </div>
          </section>

          <section className="overflow-hidden rounded-large border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 px-4 py-3">
              <p className="text-[13px] font-bold text-gray-900">
                Récords por repeticiones
              </p>
              <p className="text-[11px] text-gray-400">
                Mejor peso levantado para cada nº de reps — todo derivado de los
                registros
              </p>
            </header>

            {repMaxes.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-gray-400">
                Sin récords en este período
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Reps
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Peso
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        1 RM est.
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {repMaxes.map((record) => {
                      const isBest =
                        best !== null && record.bucket === best.bucket;

                      return (
                        <tr
                          key={record.bucket}
                          className={`border-b border-gray-100 last:border-b-0 ${
                            isBest ? "bg-amber-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-2 text-gray-600 tabular-nums">
                            {isBest ? (
                              <span aria-hidden="true" className="mr-1">
                                🏅
                              </span>
                            ) : null}
                            {repsLabel(record.bucket)}
                          </td>
                          <td className="px-4 py-2 font-bold text-gray-900 tabular-nums">
                            {formatKg(record.weightKg)}
                          </td>
                          <td className="px-4 py-2 text-gray-600 tabular-nums">
                            {formatKg(record.e1rm)}
                          </td>
                          <td className="px-4 py-2 text-gray-500 tabular-nums">
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {formatLongDate(record.date)}
                              {isRecent(record.date, RECENT_PR_DAYS) ? (
                                <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  PR reciente
                                </span>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
