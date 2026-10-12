// PR (mejor marca histórica) + últimas sesiones del cliente para este
// ejercicio. Por defecto mostramos 10 sesiones; "Ver más" amplía a 30.
//
// Diseño (vive dentro de la card plegable "Tu historial y récords"):
// - PR como bloque en tinte warning (logro) con estrella.
// - Mini-tabla Fecha | Mejor | Series | Tend.; cada fila se despliega con
//   las series, el comentario del coach (vídeo) y la nota del cliente.
//
// Comportamiento: si no hay PR ni recent, la sección entera no se
// renderiza (no mostramos "sin historial").

import type { ExerciseHistoryEntry } from "@/types/training";

import { Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { formatKg } from "./helpers";
import { useExerciseHistory } from "./hooks/use-exercise-history";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
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
  const { trainerName } = useClientData();
  const [story, setStory] = useState<StoryItem | null>(null);
  const limit = expanded ? EXPANDED_LIMIT : INITIAL_LIMIT;
  const { data, isLoading } = useExerciseHistory(exerciseId, {
    limit,
    enabled: isOpen,
  });

  if (!exerciseId || !isOpen) return null;

  if (isLoading) {
    return (
      <div className="space-y-2 pt-1">
        <Skeleton className="h-16 w-full rounded-[14px]" />
        <Skeleton className="h-32 w-full rounded-[14px]" />
      </div>
    );
  }

  const hasAny = (data?.recent?.length ?? 0) > 0 || data?.pr != null;

  if (!data || !hasAny) return null;

  // Heurística para mostrar "Ver más": si recibimos exactamente el
  // límite no expandido, asumimos que probablemente hay más en BD.
  const canExpand = !expanded && data.recent.length >= INITIAL_LIMIT;

  return (
    <div className="flex flex-col">
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
        coachName={trainerName}
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
    <div className="flex items-center gap-3 rounded-[14px] bg-warning/10 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-600">
        <Icon aria-hidden icon="solar:star-bold" width={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-default-500">Tu mejor marca</p>
        <p className="font-heading text-xl tabular-nums text-foreground">
          {formatKg(pr.weight_kg)} kg{reps}
        </p>
      </div>
      {ago ? (
        <span className="shrink-0 text-[13px] text-default-500">{ago}</span>
      ) : null}
    </div>
  );
}

const ROW_GRID =
  "grid w-full grid-cols-[1.25fr_1.4fr_0.8fr_44px_20px] items-center gap-1.5";

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
    <div>
      <h4 className="mb-2 mt-5 text-sm font-semibold text-default-500">
        Últimas sesiones
      </h4>
      <div>
        <div
          aria-hidden
          className={`${ROW_GRID} min-h-7 text-xs font-semibold text-default-500`}
        >
          <span>Fecha</span>
          <span>Mejor</span>
          <span>Series</span>
          <span>Tend.</span>
          <span />
        </div>

        <ul>
          {recent.map((entry, idx) => {
            const previous = recent[idx + 1];
            const trend = previous
              ? compareEntries(entry, previous)
              : "unknown";

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
      </div>
      {canExpand ? (
        <button
          className="min-h-9 py-1.5 text-[15px] font-semibold text-primary active:opacity-60"
          type="button"
          onClick={onExpand}
        >
          Ver más
        </button>
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
    ? `${best.weight > 0 ? `${formatKg(best.weight)} kg` : "—"} × ${best.reps}`
    : "—";
  const hasCoachFeedback = entry.sets.some(
    (s) => (s.coach_comment ?? "") !== ""
  );

  return (
    <li className="shadow-[inset_0_1px_0_hsl(var(--heroui-default-200))]">
      <button
        aria-expanded={expanded}
        className={`${ROW_GRID} min-h-11 text-left text-sm [@media(hover:hover)]:hover:bg-default-100`}
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-foreground">
          {formatShortDate(entry.scheduled_date)}
        </span>
        <span className="flex min-w-0 items-center gap-1 font-semibold tabular-nums text-foreground">
          <span className="truncate">{bestLabel}</span>
          {entry.notes != null ? (
            <Icon
              aria-label="Tiene comentario"
              className="shrink-0 text-default-400"
              icon="solar:chat-round-line-linear"
              width={13}
            />
          ) : null}
          {hasCoachFeedback ? (
            <Icon
              aria-label="Tu coach comentó tu video"
              className="shrink-0 text-primary"
              icon="solar:videocamera-record-linear"
              width={13}
            />
          ) : null}
        </span>
        <span className="tabular-nums text-foreground">
          {entry.sets.length}
        </span>
        <TrendIcon trend={trend} />
        <Icon
          aria-hidden
          className={`text-default-400 transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          icon="solar:alt-arrow-down-linear"
          width={18}
        />
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2.5 pb-3.5 pt-0.5">
          {entry.sets.length === 0 ? (
            <p className="text-[13px] text-default-500">Sin sets</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {entry.sets.map((set) => (
                <li
                  key={`${entry.exercise_log_id}-${set.set_number}`}
                  className="rounded-lg bg-default-100 px-2 py-1 text-[13px] tabular-nums text-foreground"
                >
                  S{set.set_number}{" "}
                  {set.weight_kg != null
                    ? `${formatKg(set.weight_kg)} kg × `
                    : ""}
                  {set.reps}
                </li>
              ))}
            </ul>
          )}
          {entry.sets
            .filter((set) => (set.coach_comment ?? "") !== "")
            .map((set) => (
              <CoachComment
                key={`${entry.exercise_log_id}-c${set.set_number}`}
                comment={set.coach_comment ?? ""}
                setLabel={
                  entry.sets.length > 1 ? `Serie ${set.set_number}` : null
                }
                videoUrl={set.video_url ?? ""}
                onOpen={() =>
                  onOpenStory({
                    videoUrl: set.video_url ?? "",
                    exerciseName,
                    scheduledDate: entry.scheduled_date,
                    setLabel: buildSetLabel(set),
                    comment: set.coach_comment ?? "",
                  })
                }
              />
            ))}
          {entry.notes != null ? (
            <p className="flex gap-2 text-[13px] leading-snug text-default-500">
              <Icon
                aria-hidden
                className="mt-px shrink-0"
                icon="solar:notes-linear"
                width={16}
              />
              <span className="whitespace-pre-line">{entry.notes}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// Tendencia vs la sesión anterior: círculo tintado con flecha.
function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "unknown") return <span />;
  const style = {
    improved: {
      label: "Mejora",
      icon: "solar:arrow-up-linear",
      className: "bg-success/15 text-success-700",
    },
    regressed: {
      label: "Bajó",
      icon: "solar:arrow-down-linear",
      className: "bg-warning/15 text-warning-700",
    },
    same: {
      label: "Igual",
      icon: "solar:minus-linear",
      className: "bg-default-100 text-default-500",
    },
  }[trend];

  return (
    <span
      aria-label={style.label}
      className={`flex h-[26px] w-[26px] items-center justify-center rounded-full ${style.className}`}
      role="img"
    >
      <Icon aria-hidden icon={style.icon} width={15} />
    </span>
  );
}

// Comentario del coach sobre una serie. Con video el botón de play reabre
// la story (video + comentario superpuesto).
function CoachComment({
  comment,
  setLabel,
  videoUrl,
  onOpen,
}: {
  comment: string;
  setLabel: string | null;
  videoUrl: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] bg-primary/10 p-3">
      {videoUrl ? (
        <button
          aria-label="Ver comentario en vídeo del coach"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-[0.97] motion-reduce:transform-none"
          type="button"
          onClick={onOpen}
        >
          <Icon
            aria-hidden
            className="ml-0.5"
            icon="solar:play-bold"
            width={18}
          />
        </button>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Comentario del coach{setLabel ? ` · ${setLabel}` : ""}
        </span>
        <span className="mt-0.5 block whitespace-pre-line text-[13px] leading-snug text-foreground/80">
          {comment}
        </span>
      </span>
    </div>
  );
}

function buildSetLabel(set: ExerciseHistoryEntry["sets"][number]): string {
  const weight =
    set.weight_kg != null && set.weight_kg > 0
      ? ` × ${formatKg(set.weight_kg)} kg`
      : "";

  return `Serie ${set.set_number} · ${set.reps} reps${weight}`;
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
