// Modo "sesión activa": contenido de la pantalla (ClientScreen) que se abre
// cuando el cliente toca una sesión — card de la sesión + progreso + lista
// de ejercicios. El "Cambiar" y la fecha viven en la barra de esa pantalla
// (workouts-content.tsx).
//
// Persistencia: el activeSessionId vive en localStorage (ver
// hooks/use-persisted-active-training.ts), así que sobrevive a
// recargas y al cambio de pestañas del bottom-nav.

import type { WorkoutProgram } from "@/types/training";
import type { OpenLogPayload } from "./available-sessions-list";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

import { BorrowExerciseModal } from "./borrow-exercise-modal";
import { collectExtraLoggedExercises } from "./extra-logged-exercises";
import { useResolvedDayPrescription } from "./hooks/use-resolved-day-prescription";
import {
  nowHHMM,
  useMarkSessionCompleted,
  useScheduledSessionState,
  useSetStartTime,
} from "./hooks/use-scheduled-session-state";
import { SessionTypeTile } from "./session-card";
import { getSessionTypeStyle } from "./session-type-style";
import { ShareSessionButton } from "./share-session-button";
import { toExerciseLike } from "./to-exercise-like";

import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { isIncreaseWeightPending } from "@/lib/training/increase-weight";
import { logMatchesSlot } from "@/lib/training/log-attribution";

export interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  exercise_id?: string;
  /** Slot específico del plan (session_exercises.id) que se loguea. */
  session_exercise_id?: string;
  /** Comentario del trainer — el modal de log lo muestra como nota. */
  notes?: string;
  // Strength
  sets?: number;
  reps?: string;
  rest?: string;
  /** RIR (reps in reserve) prescrito — texto libre. */
  rir?: string;
  /** "Subir peso": día que revisó el entrenador (lib/training/increase-weight). */
  increaseWeightAfter?: string;
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
  /**
   * Nombre de la sesión de la que el cliente "tomó prestado" este ejercicio
   * (feature 15-jul: agregar un ejercicio de otro día sobre la marcha).
   * Viaja hasta exercise_logs.metadata para que el trainer vea de dónde salió.
   */
  borrowedFromSessionName?: string;
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
  onLogExercise: (payload: OpenLogPayload) => void;
}

