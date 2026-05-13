// Modo "sesión activa": ocupa la pantalla principal del cliente cuando
// éste tap "Comenzar" en una sesión. Las otras sesiones desaparecen y
// queda solo esta — banner destacado + progreso + lista de ejercicios.
//
// Persistencia: el activeSessionId vive en localStorage (ver
// hooks/use-persisted-active-training.ts), así que sobrevive a
// recargas y al cambio de pestañas del bottom-nav.

import type { WorkoutProgram } from "@/types/training";
import type { OpenLogPayload } from "./available-sessions-list";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import {
  useResolvedDayPrescription,
  type ResolvedExercise,
} from "./hooks/use-resolved-day-prescription";
import { getSessionTypeStyle } from "./session-type-style";

interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  exercise_id?: string;
  // Strength
  sets?: number;
  reps?: string;
  rest?: string;
  tempo?: string;
  trainingSystem?: string;
  /** Uniform prescribed weight in kg. Set when the trainer overrides the day. */
  weightKg?: number | null;
  /**
   * Per-set prescription (Phase 3.5 override). When present it overrides the
   * uniform sets/reps/weightKg combo: each entry is one prescribed set.
   */
  prescribedSets?: Array<{
    setNumber: number;
    reps: string | null;
    weightKg: number | null;
  }>;
  // Cardio
  duration?: number;
  distance?: number;
  intensity?: string;
  cardioType?: string;
  heartRateZone?: { min: number; max: number };
  // Video del trainer (referencia o subida custom)
  videoUrl?: string;
  uploadedVideoUrl?: string;
  // Categoría declarada por el trainer
  category?: string;
}

interface ExerciseLogLike {
  exercise_id?: string;
  scheduled_date?: string;
  // Cuándo el cliente tocó "Finalizado". null = log existe pero está
  // en progreso (autosave en curso). No-null = ejercicio terminado.
  finalized_at?: string | null;
}

type ExerciseStatus = "not_started" | "in_progress" | "completed";

interface Props {
  session: AvailableSession;
  programs: WorkoutProgram[];
  exerciseLogs: ExerciseLogLike[];
  scheduledDate: string;
  onExit: () => void;
  onLogExercise: (payload: OpenLogPayload) => void;
}

