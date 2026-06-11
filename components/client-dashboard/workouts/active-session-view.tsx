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

import { collectExtraLoggedExercises } from "./extra-logged-exercises";
import {
  useResolvedDayPrescription,
  type ResolvedExercise,
} from "./hooks/use-resolved-day-prescription";
import { getSessionTypeStyle } from "./session-type-style";

import { logMatchesSlot } from "@/lib/training/log-attribution";
import { resolveRestLabel } from "@/lib/training/rest-label";

interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  exercise_id?: string;
  /** Slot específico del plan (session_exercises.id) que se loguea. */
  session_exercise_id?: string;
  // Strength
  sets?: number;
  reps?: string;
  rest?: string;
  /** RIR (reps in reserve) prescrito — texto libre. */
  rir?: string;
  tempo?: string;
  trainingSystem?: string;
  /** Uniform prescribed weight in kg (from the session template). */
  weightKg?: number | null;
  /**
   * Pesos del último log finalizado del cliente para este ejercicio
   * (indexados por set position). Se usan como fallback para prellenar
   * inputs del form cuando la prescripción no trae peso.
   */
  lastUsedWeights?: Array<number | null>;
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
  /** Slot específico del plan (session_exercises.id) al que pertenece el log. */
  session_exercise_id?: string | null;
  /** Sesión template a la que pertenece el log (matchea AvailableSession.id). */
  session_id?: string | null;
  training_date?: string;
  scheduled_date?: string;
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
      // the template-resolved session for the date (sets/reps/weight,
      // cardio and coaching meta, last-used-weights pre-fill). When they
      // don't match, fall back to the raw program template for the picked
      // session — that template is the truth for sessions whose resolved
      // slot differs from what the client tapped.
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

  const logsForDate = exerciseLogs.filter(
    (log) => (log.training_date ?? log.scheduled_date) === scheduledDate
  );

  // Logs de este día que no están en el template Y pertenecen a ESTA
  // sesión (off-template legítimo, p.ej. el trainer quitó el ejercicio
  // después de que el cliente lo logueó). Los logs de OTRAS sesiones del
  // mismo día NO se anexan — antes se "sumaban" a la sesión activa como
  // si fueran prescritos y el cliente terminaba haciéndolos (ver
  // collectExtraLoggedExercises para la historia completa).
  const templateExerciseIds = new Set(
    exercises
      .map((e) => e.exercise_id)
      .filter((id): id is string => Boolean(id))
  );
  const extraLoggedExercises = useMemo(
    () =>
      collectExtraLoggedExercises(
        logsForDate,
        session.id,
        templateExerciseIds
      ) as Array<ExerciseLike & Record<string, unknown>>,
    [logsForDate, templateExerciseIds, session.id]
  );

  const allExercises = useMemo(
    () => [...exercises, ...extraLoggedExercises],
    [exercises, extraLoggedExercises]
  );

  const trackable = allExercises.filter(
    (e) => typeof e.exercise_id === "string" && e.exercise_id.length > 0
  );

  // Atribución por slot: un planned exercise se considera logueado por el
  // log que apunta a SU slot (session_exercise_id), no por cualquier log
  // que comparta el exercise_id de la librería. Sólo cuando el log es legacy
  // (sin session_exercise_id) caemos al match por exercise_id, y además lo
  // acotamos a esta sesión para evitar bleed entre sesiones del mismo día.
  const completed = trackable.filter((e) => {
    const log = logsForDate.find((l) => logMatchesSlot(l, e, session.id));

    return Boolean(log?.finalized_at);
  }).length;
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
      ) : allExercises.length === 0 ? (
        <div className="rounded-md border border-default-200 bg-content1 p-3 text-sm text-default-500 font-body">
          Esta sesión no tiene ejercicios todavía.
        </div>
      ) : (
        <ul className="space-y-2">
          {allExercises.map((exercise) => {
            const exerciseId = exercise.exercise_id ?? "";
            // Find the log for THIS slot (finalized or not); the status is
            // derived from its finalized_at below. Same attribution rule as
            // the `completed` count so banner and rows stay consistent.
            const existingLog = exerciseId
              ? logsForDate.find((log) =>
                  logMatchesSlot(log, exercise, session.id)
                )
              : undefined;
            const status: ExerciseStatus = !existingLog
              ? "not_started"
              : existingLog.finalized_at
                ? "completed"
                : "in_progress";

            return (
              <li
                key={`${session.id}-${exercise.exercise_id ?? exercise.order}`}
              >
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
    const sets = exercise.sets;
    const reps = exercise.reps?.toString().trim();

    // Convención per-set codificada en uniform reps: "12 | 12 | 10 | 8"
    // → render legible "12 · 12 · 10 · 8" (sin el "4 ×" delante que
    // duplica info, y mejor que mostrar la pipe cruda en la card).
    if (reps && reps.includes("|")) {
      const perSet = reps
        .split("|")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (perSet.length > 0) parts.push(perSet.join(" · "));
    } else if (sets && reps) {
      parts.push(`${sets} × ${reps}`);
    } else if (sets) {
      parts.push(`${sets} ${sets === 1 ? "serie" : "series"}`);
    } else if (reps) {
      parts.push(`${reps} reps`);
    }
    if (exercise.weightKg != null) {
      parts.push(`${exercise.weightKg} kg`);
    }
    const rest = exercise.rest?.toString().trim();

    if (rest) parts.push(`${rest} descanso`);

    const rir = exercise.rir?.toString().trim();

    if (rir) parts.push(`RIR ${rir}`);
  }

  return parts.join(" · ");
}

// ¿El log `log` corresponde al planned exercise `plannedExercise`?
//   1. Match preciso por slot: log.session_exercise_id === slot. Aplica a los
//      logs nuevos/backfilled que ya cargan el slot.
//   2. Fallback legacy (sólo cuando el log NO trae session_exercise_id):
//      mismo exercise_id de librería Y acotado a esta sesión (session_id
//      ausente o igual al sessionId renderizado) para no contar logs de
//      otra sesión del mismo día.
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
        // Normaliza cada ejercicio del template para que exponga
        // session_exercise_id. En el template path el slot es
        // WorkoutExercise.id (= session_exercises.id); el cliente lo manda
        // de vuelta al loguear para atribuir el log al slot exacto.
        return sObj.exercises.map((we) => {
          const weObj = we as { id?: string } & Record<string, unknown>;

          return {
            ...weObj,
            session_exercise_id: weObj.id,
          };
        }) as Array<ExerciseLike & Record<string, unknown>>;
      }
    }
  }

  return [];
}

function toExerciseLike(r: ResolvedExercise): ExerciseLike {
  const out: ExerciseLike = {
    order: r.exercise_order,
    name: r.name,
    category: r.category,
  };

  if (r.exercise_id) out.exercise_id = r.exercise_id;
  if (r.session_exercise_id) out.session_exercise_id = r.session_exercise_id;
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
  if (r.rir) out.rir = r.rir;
  // El descanso puede vivir en metadata.rest_description (texto libre del
  // flujo add/edit de la página del cliente) o en la columna rest_seconds
  // (editor de templates); leer solo rest_seconds dejaba el descanso vacío.
  const restLabel = resolveRestLabel(r.rest_description, r.rest_seconds);

  if (restLabel) out.rest = restLabel;
  if (r.last_used_weights && r.last_used_weights.length > 0) {
    out.lastUsedWeights = r.last_used_weights;
  }

  return out;
}
