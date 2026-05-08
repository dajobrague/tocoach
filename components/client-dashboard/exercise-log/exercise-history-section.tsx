// PR (mejor marca histórica) + últimas sesiones del cliente para este
// ejercicio. Por defecto mostramos 10 sesiones; "Ver más" amplía a 30.
//
// Diseño:
// - PR como card neutra con medalla amber (ya no usa la paleta warning
//   del theme — esa pelea visualmente con el primario del trainer).
// - Cada fila: chip de fecha + pills de peso × reps agrupadas por peso
//   + indicador de tendencia vs sesión anterior + borde izquierdo por
//   tendencia.
//
// Comportamiento: si no hay PR ni recent, la sección entera no se
// renderiza (no mostramos "sin historial").

import type { ExerciseHistoryEntry } from "@/types/training";

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useExerciseHistory } from "./hooks/use-exercise-history";

interface Props {
  exerciseId: string | null;
  isOpen: boolean;
}

const INITIAL_LIMIT = 10;
const EXPANDED_LIMIT = 30;

export function ExerciseHistorySection({ exerciseId, isOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? EXPANDED_LIMIT : INITIAL_LIMIT;
  const { data, isLoading } = useExerciseHistory(exerciseId, {
    limit,
    enabled: isOpen,
  });

  if (!exerciseId || !isOpen) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  const hasAny = (data?.recent?.length ?? 0) > 0 || data?.pr != null;

  if (!data || !hasAny) return null;

  // Heurística para mostrar "Ver más": si recibimos exactamente el
  // límite no expandido, asumimos que probablemente hay más en BD.
  const canExpand = !expanded && data.recent.length >= INITIAL_LIMIT;

  return (
    <div className="space-y-3">
      {data.pr ? <PrBanner pr={data.pr} /> : null}
      {data.recent.length > 0 ? (
        <RecentList
          canExpand={canExpand}
          recent={data.recent}
          onExpand={() => setExpanded(true)}
        />
      ) : null}
    </div>
  );
}

function PrBanner({
  pr,
}: {
  pr: NonNullable<ReturnType<typeof useExerciseHistory>["data"]>["pr"];
}) {
  if (!pr) return null;
  const reps = pr.reps > 0 ? ` × ${pr.reps}` : "";
  const ago = pr.achieved_at ? formatRelative(pr.achieved_at) : "";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content1 px-4 py-3">
      <div className="bg-amber-100 p-2 rounded-md">
        <Icon
          className="text-amber-600"
          icon="solar:medal-star-bold"
          width={20}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase font-semibold text-foreground/50 font-body">
          Tu mejor marca
        </p>
        <p className="text-sm font-semibold text-foreground font-heading">
          {pr.weight_kg} kg{reps}
          {ago ? (
            <span className="ml-1 text-foreground/50 font-normal">({ago})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function RecentList({
  recent,
  canExpand,
  onExpand,
}: {
  recent: ExerciseHistoryEntry[];
  canExpand: boolean;
  onExpand: () => void;
}) {
  return (
    <div className="rounded-lg border border-default-200 bg-content1 overflow-hidden">
      <p className="px-3 py-2 text-[11px] uppercase font-semibold text-default-500 border-b border-default-100 font-body">
        Últimas sesiones
      </p>

      {/* Header de la mini-tabla. Mismas anchos que las filas para que
          alineen sin gap shifts. */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-body uppercase tracking-wide text-foreground/50 border-b border-default-100">
        <span className="w-14 shrink-0">Fecha</span>
        <span className="flex-1">Mejor</span>
        <span className="w-10 shrink-0 text-center">Series</span>
        <span className="w-8 shrink-0 text-center">Tend.</span>
        <span className="w-4 shrink-0" />
      </div>

      <ul className="divide-y divide-default-100">
        {recent.map((entry, idx) => {
          const previous = recent[idx + 1];
          const trend = previous ? compareEntries(entry, previous) : "unknown";

          return (
            <HistoryRow
              key={entry.exercise_log_id}
              entry={entry}
              trend={trend}
            />
          );
        })}
      </ul>
      {canExpand ? (
        <div className="border-t border-default-100">
          <Button
            className="w-full"
            size="sm"
            variant="light"
            onPress={onExpand}
          >
            Ver más
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type Trend = "improved" | "regressed" | "same" | "unknown";

interface HistoryRowProps {
  entry: ExerciseHistoryEntry;
  trend: Trend;
}

function HistoryRow({ entry, trend }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const best = bestSet(entry);
  const bestLabel = best
    ? `${best.weight > 0 ? `${best.weight}kg` : "—"} × ${best.reps}`
    : "—";

  return (
    <li
      className={`relative ${trendBorderClass(trend)}`}
      style={{ borderLeftWidth: 3 }}
    >
      <button
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-default-50 transition-colors"
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="w-14 shrink-0 text-[11px] font-body text-foreground/70">
          {formatShortDate(entry.scheduled_date)}
        </span>
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          {bestLabel}
        </span>
        <span className="w-10 shrink-0 text-xs text-center font-body text-foreground/70">
          {entry.sets.length}
        </span>
        <span className="w-8 shrink-0 flex justify-center">
          <TrendIcon trend={trend} />
        </span>
        <span className="w-4 shrink-0 flex justify-center text-foreground/40">
          <Icon
            icon={
              expanded
                ? "solar:alt-arrow-up-linear"
                : "solar:alt-arrow-down-linear"
            }
            width={14}
          />
        </span>
      </button>

      {expanded ? (
        <div className="bg-default-50/60 border-t border-default-100 px-3 py-2">
          {entry.sets.length === 0 ? (
            <p className="text-xs text-default-500 font-body">Sin sets</p>
          ) : (
            <ul className="space-y-1">
              {entry.sets.map((s) => (
                <SetLine
                  key={`${entry.exercise_log_id}-${s.set_number}`}
                  set={s}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

// Solo el icono (sin texto) para que entre en la columna de 32px de la
// mini-tabla. Para fila colapsada / vista densa.
function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "improved") {
    return (
      <Icon
        aria-label="Mejora"
        className="text-success-700"
        icon="solar:arrow-up-bold"
        width={14}
      />
    );
  }
  if (trend === "regressed") {
    return (
      <Icon
        aria-label="Bajó"
        className="text-warning-700"
        icon="solar:arrow-down-bold"
        width={14}
      />
    );
  }
  if (trend === "same") {
    return (
      <Icon
        aria-label="Igual"
        className="text-default-400"
        icon="solar:minus-circle-linear"
        width={14}
      />
    );
  }

  return null;
}

function SetLine({ set }: { set: ExerciseHistoryEntry["sets"][number] }) {
  const weightLabel = set.weight_kg != null ? `${set.weight_kg} kg` : "—";

  return (
    <li className="flex items-center gap-2 text-xs font-body">
      <span className="inline-flex items-center justify-center w-7 h-5 shrink-0 rounded bg-default-100 text-[10px] font-semibold text-foreground/70">
        S{set.set_number}
      </span>
      <span className="text-foreground">
        <span className="font-semibold">{weightLabel}</span>
        <span className="text-default-400"> × </span>
        <span>{set.reps} reps</span>
      </span>
    </li>
  );
}

function trendBorderClass(trend: Trend): string {
  switch (trend) {
    case "improved":
      return "border-l-success";
    case "regressed":
      return "border-l-warning";
    case "same":
      return "border-l-default-300";
    default:
      return "border-l-transparent";
  }
}

// Calcula la "mejor" métrica de un log: peso máximo, desempate por reps
// al peso máximo. Compara contra el log anterior (cronológicamente).
function compareEntries(
  current: ExerciseHistoryEntry,
  previous: ExerciseHistoryEntry
): Trend {
  const cur = bestSet(current);
  const prev = bestSet(previous);

  if (cur == null || prev == null) return "unknown";
  if (cur.weight > prev.weight) return "improved";
  if (cur.weight < prev.weight) return "regressed";
  if (cur.reps > prev.reps) return "improved";
  if (cur.reps < prev.reps) return "regressed";

  return "same";
}

function bestSet(
  entry: ExerciseHistoryEntry
): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;

  for (const s of entry.sets) {
    const w = s.weight_kg ?? 0;

    if (!best || w > best.weight || (w === best.weight && s.reps > best.reps)) {
      best = { weight: w, reps: s.reps };
    }
  }

  return best;
}

function formatShortDate(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
    })
      .format(d)
      .replace(".", "");
  } catch {
    return isoYmd;
  }
}

function formatRelative(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);
    const diffMs = Date.now() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} días`;
    const weeks = Math.floor(days / 7);

    if (weeks === 1) return "hace 1 sem";
    if (weeks < 8) return `hace ${weeks} sem`;
    const months = Math.floor(days / 30);

    return months <= 1 ? "hace 1 mes" : `hace ${months} meses`;
  } catch {
    return "";
  }
}