export function ActiveSessionView({
  session,
  programs,
  exerciseLogs,
  scheduledDate,
  onExit,
  onLogExercise,
}: Props) {
  const { data: resolved, loading: resolvedLoading } =
    useResolvedDayPrescription(scheduledDate);

  const exercises: Array<ExerciseLike & Record<string, unknown>> =
    useMemo(() => {
      // Use the resolved prescription only when it describes the SAME
      // session the client actually picked. resolved is keyed by date,
      // not session: it always returns whatever scheduled_sessions /
      // microcycle template points at for that date — which can be a
      // different session than the one the client tapped to start.
      // Without the session.id guard, the screen rendered the
      // recommended session's exercises under the picked session's
      // banner, and exercise_logs were saved with mismatched
      // (session_id, exercise_id) pairs.
      //
      // When the ids match, resolved is authoritative because it carries
      // any trainer overrides (sets/reps/weight, per-set values, cardio
      // and coaching meta). When they don't, fall back to the program
      // template for the picked session — that template is the truth
      // for sessions the trainer didn't override for this date.
      if (
        resolved &&
        resolved.exercises.length > 0 &&
        resolved.session?.id === session.id
      ) {
        return resolved.exercises.map(toExerciseLike) as Array<
          ExerciseLike & Record<string, unknown>
        >;
      }

      return findExercisesForSession(programs, session.id);
    }, [resolved, programs, session.id]);

  const trackable = exercises.filter(
    (e) => typeof e.exercise_id === "string" && e.exercise_id.length > 0
  );

  // Solo cuenta como "hecho" un ejercicio FINALIZADO. Logs en progreso
  // (autosave sin haber tocado Finalizado todavía) no suman al
  // contador ni a la barra de progreso de la sesión.
  const finalizedIds = new Set(
    exerciseLogs
      .filter(
        (log) =>
          log.scheduled_date === scheduledDate && Boolean(log.finalized_at)
      )
      .map((log) => log.exercise_id)
      .filter((id): id is string => Boolean(id))
  );
  const completed = trackable.filter((e) =>
    finalizedIds.has(e.exercise_id as string)
  ).length;
  const total = trackable.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  // Conteo a mostrar en el banner. Preferimos `total` (alineado con la
  // lista renderizada — incluye overrides del trainer que pueden tener
  // un conteo distinto al template). Caemos a `session.exercise_count`
  // mientras no hay datos resueltos todavía para no parpadear de "0"
  // a "5".
  const displayExerciseCount = total > 0 ? total : session.exercise_count;

  const typeStyle = getSessionTypeStyle(session.session_type);

  return (
    <section className="w-full space-y-4">
      <Button
        className="text-default-600"
        size="sm"
        startContent={<Icon icon="solar:alt-arrow-left-linear" width={18} />}
        variant="light"
        onPress={onExit}
      >
        Cambiar entrenamiento
      </Button>

      <div className="rounded-xl bg-primary px-4 py-5 flex items-start gap-3 shadow-sm">
        <div
          aria-label={`Sesión de ${typeStyle.label.toLowerCase()}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white"
          role="img"
        >
          <Icon
            aria-hidden="true"
            className={typeStyle.iconColorClass}
            icon={typeStyle.icon}
            width={22}
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-2xl font-heading font-bold text-primary-foreground leading-tight">
            {session.name}
          </h2>
          <p className="text-xs text-primary-foreground/80 font-body">
            {displayExerciseCount}{" "}
            {displayExerciseCount === 1 ? "ejercicio" : "ejercicios"}
            {total > 0 && completed > 0 ? ` · ${completed} hechos` : null}
          </p>
        </div>
      </div>

      {total > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-body text-default-600">
            <span>
              {completed} de {total} hechos
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-default-200 overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {resolvedLoading && !resolved ? (
        // Don't render the clickable list until the override fetch lands —
        // otherwise a tap before the data arrives captures stale template
        // values and the modal opens with empty defaults.
        <ul aria-busy="true" className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="rounded-md border border-default-200 bg-default-100 h-14 animate-pulse"
            />
          ))}
        </ul>
      ) : exercises.length === 0 ? (
        <div className="rounded-md border border-default-200 bg-content1 p-3 text-sm text-default-500 font-body">
          Esta sesión no tiene ejercicios todavía.
        </div>
      ) : (
        <ul className="space-y-2">
          {exercises.map((exercise) => {
            const exerciseId = exercise.exercise_id ?? "";
            const existingLog = exerciseId
              ? exerciseLogs.find(
                  (log) =>
                    log.exercise_id === exerciseId &&
                    log.scheduled_date === scheduledDate
                )
              : undefined;
            const status: ExerciseStatus = !existingLog
              ? "not_started"
              : existingLog.finalized_at
                ? "completed"
                : "in_progress";

            return (
              <li key={`${session.id}-${exercise.order}`}>
                <ExerciseRow
                  exercise={exercise}
                  status={status}
                  onClick={() =>
                    onLogExercise({
                      exercise,
                      sessionId: session.id,
                      scheduledDate,
                      existingLog: existingLog ?? null,
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface RowProps {
  exercise: ExerciseLike & Record<string, unknown>;
  status: ExerciseStatus;
  onClick: () => void;
}

const STATUS_STYLE: Record<
  ExerciseStatus,
  {
    container: string;
    icon: string;
    iconClass: string;
    label: string;
    labelClass: string;
  }
> = {
  not_started: {
    container: "border-default-200 bg-content1 hover:bg-default-50",
    icon: "solar:check-circle-linear",
    iconClass: "text-default-300",
    label: "Falta",
    labelClass: "text-default-400",
  },
  in_progress: {
    container: "border-warning/40 bg-warning/5 hover:bg-warning/10",
    icon: "solar:clock-circle-bold",
    iconClass: "text-warning-600",
    label: "En curso",
    labelClass: "text-warning-700",
  },
  completed: {
    container: "border-success/40 bg-success/5",
    icon: "solar:check-circle-bold",
    iconClass: "text-success",
    label: "Hecho",
    labelClass: "text-success",
  },
};

function ExerciseRow({ exercise, status, onClick }: RowProps) {
  const isCardio = isExerciseCardio(exercise);
  const stats = formatExerciseStats(exercise, isCardio);
  const hasVideo = Boolean(exercise.videoUrl || exercise.uploadedVideoUrl);
  const style = STATUS_STYLE[status];

  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${style.container}`}
      type="button"
      onClick={onClick}
    >
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-14 w-14 rounded-md object-cover shrink-0"
          src={exercise.imageUrl}
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-default-200">
          <Icon
            className="text-default-500"
            icon="solar:dumbbell-bold"
            width={22}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="truncate text-sm font-heading font-semibold text-foreground">
          {exercise.name}
        </p>
        {stats ? (
          <p className="truncate text-xs font-body text-foreground/60">
            {stats}
          </p>
        ) : null}
        {hasVideo ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-body text-foreground/60">
            <Icon
              className="text-primary"
              icon="solar:videocamera-record-bold"
              width={12}
            />
            Con video
          </span>
        ) : null}
      </div>
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        <Icon className={style.iconClass} icon={style.icon} width={26} />
        <span
          className={`text-[10px] font-body font-medium ${style.labelClass}`}
        >
          {style.label}
        </span>
      </div>
    </button>
  );
}

