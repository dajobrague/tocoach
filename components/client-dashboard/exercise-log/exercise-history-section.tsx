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

import { formatKg } from "./helpers";
import { useExerciseHistory } from "./hooks/use-exercise-history";

import {
  VideoFeedbackStoryViewer,
  type StoryItem,
} from "@/components/client-dashboard/video-feedback/video-feedback-story-viewer";

interface Props {
  exerciseId: string | null;
  isOpen: boolean;
  /** Nombre del ejercicio; sólo se usa en la cabecera del visor de video. */
  exerciseName?: string;
}

const INITIAL_LIMIT = 10;
const EXPANDED_LIMIT = 30;

export function ExerciseHistorySection({
  exerciseId,
  isOpen,
  exerciseName,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [story, setStory] = useState<StoryItem | null>(null);
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
          exerciseName={exerciseName ?? "Tu ejercicio"}
          recent={data.recent}
          onExpand={() => setExpanded(true)}
          onOpenStory={setStory}
        />
      ) : null}

      <VideoFeedbackStoryViewer
        initialIndex={0}
        isOpen={story !== null}
        items={story ? [story] : []}
        onClose={() => setStory(null)}
      />
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
          {formatKg(pr.weight_kg)} kg{reps}
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
  exerciseName,
  onExpand,
  onOpenStory,
}: {
  recent: ExerciseHistoryEntry[];
  canExpand: boolean;
  exerciseName: string;
  onExpand: () => void;
  onOpenStory: (item: StoryItem) => void;
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
              exerciseName={exerciseName}
              trend={trend}
              onOpenStory={onOpenStory}
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
  exerciseName: string;
  onOpenStory: (item: StoryItem) => void;
}

function HistoryRow({
  entry,
  trend,
  exerciseName,
  onOpenStory,
}: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const best = bestSet(entry);
  const bestLabel = best
    ? `${best.weight > 0 ? `${formatKg(best.weight)}kg` : "—"} × ${best.reps}`
    : "—";
  const hasCoachFeedback = entry.sets.some(
    (s) => (s.coach_comment ?? "") !== ""
  );

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
          {entry.notes != null ? (
            <Icon
              aria-label="Tiene comentario"
              className="ml-1.5 inline-block align-[-2px] text-foreground/40"
              icon="solar:chat-round-line-linear"
              width={12}
            />
          ) : null}
          {hasCoachFeedback ? (
            <Icon
              aria-label="Tu coach comentó tu video"
              className="ml-1.5 inline-block align-[-2px] text-emerald-600"
              icon="solar:videocamera-record-broken"
              width={12}
            />
          ) : null}
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
                  exerciseName={exerciseName}
                  scheduledDate={entry.scheduled_date}
                  set={s}
                  onOpenStory={onOpenStory}
                />
              ))}
            </ul>
          )}
          {entry.notes != null ? (
            <p className="mt-2 flex items-start gap-1.5 border-t border-default-100 pt-2 text-xs font-body text-foreground/70">
              <Icon
                className="mt-0.5 shrink-0 text-foreground/40"
                icon="solar:chat-round-line-linear"
                width={13}
              />
              <span className="whitespace-pre-line">{entry.notes}</span>
            </p>
          ) : null}
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

function SetLine({
  set,
  exerciseName,
  scheduledDate,
  onOpenStory,
}: {
  set: ExerciseHistoryEntry["sets"][number];
  exerciseName: string;
  scheduledDate: string;
  onOpenStory: (item: StoryItem) => void;
}) {
  const weightLabel =
    set.weight_kg != null ? `${formatKg(set.weight_kg)} kg` : "—";
  const comment = set.coach_comment ?? "";
  const videoUrl = set.video_url ?? "";

  return (
    <li className="text-xs font-body">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-5 shrink-0 rounded bg-default-100 text-[10px] font-semibold text-foreground/70">
          S{set.set_number}
        </span>
        <span className="text-foreground">
          <span className="font-semibold">{weightLabel}</span>
          <span className="text-default-400"> × </span>
          <span>{set.reps} reps</span>
        </span>
      </div>

      {comment ? (
        <CoachComment
          comment={comment}
          videoUrl={videoUrl}
          onOpen={() =>
            onOpenStory({
              videoUrl,
              exerciseName,
              scheduledDate,
              setLabel: buildSetLabel(set),
              comment,
            })
          }
        />
      ) : null}
    </li>
  );
}

// Cita del comentario del coach bajo la serie. Con video se vuelve un
// botón que reabre la story (video + comentario superpuesto).
function CoachComment({
  comment,
  videoUrl,
  onOpen,
}: {
  comment: string;
  videoUrl: string;
  onOpen: () => void;
}) {
  const body = (
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-600">
        Comentario del coach
      </span>
      <span className="block whitespace-pre-line text-foreground/70">
        {comment}
      </span>
    </span>
  );

  if (!videoUrl) {
    return (
      <div className="mt-1 ml-9 border-l-2 border-emerald-500 pl-2 text-xs">
        {body}
      </div>
    );
  }

  return (
    <button
      className="mt-1 ml-9 flex w-full items-start gap-1.5 border-l-2 border-emerald-500 pl-2 text-left text-xs"
      type="button"
      onClick={onOpen}
    >
      <Icon
        aria-label="Ver video con el comentario"
        className="mt-0.5 shrink-0 text-emerald-600"
        icon="solar:play-circle-bold"
        width={14}
      />
      {body}
    </button>
  );
}

function buildSetLabel(set: ExerciseHistoryEntry["sets"][number]): string {
  const weight =
    set.weight_kg != null && set.weight_kg > 0
      ? ` × ${formatKg(set.weight_kg)} kg`
      : "";

  return `Serie ${set.set_number} · ${set.reps} reps${weight}`;
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
