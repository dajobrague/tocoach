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

  return (
    <section className="w-full space-y-4">
      <Button
        size="sm"
        startContent={<Icon icon="solar:alt-arrow-left-linear" width={18} />}
        variant="light"
        onPress={onExit}
      >
        Cambiar entrenamiento
      </Button>

      {/* Card de la sesión. Al completarla se convierte en el momento de
          cierre (mismo patrón que el check-in en Inicio): insignia, mensaje y
          Compartir dentro de la superficie de marca que ya existía, sin
          añadir otro bloque de color. */}
      <div className="rounded-large bg-primary px-4 py-5 text-primary-foreground shadow-small">
        <div className="flex items-start gap-3">
          <div
            aria-label={`Sesión de ${typeStyle.label.toLowerCase()}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"
            role="img"
          >
            <Icon
              aria-hidden="true"
              className="text-primary-foreground"
              icon={typeStyle.icon}
              width={22}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h2 className="text-2xl font-heading font-bold text-primary-foreground leading-tight">
              {session.name}
            </h2>
            <p className="text-xs text-primary-foreground/80">
              {displayExerciseCount}{" "}
              {displayExerciseCount === 1 ? "ejercicio" : "ejercicios"}
            </p>
          </div>
          {sessionCompleted ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              <Icon aria-hidden icon="solar:check-circle-bold" width={14} />
              Completado
            </span>
          ) : null}
        </div>

        {!sessionCompleted && total > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-primary-foreground/85">
              <span>
                {completed} de {total} hechos
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/20">
              <div
                className="h-full bg-primary-foreground transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Hora de inicio: con hora ya declarada se muestra editable (última
            gana); sin hora, un botón explícito la registra — nunca se
            registra sola al abrir la vista (llamada 29 Jul: el cliente puede
            entrar solo a revisar qué le toca). */}
        {!sessionCompleted &&
        (schedState.data?.scheduled_time != null || timeDraft !== null) ? (
          <div className="mt-4 flex items-center gap-2 rounded-medium bg-primary-foreground/10 px-3 py-2">
            <Icon
              aria-hidden
              className="shrink-0 text-primary-foreground/80"
              icon="solar:clock-circle-linear"
              width={16}
            />
            <span className="text-xs text-primary-foreground/85">
              Empezaste a las
            </span>
            <input
              aria-label="Hora de inicio del entrenamiento"
              className="ml-auto bg-transparent text-sm font-semibold text-primary-foreground outline-none"
              disabled={setStartTime.isPending}
              type="time"
              value={timeDraft ?? schedState.data?.scheduled_time ?? ""}
              onBlur={commitTimeDraft}
              onChange={(event) => setTimeDraft(event.target.value)}
            />
          </div>
        ) : !sessionCompleted &&
          schedState.isSuccess &&
          scheduledDate === getLocalTodayYmd() ? (
          // isSuccess: sin esperar la respuesta del server, el botón se
          // pintaría durante la carga aunque YA exista hora registrada, y un
          // tap la sobrescribiría con la hora actual.
          <Button
            // Invertido sobre la marca: texto con la marca cruda (no
            // .text-primary, que con marcas pálidas es una tinta oscurecida).
            className="mt-4 w-full bg-primary-foreground font-semibold text-[hsl(var(--heroui-primary))]"
            isLoading={setStartTime.isPending}
            startContent={
              setStartTime.isPending ? null : (
                <Icon icon="solar:play-bold" width={18} />
              )
            }
            onPress={() => setStartTime.mutate(nowHHMM())}
          >
            Empezar entrenamiento
          </Button>
        ) : null}

        {sessionCompleted ? (
          <div className="mt-4 border-t border-primary-foreground/15 pt-4">
            <p className="font-heading text-lg leading-snug text-primary-foreground">
              ¡Entrenamiento completado!
            </p>
            <p className="mt-0.5 text-sm text-primary-foreground/85">
              Buen trabajo. Compártelo con tu gente.
            </p>
            <div className="mt-4">
              <ShareSessionButton
                inverted
                scheduledDate={scheduledDate}
                sessionId={session.id}
                sessionName={session.name}
              />
            </div>
            {schedState.data?.completedManually === true ? (
              <Button
                className="mt-1 w-full text-primary-foreground/80"
                isLoading={markCompleted.isPending}
                size="sm"
                variant="light"
                onPress={() => markCompleted.mutate({ undo: true })}
              >
                Deshacer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {resolvedLoading && !resolved ? (
        // Don't render the clickable list until the override fetch lands —
        // otherwise a tap before the data arrives captures stale template
        // values and the modal opens with empty defaults.
        <ul aria-busy="true" className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="h-20 animate-pulse rounded-large bg-content1 shadow-small"
            />
          ))}
        </ul>
      ) : allExercises.length === 0 ? (
        <div className="rounded-large bg-content1 p-3 text-sm text-default-500 shadow-small">
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
        <Button
          fullWidth
          startContent={<Icon icon="solar:add-circle-linear" width={18} />}
          variant="flat"
          onPress={() => setIsBorrowOpen(true)}
        >
          Agregar ejercicio de otro día
        </Button>
      ) : null}

      {/* Completar aunque queden ejercicios sin hacer (15 Jul). Va al final
          y discreto: es la salida para cerrar la sesión, no el siguiente
          paso. También cubre el caso con todo hecho pero sin estado
          "completed" (el auto-completado por cobertura falló o va con
          retraso): sin el botón el cliente no podría cerrar la sesión. */}
      {!sessionCompleted && total > 0 ? (
        <Button
          fullWidth
          className="text-default-600"
          isLoading={markCompleted.isPending}
          startContent={
            markCompleted.isPending ? null : (
              <Icon icon="solar:check-circle-linear" width={18} />
            )
          }
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
  {
    container: string;
    icon: string;
    iconClass: string;
    label: string;
    labelClass: string;
  }
> = {
  not_started: {
    container: "hover:bg-default-50",
    icon: "mdi:circle-outline",
    iconClass: "text-default-300",
    label: "Pendiente",
    labelClass: "text-default-400",
  },
  in_progress: {
    container: "hover:bg-default-50",
    icon: "solar:clock-circle-bold",
    iconClass: "text-warning-600",
    label: "En curso",
    labelClass: "text-warning-700",
  },
  completed: {
    container: "",
    icon: "solar:check-circle-bold",
    iconClass: "text-success",
    label: "Hecho",
    labelClass: "text-success",
  },
};

function ExerciseRow({ exercise, increaseWeight, status, onClick }: RowProps) {
  const isCardio = isExerciseCardio(exercise);
  const stats = formatExerciseStats(exercise, isCardio);
  const hasVideo = Boolean(exercise.videoUrl || exercise.uploadedVideoUrl);
  const style = STATUS_STYLE[status];
  const borrowedFrom = exercise.borrowedFromSessionName;

  return (
    <button
      className={`flex w-full items-center gap-3 rounded-large bg-content1 p-3 text-left shadow-small transition-colors ${style.container}`}
      type="button"
      onClick={onClick}
    >
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-14 w-14 shrink-0 rounded-medium bg-default-100 object-cover"
          decoding="async"
          loading="lazy"
          src={exercise.imageUrl}
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-medium bg-default-100">
          <Icon
            className="text-default-400"
            icon="solar:dumbbell-linear"
            width={22}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="truncate text-sm font-heading font-semibold text-foreground">
          {exercise.name}
        </p>
        {stats ? (
          <p className="truncate text-xs text-default-500">{stats}</p>
        ) : null}
        {increaseWeight ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-px text-[11px] font-body font-semibold text-success-700">
            <Icon icon="solar:arrow-up-linear" width={12} />
            Sube peso
          </span>
        ) : null}
        {borrowedFrom ? (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-default-300 px-1.5 py-px text-[10px] text-default-500">
            <Icon
              className="shrink-0"
              icon="solar:transfer-horizontal-linear"
              width={11}
            />
            <span className="truncate">De: {borrowedFrom}</span>
          </span>
        ) : null}
        {hasVideo ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-default-500">
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
        <span className={`text-[10px] font-medium ${style.labelClass}`}>
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
