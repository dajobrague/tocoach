// Modo "sesión activa": contenido de la pantalla (ClientScreen) que se abre
// cuando el cliente toca una sesión — card de la sesión + progreso + lista
// de ejercicios. El "Cambiar" y la fecha viven en la barra de esa pantalla
// (workouts-content.tsx).
//
// Persistencia: el activeSessionId vive en localStorage (ver
// hooks/use-persisted-active-training.ts), así que sobrevive a
// recargas y al cambio de pestañas del bottom-nav.

import type { MuscleId } from "@/lib/training/muscles";
import type { WorkoutProgram } from "@/types/training";
import type { OpenLogPayload } from "./available-sessions-list";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { useWorkoutFeedback } from "./hooks/use-workout-feedback";

import { DynamicFormModal } from "@/components/client-dashboard/dynamic-form-modal";
import { MuscleBody } from "@/components/shared/muscle-body";
import { MuscleVolume } from "@/components/shared/muscle-volume";
import {
  type LibraryMedia,
  useLibraryMedia,
} from "@/lib/hooks/use-library-media";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { isIncreaseWeightPending } from "@/lib/training/increase-weight";
import { logMatchesSlot } from "@/lib/training/log-attribution";
import { muscleVolume } from "@/lib/training/muscle-volume";
import { muscleLabel } from "@/lib/training/muscles";

export interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  /** Músculos de la biblioteca: resumen "músculos de hoy". */
  primaryMuscles?: MuscleId[];
  secondaryMuscles?: MuscleId[];
  /** Slug del catálogo con licencia: póster/animación vía useLibraryMedia. */
  libraryExerciseId?: string;
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
  clientId: string;
  session: AvailableSession;
  programs: WorkoutProgram[];
  exerciseLogs: ExerciseLogLike[];
  scheduledDate: string;
  onLogExercise: (payload: OpenLogPayload) => void;
}

