// Sección NUEVA: PR (mejor marca histórica) + últimas 3 sesiones del
// cliente para este ejercicio. Decisiones (g) y (h) del §1 de
// bloque-1-spec.md.
//
// Comportamiento:
// - Si no hay logs previos del ejercicio (recent vacío AND pr null),
//   se oculta TODA la sección — no mostramos "Sin historial todavía".
// - Loading: skeleton compacto.
// - Error: ignorado en silencio (no rompe el flujo de log).
//
// Rediseño (Fase 5.5 / Trabajo 2):
// - Date como chip pequeño en la fila.
// - Sets como pills agrupadas por peso.
// - Indicador de tendencia (↑ verde, ↓ naranja) vs sesión anterior.
// - Borde izquierdo coloreado en cada fila siguiendo el mismo lenguaje.

import type { ExerciseHistoryEntry } from "@/types/training";

import { Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useExerciseHistory } from "./hooks/use-exercise-history";

interface Props {
  exerciseId: string | null;
  isOpen: boolean;
}

export function ExerciseHistorySection({ exerciseId, isOpen }: Props) {
  const { data, isLoading } = useExerciseHistory(exerciseId, {
    limit: 3,
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

  return (
    <div className="space-y-3">
      {data.pr ? <PrBanner pr={data.pr} /> : null}
      {data.recent.length > 0 ? <RecentList recent={data.recent} /> : null}
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
    <div className="flex items-center gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
      <div className="bg-warning-200/60 p-2 rounded-md">
        <Icon
          className="text-warning-700"
          icon="solar:medal-star-bold"
          width={20}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase font-semibold text-warning-700 font-body">
          Tu mejor marca
        </p>
        <p className="text-sm font-semibold text-warning-900 font-heading">
          {pr.weight_kg} kg{reps}
          {ago ? (
            <span className="ml-1 text-warning-700 font-normal">({ago})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function RecentList({ recent }: { recent: ExerciseHistoryEntry[] }) {
  return (
    <div className="rounded-lg border border-default-200 bg-content1 overflow-hidden">
      <p className="px-3 py-2 text-[11px] uppercase font-semibold text-default-500 border-b border-default-100 font-body">
        Últimas sesiones
      </p>
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
    </div>
  );
}

type Trend = "improved" | "regressed" | "same" | "unknown";

interface HistoryRowProps {
  entry: ExerciseHistoryEntry;
  trend: Trend;
}

function HistoryRow({ entry, trend }: HistoryRowProps) {
  const groups = groupSetsByWeight(entry);

  return (
    <li
      className={`relative px-3 py-2.5 pl-4 ${trendBorderClass(trend)}`}
      style={{ borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Chip
          classNames={{
            base: "h-5 px-1.5",
            content: "text-[10px] font-medium",
          }}
          size="sm"
          variant="flat"
        >
          {formatShortDate(entry.scheduled_date)}
        </Chip>
        <TrendBadge trend={trend} />
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-default-500 font-body">Sin sets</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g, i) => (
            <SetPill key={`${entry.exercise_log_id}-${i}`} group={g} />
          ))}
        </div>
      )}
    </li>
  );
}

interface SetGroup {
  weight: number | null;
  reps: number[];
}

function groupSetsByWeight(entry: ExerciseHistoryEntry): SetGroup[] {
  if (entry.sets.length === 0) return [];
  const groups: SetGroup[] = [];
  let current: SetGroup | null = null;

  for (const s of entry.sets) {
    if (current && current.weight === s.weight_kg) {
      current.reps.push(s.reps);
    } else {
      current = { weight: s.weight_kg, reps: [s.reps] };
      groups.push(current);
    }
  }

  return groups;
}

function SetPill({ group }: { group: SetGroup }) {
  const weightLabel =
    group.weight != null ? `${group.weight} kg` : "Peso libre";
  const repsLabel = group.reps.join(", ");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-default-100 px-2 py-1 text-xs font-medium text-foreground">
      <span className="font-semibold">{weightLabel}</span>
      <span className="text-default-400">·</span>
      <span className="text-default-700">{repsLabel}</span>
    </span>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "improved") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-success-700">
        <Icon icon="solar:arrow-up-bold" width={12} />
        Mejora
      </span>
    );
  }
  if (trend === "regressed") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning-700">
        <Icon icon="solar:arrow-down-bold" width={12} />
        Bajó
      </span>
    );
  }
  if (trend === "same") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-default-500">
        <Icon icon="solar:minus-circle-linear" width={12} />
        Igual
      </span>
    );
  }

  return null;
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