function isExerciseCardio(exercise: ExerciseLike): boolean {
  return (
    exercise.category === "cardio" ||
    !!(exercise.duration || exercise.distance || exercise.cardioType)
  );
}

// Formatea la línea secundaria de la card del ejercicio:
//   strength → "4 × 12 · 60s descanso"
//   cardio   → "30 min · 5 km · alta intensidad"
// Si el campo no está, lo omitimos limpiamente. Devuelve "" si no hay
// nada relevante (p.ej. ejercicio sin metadata) — el caller decide si
// renderiza la línea.
function formatExerciseStats(
  exercise: ExerciseLike,
  isCardio: boolean
): string {
  const parts: string[] = [];

  if (isCardio) {
    if (exercise.duration) parts.push(`${exercise.duration} min`);
    if (exercise.distance) parts.push(`${exercise.distance} km`);
    if (exercise.intensity)
      parts.push(`${exercise.intensity.toLowerCase()} intensidad`);
    if (parts.length === 0 && exercise.cardioType)
      parts.push(exercise.cardioType);
  } else {
    // Per-set override (Phase 3.5) wins. Render a compact summary like
    // "8×60kg · 8×60kg · 6×65kg" so the client sees each set immediately.
    if (exercise.prescribedSets && exercise.prescribedSets.length > 0) {
      const summary = exercise.prescribedSets
        .map((s) => {
          const r = s.reps ?? "—";
          const w = s.weightKg != null ? `×${s.weightKg}kg` : "";

          return `${r}${w}`;
        })
        .join(" · ");

      parts.push(summary);
    } else {
      const sets = exercise.sets;
      const reps = exercise.reps?.toString().trim();

      if (sets && reps) {
        parts.push(`${sets} × ${reps}`);
      } else if (sets) {
        parts.push(`${sets} ${sets === 1 ? "serie" : "series"}`);
      } else if (reps) {
        parts.push(`${reps} reps`);
      }
      if (exercise.weightKg != null) {
        parts.push(`${exercise.weightKg} kg`);
      }
    }
    const rest = exercise.rest?.toString().trim();

    if (rest) parts.push(`${rest} descanso`);
  }

  return parts.join(" · ");
}

function findExercisesForSession(
  programs: WorkoutProgram[],
  sessionId: string
): Array<ExerciseLike & Record<string, unknown>> {
  for (const program of programs) {
    if (program.status !== "active") continue;
    const sessions = (program as unknown as { sessions?: unknown[] }).sessions;

    if (!Array.isArray(sessions)) continue;
    for (const s of sessions) {
      const sObj = s as { id?: string; exercises?: unknown[] };

      if (sObj.id === sessionId && Array.isArray(sObj.exercises)) {
        return sObj.exercises as Array<ExerciseLike & Record<string, unknown>>;
      }
    }
  }

  return [];
}

function toExerciseLike(r: ResolvedExercise): ExerciseLike {
  const perSet =
    r.prescribed_sets && r.prescribed_sets.length > 0
      ? r.prescribed_sets.map((s) => ({
          setNumber: s.set_number,
          reps: s.reps,
          weightKg: s.weight_kg,
        }))
      : undefined;

  const out: ExerciseLike = {
    order: r.exercise_order,
    name: r.name,
    category: r.category,
  };

  if (r.exercise_id) out.exercise_id = r.exercise_id;
  if (r.sets != null) out.sets = r.sets;
  if (r.reps != null) out.reps = r.reps;
  if (r.weight_kg != null) out.weightKg = r.weight_kg;
  if (r.image_url) out.imageUrl = r.image_url;
  if (r.video_url) out.videoUrl = r.video_url;
  if (r.duration_seconds != null) {
    out.duration = Math.round(r.duration_seconds / 60);
  }
  if (r.distance_meters != null) {
    out.distance = parseFloat((r.distance_meters / 1000).toFixed(2));
  }
  // Coaching meta — antes no se mapeaban y un override de cardio caía
  // al branch de strength porque isExerciseCardio() no veía intensity
  // ni cardio_type. También tempo/trainingSystem para que el draft
  // signature detecte cambios cuando el trainer ajusta cadencia/sistema.
  if (r.intensity) out.intensity = r.intensity;
  if (r.cardio_type) out.cardioType = r.cardio_type;
  if (r.heart_rate_min != null && r.heart_rate_max != null) {
    out.heartRateZone = { min: r.heart_rate_min, max: r.heart_rate_max };
  }
  if (r.tempo) out.tempo = r.tempo;
  if (r.training_system) out.trainingSystem = r.training_system;
  if (perSet) out.prescribedSets = perSet;

  return out;
}