export function ActiveSessionView({
  session,
  programs,
  exerciseLogs,
  scheduledDate,
  onLogExercise,
}: Props) {
  const { data: resolved, loading: resolvedLoading } =
    useResolvedDayPrescription(scheduledDate);
  // Estado servidor de esta sesión en esta fecha: hora de inicio declarada
  // y completado (manual o automático). Llamada del 15 Jul.
  const schedState = useScheduledSessionState(scheduledDate, session.id);
  const setStartTime = useSetStartTime(scheduledDate, session.id);
  const markCompleted = useMarkSessionCompleted(scheduledDate, session.id);

  // La hora de inicio SOLO se registra con el botón explícito (llamada 29
  // Jul): antes se auto-registraba al entrar a la vista, pero el cliente
  // puede abrir la sesión horas antes solo para ver qué le toca — eso no es
  // empezar a entrenar.

  const sessionCompleted = schedState.data?.status === "completed";

  // Hora de inicio con borrador local: bindear el input directo al server
  // disparaba un PUT por keystroke (y pisaba lo tecleado con el valor viejo).
  // null = seguir mostrando el valor del server; se comitea al salir del campo.
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const commitTimeDraft = () => {
    if (timeDraft === null) return;
    const serverTime = schedState.data?.scheduled_time ?? "";

    if (/^\d{2}:\d{2}$/.test(timeDraft) && timeDraft !== serverTime) {
      setStartTime.mutate(timeDraft);
    }
    setTimeDraft(null);
  };

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

  // Ejercicios "prestados" de otra sesión, agregados por el cliente en esta
  // visita (feature 15-jul). Estado local: al recargar, los que ya tienen log
  // reaparecen solos vía extraLoggedExercises; los no logueados se pierden,
  // lo cual está bien — nunca existieron.
  const [borrowed, setBorrowed] = useState<
    Array<ExerciseLike & Record<string, unknown>>
  >([]);
  const [isBorrowOpen, setIsBorrowOpen] = useState(false);

  const allExercises = useMemo(() => {
    // Mientras el prestado sigue en memoria, su versión gana sobre la fila
    // derivada del log (conserva el chip de procedencia y la prescripción
    // original de la otra sesión); el extra logueado equivalente se omite.
    const borrowedIds = new Set(
      borrowed
        .map((e) => e.exercise_id)
        .filter((id): id is string => Boolean(id))
    );
    const visibleBorrowed = borrowed.filter(
      (e) => !templateExerciseIds.has(e.exercise_id ?? "")
    );

    return [
      ...exercises,
      ...extraLoggedExercises.filter(
        (e) => !borrowedIds.has(e.exercise_id ?? "")
      ),
      ...visibleBorrowed,
    ];
  }, [exercises, extraLoggedExercises, borrowed, templateExerciseIds]);

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

  const isToday = scheduledDate === getLocalTodayYmd();
  const hasStartTime =
    schedState.data?.scheduled_time != null || timeDraft !== null;

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-10 pt-4">
      {/* Card de la sesión. Superficie neutra (no bloque de marca: con
          algunos temas un bloque grande de color pesa demasiado); la marca
          queda en la barra de progreso y el botón de empezar. */}
      <div className="flex flex-col gap-4 rounded-large bg-content1 p-[18px] shadow-small">
        <div className="flex items-center gap-3">
          <SessionTypeTile sessionType={session.session_type} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-default-500">
              {typeStyle.label} · {displayExerciseCount}{" "}
              {displayExerciseCount === 1 ? "ejercicio" : "ejercicios"}
            </p>
            <h2 className="mt-px font-heading text-[26px] leading-[1.1] tracking-[-0.02em] text-foreground">
              {session.name}
            </h2>
          </div>
          {sessionCompleted ? (
            <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 text-xs font-semibold text-success-700">
              <Icon aria-hidden icon="solar:check-circle-bold" width={14} />
              Completado
            </span>
          ) : null}
        </div>

        {total > 0 ? (
          <div
            aria-label="Progreso"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            role="progressbar"
          >
            <div className="flex items-baseline justify-between tabular-nums">
              <span className="text-[15px] font-semibold text-foreground">
                {completed} de {total} hechos
              </span>
              <span className="text-[13px] font-semibold text-default-500">
                {progress}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default-200">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Hora de inicio: con hora ya declarada se muestra editable (última
            gana); sin hora, un botón explícito la registra — nunca se
            registra sola al abrir la vista (llamada 29 Jul: el cliente puede
            entrar solo a revisar qué le toca). */}
        {!sessionCompleted && hasStartTime ? (
          <label className="flex h-12 items-center gap-2 rounded-medium bg-default-100 pl-3.5 pr-1.5 text-[15px] text-default-500">
            <Icon
              aria-hidden
              className="shrink-0"
              icon="solar:clock-circle-linear"
              width={20}
            />
            <span className="flex-1 whitespace-nowrap">Empezaste a las</span>
            <input
              aria-label="Hora de inicio del entrenamiento"
              // Sin el icono de reloj nativo (sale negro y no sigue el tema);
              // tocar el campo abre el selector igualmente.
              className="h-9 shrink-0 rounded-[10px] bg-content1 px-2.5 text-[17px] font-bold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-calendar-picker-indicator]:hidden"
              disabled={setStartTime.isPending}
              type="time"
              value={timeDraft ?? schedState.data?.scheduled_time ?? ""}
              onBlur={commitTimeDraft}
              onChange={(event) => setTimeDraft(event.target.value)}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker();
                } catch {
                  // Navegadores sin showPicker: edición con teclado.
                }
              }}
            />
          </label>
        ) : !sessionCompleted && schedState.isSuccess && isToday ? (
          // isSuccess: sin esperar la respuesta del server, el botón se
          // pintaría durante la carga aunque YA exista hora registrada, y un
          // tap la sobrescribiría con la hora actual.
          <Button
            fullWidth
            className="h-[52px] text-[17px] font-semibold"
            color="primary"
            isLoading={setStartTime.isPending}
            radius="lg"
            startContent={
              setStartTime.isPending ? null : (
                <Icon icon="solar:play-bold" width={20} />
              )
            }
            onPress={() => setStartTime.mutate(nowHHMM())}
          >
            Empezar entrenamiento
          </Button>
        ) : null}
      </div>

      {sessionCompleted ? (
        <div className="flex flex-wrap items-center gap-3 rounded-large bg-content1 p-4 shadow-small">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Icon aria-hidden icon="solar:check-read-linear" width={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">
              ¡Entrenamiento completado!
            </p>
            <p className="mt-0.5 text-sm text-default-500">
              Buen trabajo. Compártelo con tu gente.
            </p>
          </div>
          <div className="flex w-full gap-2 pl-[52px]">
            <ShareSessionButton
              scheduledDate={scheduledDate}
              sessionId={session.id}
            />
            {schedState.data?.completedManually === true ? (
              <Button
                className="h-9 bg-default-100 px-3.5 text-sm font-semibold text-foreground"
                isLoading={markCompleted.isPending}
                radius="full"
                startContent={
                  markCompleted.isPending ? null : (
                    <Icon icon="solar:undo-left-linear" width={18} />
                  )
                }
                onPress={() => markCompleted.mutate({ undo: true })}
              >
                Deshacer
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 font-heading text-xl tracking-[-0.015em] text-foreground">
          Ejercicios
        </h2>
        {resolvedLoading && !resolved ? (
          // Don't render the clickable list until the override fetch lands —
          // otherwise a tap before the data arrives captures stale template
          // values and the modal opens with empty defaults.
          <ul aria-busy="true" className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <li
                key={i}
                className="h-20 animate-pulse rounded-large bg-content1 shadow-small motion-reduce:animate-none"
              />
            ))}
          </ul>
        ) : allExercises.length === 0 ? (
          <div className="rounded-large bg-content1 p-4 text-sm text-default-500 shadow-small">
            Esta sesión no tiene ejercicios todavía.
          </div>
        ) : (
          <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
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
                    increaseWeight={
                      status !== "completed" &&
                      isIncreaseWeightPending(
                        exercise.increaseWeightAfter,
                        scheduledDate
                      )
                    }
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

        {/* Prestar un ejercicio de otra sesión (feature 15-jul). Oculto en
            sesiones ya completadas — el entrenamiento terminó. */}
        {!sessionCompleted ? (
          <button
            className="mt-2.5 flex h-[50px] w-full items-center justify-center gap-2 rounded-medium border-[1.5px] border-dashed border-default-300 text-[15px] font-semibold text-foreground active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-default-100"
            type="button"
            onClick={() => setIsBorrowOpen(true)}
          >
            <Icon
              aria-hidden
              className="text-primary"
              icon="solar:add-linear"
              width={18}
            />
            Agregar ejercicio de otro día
          </button>
        ) : null}
      </div>

      {/* Completar aunque queden ejercicios sin hacer (15 Jul). Va al final
          y discreto: es la salida para cerrar la sesión, no el siguiente
          paso. También cubre el caso con todo hecho pero sin estado
          "completed" (el auto-completado por cobertura falló o va con
          retraso): sin el botón el cliente no podría cerrar la sesión. */}
      {!sessionCompleted && total > 0 ? (
        <Button
          className="min-h-11 self-center bg-transparent text-sm font-medium text-default-500 underline decoration-default-300 underline-offset-[3px]"
          isLoading={markCompleted.isPending}
          variant="light"
          onPress={() => markCompleted.mutate({})}
        >
          Marcar entrenamiento como completado
        </Button>
      ) : null}

      <BorrowExerciseModal
        currentSessionId={session.id}
        excludedExerciseIds={
          new Set(
            allExercises
              .map((e) => e.exercise_id)
              .filter((id): id is string => Boolean(id))
          )
        }
        isOpen={isBorrowOpen}
        programs={programs}
        onClose={() => setIsBorrowOpen(false)}
        onPick={(exercise) => setBorrowed((prev) => [...prev, exercise])}
      />
    </section>
  );
}

interface RowProps {
  exercise: ExerciseLike & Record<string, unknown>;
  /** El entrenador pidió subir peso en esta sesión. */
  increaseWeight: boolean;
  status: ExerciseStatus;
  onClick: () => void;
}

const STATUS_STYLE: Record<
  ExerciseStatus,
  { icon: string; className: string; label: string }
> = {
  not_started: {
    icon: "mdi:circle-outline",
    className: "text-default-400",
    label: "Pendiente",
  },
  in_progress: {
    icon: "solar:clock-circle-linear",
    className: "text-warning-600",
    label: "En curso",
  },
  completed: {
    icon: "solar:check-circle-bold",
    className: "text-success-700",
    label: "Hecho",
  },
};

function ExerciseRow({ exercise, increaseWeight, status, onClick }: RowProps) {
  const isCardio = isExerciseCardio(exercise);
  const stats = formatExerciseStats(exercise, isCardio);
  const hasVideo = Boolean(exercise.videoUrl || exercise.uploadedVideoUrl);
  const style = STATUS_STYLE[status];
  const borrowedFrom = exercise.borrowedFromSessionName;
  const typeStyle = getSessionTypeStyle(isCardio ? "cardio" : "strength");

  return (
    <button
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
      type="button"
      onClick={onClick}
    >
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-14 w-14 shrink-0 rounded-[14px] bg-default-100 object-cover"
          decoding="async"
          loading="lazy"
          src={exercise.imageUrl}
        />
      ) : (
        <span
          aria-hidden
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] ${typeStyle.tileClass}`}
        >
          <Icon icon={typeStyle.icon} width={26} />
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {exercise.name}
        </p>
        {stats ? (
          <p className="mt-0.5 text-[13px] leading-snug text-default-500 tabular-nums">
            {stats}
          </p>
        ) : null}
        {increaseWeight || borrowedFrom || hasVideo ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {increaseWeight ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success/15 px-2.5 text-xs font-semibold text-success-700">
                <Icon aria-hidden icon="solar:arrow-up-linear" width={14} />
                Sube peso
              </span>
            ) : null}
            {borrowedFrom ? (
              <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-default-100 px-2.5 text-xs font-semibold text-default-500">
                <Icon
                  aria-hidden
                  className="shrink-0"
                  icon="solar:transfer-horizontal-linear"
                  width={14}
                />
                <span className="truncate">De: {borrowedFrom}</span>
              </span>
            ) : null}
            {hasVideo ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-default-100 px-2.5 text-xs font-semibold text-default-500">
                <Icon
                  aria-hidden
                  icon="solar:videocamera-record-linear"
                  width={14}
                />
                Con video
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span
        className={`flex w-[54px] shrink-0 flex-col items-center gap-[3px] pt-1.5 ${style.className}`}
      >
        <Icon aria-hidden icon={style.icon} width={24} />
        <span className="text-[11px] font-semibold">{style.label}</span>
      </span>
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

    // Descanso siempre con unidad: el entrenador a veces escribe solo "90".
    if (rest) parts.push(`${/^\d+$/.test(rest) ? `${rest}s` : rest} descanso`);

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
    // Pausado cuenta: si el trainer pausa a mitad de una sesión iniciada, el
    // cliente la termina con el template que ya tenía (el pause afecta el
    // futuro, no lo empezado). Completed/cancelled siguen fuera.
    if (program.status !== "active" && program.status !== "paused") continue;
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