export function ActiveSessionView({
  clientId,
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

  // Formulario post-entreno (configurable por el entrenador). Se abre solo
  // cuando la sesión PASA a completada con esta vista abierta (botón manual
  // o auto-completado al registrar el último ejercicio) y aún no hay
  // respuesta para esta sesión; abrir una sesión ya completada no lo
  // dispara. Después se puede editar desde la tarjeta de completado.
  const feedback = useWorkoutFeedback(clientId, scheduledDate, session.id);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const prevCompletedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!schedState.isSuccess) return;
    const wasCompleted = prevCompletedRef.current;

    prevCompletedRef.current = sessionCompleted;
    if (
      wasCompleted === false &&
      sessionCompleted &&
      feedback.enabled &&
      !feedback.answered
    ) {
      setIsFeedbackOpen(true);
    }
    // Solo la transición del estado dispara; feedback se lee en ese momento.
  }, [schedState.isSuccess, sessionCompleted]);

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

  // Póster/animación del catálogo; el servidor elige la figura según el sexo
  // del cliente. Sin catálogo (o sin subir) todo queda como antes.
  const libraryMedia = useLibraryMedia(
    allExercises.map((e) => e.libraryExerciseId),
    { client: true }
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
  const muscleInputs = allExercises.map((e) => ({
    sets: e.sets ?? 0,
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
  }));
  const todayVolume = muscleVolume(muscleInputs);

  // Pantalla "Siguiente" (prototipo elegido, nov): se organiza alrededor del
  // ejercicio que toca ahora (el que está en curso o, si no, el primero
  // pendiente); el resto va en filas de una línea y los hechos se pliegan.
  // Descartadas: tabla sin imágenes (pierde las animaciones) y cuadrícula de
  // imágenes (el doble de scroll, descanso y etiquetas apretados).
  const rows: FlowRow[] = allExercises.map((exercise) => {
    const exerciseId = exercise.exercise_id ?? "";
    // Log de ESTE slot (finalizado o no); misma atribución que `completed`.
    const existingLog = exerciseId
      ? logsForDate.find((log) => logMatchesSlot(log, exercise, session.id))
      : undefined;
    const status: ExerciseStatus = !existingLog
      ? "not_started"
      : existingLog.finalized_at
        ? "completed"
        : "in_progress";
    const media = exercise.libraryExerciseId
      ? libraryMedia[exercise.libraryExerciseId]
      : undefined;

    return {
      key: `${session.id}-${exercise.exercise_id ?? exercise.order}`,
      exercise,
      status,
      media,
      increaseWeight:
        status !== "completed" &&
        isIncreaseWeightPending(exercise.increaseWeightAfter, scheduledDate),
      open: () =>
        onLogExercise({
          exercise: { ...exercise, libraryMedia: media },
          sessionId: session.id,
          scheduledDate,
          existingLog: existingLog ?? null,
        }),
    };
  });
  const currentRow = sessionCompleted
    ? undefined
    : (rows.find((r) => r.status === "in_progress") ??
      rows.find((r) => r.status === "not_started"));
  const laterRows = rows.filter(
    (r) => r !== currentRow && r.status !== "completed"
  );
  const doneRows = rows.filter((r) => r.status === "completed");

  const isToday = scheduledDate === getLocalTodayYmd();
  const hasStartTime =
    schedState.data?.scheduled_time != null || timeDraft !== null;

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-10 pt-4 [html[data-rest-band]_&]:pt-[76px]">
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

        {/* Músculos de hoy (JC, nov): arriba, banda estrecha con la figura a
            la derecha; el desglose por series se abre al tocar. */}
        {todayVolume.length > 0 && (!resolvedLoading || resolved) ? (
          <details className="group rounded-medium bg-default-100">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5 py-1.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">
                  Músculos de hoy
                </p>
                <p className="truncate text-[13px] text-default-500">
                  {todayVolume.map((v) => muscleLabel(v.id)).join(", ")}
                </p>
              </div>
              <MuscleBody
                client
                className="w-5 shrink-0"
                flip={false}
                primary={todayVolume
                  .filter((v) => v.sets >= todayVolume[0]!.sets / 2)
                  .map((v) => v.id)}
                secondary={todayVolume
                  .filter((v) => v.sets < todayVolume[0]!.sets / 2)
                  .map((v) => v.id)}
              />
              <Icon
                aria-hidden
                className="shrink-0 text-default-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                icon="solar:alt-arrow-down-linear"
                width={18}
              />
            </summary>
            <MuscleVolume
              className="px-3.5 pb-3.5 pt-1"
              exercises={muscleInputs}
            />
          </details>
        ) : null}

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
          {feedback.enabled ? (
            <div className="w-full pl-[52px]">
              <Button
                className="h-9 px-3.5 text-sm font-semibold"
                radius="full"
                startContent={
                  <Icon
                    aria-hidden
                    icon={
                      feedback.answered
                        ? "solar:pen-new-square-linear"
                        : "solar:chat-round-like-linear"
                    }
                    width={18}
                  />
                }
                variant="flat"
                onPress={() => setIsFeedbackOpen(true)}
              >
                {feedback.answered
                  ? "Editar formulario post-entreno"
                  : "Formulario post-entreno"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {feedback.enabled ? (
        <DynamicFormModal
          clientId={clientId}
          formType="workout"
          isOpen={isFeedbackOpen}
          metadata={{ session_id: session.id }}
          targetDate={scheduledDate}
          onClose={() => setIsFeedbackOpen(false)}
          onSuccess={async () => {
            await feedback.refetch();
          }}
        />
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
          <div className="flex flex-col gap-6">
            {currentRow ? (
              <FocusCard
                primaryCta={hasStartTime || !isToday}
                row={currentRow}
              />
            ) : null}

            {laterRows.length > 0 ? (
              <div>
                {currentRow ? (
                  <h3 className="mb-2 font-heading text-lg text-foreground">
                    Después
                  </h3>
                ) : null}
                <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                  {laterRows.map((row) => (
                    <li key={row.key}>
                      <CompactRow row={row} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {doneRows.length > 0 ? (
              <details className="group overflow-hidden rounded-large bg-content1 shadow-small">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <Icon
                    aria-hidden
                    className="text-success-700"
                    icon="solar:check-circle-bold"
                    width={20}
                  />
                  <span className="flex-1 tabular-nums">
                    {doneRows.length}{" "}
                    {doneRows.length === 1 ? "hecho" : "hechos"}
                  </span>
                  <Icon
                    aria-hidden
                    className="text-default-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    icon="solar:alt-arrow-down-linear"
                    width={18}
                  />
                </summary>
                <ul className="divide-y divide-default-100 border-t border-default-100">
                  {doneRows.map((row) => (
                    <li key={row.key}>
                      <CompactRow row={row} />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
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

interface FlowRow {
  key: string;
  exercise: ExerciseLike & Record<string, unknown>;
  status: ExerciseStatus;
  /** Póster y animación del catálogo cuando el entrenador no subió imagen. */
  media: LibraryMedia | undefined;
  /** El entrenador pidió subir peso en esta sesión. */
  increaseWeight: boolean;
  open: () => void;
}

function ExerciseChips({ row }: { row: FlowRow }) {
  const { exercise, increaseWeight } = row;
  const borrowedFrom = exercise.borrowedFromSessionName;
  const hasVideo = Boolean(exercise.videoUrl || exercise.uploadedVideoUrl);

  if (!increaseWeight && !borrowedFrom && !hasVideo) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
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
          <Icon aria-hidden icon="solar:videocamera-record-linear" width={14} />
          Con video
        </span>
      ) : null}
    </div>
  );
}

/** Lo que el cliente necesita para hacer el ejercicio, en celdas con rótulo. */
function exerciseFacts(
  exercise: ExerciseLike,
  isCardio: boolean
): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };

  if (isCardio) {
    add("Duración", exercise.duration ? `${exercise.duration} min` : null);
    add("Distancia", exercise.distance ? `${exercise.distance} km` : null);
    add("Intensidad", exercise.intensity);
    if (facts.length === 0) add("Tipo", exercise.cardioType);

    return facts;
  }

  const sets = exercise.sets;
  const reps = exercise.reps?.toString().trim();

  // "12 | 12 | 10 | 8" = repeticiones distintas en cada serie.
  if (reps && reps.includes("|")) {
    add(
      "Reps por serie",
      reps
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean)
        .join(" · ")
    );
  } else if (sets && reps) {
    add("Series × reps", `${sets} × ${reps}`);
  } else if (sets) {
    add("Series", String(sets));
  } else {
    add("Reps", reps);
  }

  const rest = exercise.rest?.toString().trim();

  add("Descanso", rest ? (/^\d+$/.test(rest) ? `${rest} s` : rest) : null);
  add("RIR", exercise.rir?.toString().trim());

  const last = exercise.lastUsedWeights?.find((w) => w != null);

  if (exercise.weightKg != null) add("Peso", `${exercise.weightKg} kg`);
  else if (last != null) add("Última vez", `${last} kg`);

  return facts;
}

/** El ejercicio que toca ahora: imagen grande, datos y un único botón. */
function FocusCard({
  row,
  primaryCta,
}: {
  row: FlowRow;
  /** Botón sólido; `false` mientras "Empezar entrenamiento" es la acción. */
  primaryCta: boolean;
}) {
  const { exercise, media, status, open } = row;
  const isCardio = isExerciseCardio(exercise);
  const typeStyle = getSessionTypeStyle(isCardio ? "cardio" : "strength");
  const facts = exerciseFacts(exercise, isCardio);
  const mediaClass = "aspect-[16/10] w-full";

  return (
    <div className="overflow-hidden rounded-large bg-content1 shadow-small">
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className={`${mediaClass} bg-default-100 object-cover`}
          decoding="async"
          src={exercise.imageUrl}
        />
      ) : media?.video ? (
        // Sin imagen del entrenador: la animación del catálogo en bucle. Con
        // "reducir movimiento" no arranca y queda el póster.
        <video
          loop
          muted
          playsInline
          aria-hidden="true"
          autoPlay={
            typeof window !== "undefined" &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          }
          className={`${mediaClass} bg-white object-contain`}
          poster={media.poster}
          src={media.video}
        />
      ) : media?.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className={`${mediaClass} bg-white object-contain`}
          decoding="async"
          src={media.poster}
        />
      ) : (
        <span
          aria-hidden
          className={`flex h-24 w-full items-center justify-center ${typeStyle.tileClass}`}
        >
          <Icon icon={typeStyle.icon} width={32} />
        </span>
      )}
      <div className="p-[18px]">
        <h3 className="text-balance font-heading text-xl leading-snug tracking-[-0.015em] text-foreground">
          {exercise.name}
        </h3>
        {facts.length > 0 ? (
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2.5 rounded-medium bg-default-100 px-3.5 py-2.5">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11px] font-medium text-default-500">
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-foreground">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <ExerciseChips row={row} />
        <Button
          fullWidth
          className="mt-4 h-[52px] text-[17px] font-semibold"
          color="primary"
          radius="lg"
          variant={primaryCta ? "solid" : "flat"}
          onPress={open}
        >
          {status === "in_progress"
            ? "Continuar registro"
            : isCardio
              ? "Registrar"
              : "Registrar series"}
        </Button>
      </div>
    </div>
  );
}

/** Fila de una línea para lo que viene después y para lo ya hecho. */
function CompactRow({ row }: { row: FlowRow }) {
  const { exercise, status, increaseWeight, open } = row;
  const stats = formatExerciseStats(exercise, isExerciseCardio(exercise));

  return (
    <button
      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
      type="button"
      onClick={open}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-medium ${
            status === "completed" ? "text-default-600" : "text-foreground"
          }`}
        >
          {exercise.name}
        </span>
        {stats ? (
          <span className="block truncate text-[13px] tabular-nums text-default-500">
            {stats}
          </span>
        ) : null}
      </span>
      {increaseWeight ? (
        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 text-xs font-semibold text-success-700">
          <Icon aria-hidden icon="solar:arrow-up-linear" width={14} />
          Sube peso
        </span>
      ) : null}
      <Icon
        aria-hidden
        className="shrink-0 text-default-300"
        icon="solar:alt-arrow-right-linear"
        width={18}
      />
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
