// Sección NUEVA: PR (mejor marca histórica) + últimas 3 sesiones del
// cliente para este ejercicio. Decisiones (g) y (h) del §1 de
// bloque-1-spec.md.
//
// Comportamiento:
// - Si no hay logs previos del ejercicio (recent vacío AND pr null),
//   se oculta TODA la sección — no mostramos "Sin historial todavía".
// - Loading: skeleton compacto.
// - Error: ignorado en silencio (no rompe el flujo de log).

import type { ExerciseHistoryEntry } from "@/types/training";

import { Skeleton } from "@heroui/react";
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

  // Sin historial → ocultar TODA la sección.
  const hasAny = (data?.recent?.length ?? 0) > 0 || data?.pr != null;

  if (!data || !hasAny) return null;

  return (
    <div className="space-y-3">
      {data.pr ? <PrBanner pr={data.pr} /> : null}
      {data.recent.length > 0 ? <RecentTable recent={data.recent} /> : null}
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
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="bg-amber-200/60 p-2 rounded-md">
        <Icon
          className="text-amber-700"
          icon="solar:medal-star-bold"
          width={20}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase font-semibold text-amber-700 font-body">
          Tu mejor marca
        </p>
        <p className="text-sm font-semibold text-amber-900 font-heading">
          {pr.weight_kg} kg{reps}
          {ago ? (
            <span className="ml-1 text-amber-700 font-normal">({ago})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function RecentTable({ recent }: { recent: ExerciseHistoryEntry[] }) {
  return (
    <div className="rounded-lg border border-default-200 bg-content1 overflow-hidden">
      <p className="px-3 py-2 text-[11px] uppercase font-semibold text-foreground/60 border-b border-default-100 font-body">
        Últimas sesiones
      </p>
      <ul className="divide-y divide-default-100">
        {recent.map((entry) => (
          <li
            key={entry.exercise_log_id}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <span className="text-xs text-foreground/60 font-body shrink-0">
              {formatShortDate(entry.scheduled_date)}
            </span>
            <span className="text-sm text-foreground font-body text-right">
              {summarizeSets(entry)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Resume los sets del log en una línea compacta. Si todos los sets
// tienen el mismo peso, lo muestra una vez ("80kg × 10, 8, 8").
// Si los pesos varían, muestra cada par "peso×reps" separado por coma.
function summarizeSets(entry: ExerciseHistoryEntry): string {
  if (entry.sets.length === 0) return "Sin sets";

  const weights = new Set(
    entry.sets.map((s) => (s.weight_kg != null ? String(s.weight_kg) : "—"))
  );

  if (weights.size === 1) {
    const w = entry.sets[0]?.weight_kg;
    const repsList = entry.sets.map((s) => s.reps).join(", ");

    return w != null ? `${w}kg × ${repsList}` : `× ${repsList}`;
  }

  return entry.sets
    .map((s) =>
      s.weight_kg != null ? `${s.weight_kg}kg×${s.reps}` : `${s.reps}r`
    )
    .join(", ");
}

function formatShortDate(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return isoYmd;
  }
}

// Hace "hace N días/semanas" — solo aproximación, suficiente para el
// PR banner. Si la fecha es inválida, devuelve "".
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
