// Pantalla principal del cliente — orquestador del nuevo flujo "Escoge
// tu siguiente entrenamiento" (Bloque 1, ver bloque-1-spec.md §5.1).
// Sin secciones fijas Hoy/Mañana/Próximos: el cliente elige libremente
// qué sesión hacer y cuándo. La pantalla mantiene la sección histórica
// "Entrenamientos pasados" abajo y un enlace al microciclo del trainer
// como referencia (oculto si no hay microciclo configurado).

"use client";

import type { WorkoutProgram } from "@/types/training";

import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ActiveSessionView } from "./active-session-view";
import {
  AvailableSessionsList,
  type OpenLogPayload,
} from "./available-sessions-list";
import {
  useAvailableSessions,
  type AvailableSession,
} from "./hooks/use-available-sessions";
import { useScheduledSessionState } from "./hooks/use-scheduled-session-state";
import { useLoggedSessionsForDate } from "./hooks/use-logged-sessions-for-date";
import { useMicrocycle } from "./hooks/use-microcycle";
import { usePersistedActiveTraining } from "./hooks/use-persisted-active-training";
import { useResolvedDayPrescription } from "./hooks/use-resolved-day-prescription";
import { LoggedSessionsSection } from "./logged-sessions-section";
import { MicrocycleReferenceModal } from "./microcycle-reference-modal";
import { WeekDateSelector } from "./week-date-selector";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { ExerciseLogModal } from "@/components/client-dashboard/exercise-log/exercise-log-modal";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import {
  useDeleteExerciseLogs,
  useExerciseLogs,
  usePrograms,
} from "@/lib/hooks/use-client-queries";

export function WorkoutsContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();
  const queryClient = useQueryClient();

  const {
    data: availableData,
    isLoading: isLoadingAvailable,
    error: availableError,
    refetch: refetchAvailable,
  } = useAvailableSessions();
  const { data: microcycle } = useMicrocycle();

  // Programs y exerciseLogs siguen siendo la fuente de verdad para los
  // datos completos de ejercicios y el estado de logs por fecha. El
  // endpoint /api/client/sessions devuelve solo metadata por sesión —
  // los ejercicios completos los buscamos en el caché de programas.
  const { data: programs = [] as WorkoutProgram[] } = usePrograms();
  const { data: exerciseLogs = [] } = useExerciseLogs(clientId);

  const [selectedExercise, setSelectedExercise] =
    useState<OpenLogPayload | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isMicrocycleModalOpen, setIsMicrocycleModalOpen] = useState(false);

  // Persistencia local del par {fecha elegida, sesión activa}. Sin
  // esto, salir a otra pestaña del bottom-nav y volver pierde la
  // elección del cliente. Hidratamos los `useState` con el valor
  // persistido para que el primer render ya muestre la sesión activa.
  const { persisted, setActive, clearActive } =
    usePersistedActiveTraining(clientId);

  // activeSessionId: id de la sesión que el cliente eligió "Comenzar". Si
  // no es null, la pantalla cambia al modo activa (ActiveSessionView).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    persisted?.sessionId ?? null
  );
  // Día activo del selector de semana. Determina la fecha que se manda
  // al guardar exercise-logs y bajo qué fecha se calcula el progreso de
  // la sesión activa. Default = lo persistido o hoy local.
  const todayYmd = getLocalTodayYmd();
  const [selectedDate, setSelectedDate] = useState<string>(
    persisted?.date ?? todayYmd
  );

  // The trainer's recommended session for the selected date — comes from a
  // per-date override if present, else from the microcycle template. Used to
  // tag the matching card in AvailableSessionsList.
  //
  // Solo lo exponemos para hoy y futuro: para fechas pasadas el endpoint
  // resuelve usando el override-de-hoy o el template proyectado hacia
  // atrás, así que tagueaba "Recomendado" sobre una sesión que no fue
  // necesariamente lo que el trainer prescribió en ese momento.
  //
  // Usamos `trainer_recommended_session_ids` (no `session.id`) para que el
  // badge "Recomendado por tu entrenador" siempre apunte a la prescripción
  // real del trainer (microciclo), nunca a la sesión que el cliente eligió
  // hacer al loguear. Con varios programas activos puede haber VARIAS
  // recomendadas el mismo día (fuerza + cardio) — todas llevan badge. El
  // scalar legacy cubre SOLO el skew de deploy (bundle nuevo hablando con
  // un servidor pre-Fase-2 que aún no manda el array); el SW nunca cachea
  // /api/ y no hay persister de React Query, así que no hay otra fuente.
  const { data: resolvedForSelectedDate } =
    useResolvedDayPrescription(selectedDate);
  const isPastDate = selectedDate < todayYmd;
  const recommendedSessionIds = useMemo<ReadonlySet<string>>(() => {
    if (isPastDate || !resolvedForSelectedDate) return new Set<string>();
    const ids =
      resolvedForSelectedDate.trainer_recommended_session_ids ??
      (resolvedForSelectedDate.trainer_recommended_session_id !== null
        ? [resolvedForSelectedDate.trainer_recommended_session_id]
        : []);

    return new Set(ids);
  }, [isPastDate, resolvedForSelectedDate]);

  // Etiqueta de programa en las cards SOLO cuando hay más de un programa
  // activo (fuerza + cardio): con uno solo es ruido visual.
  const programNameById = useMemo<ReadonlyMap<string, string> | null>(() => {
    const list = availableData?.programs ?? [];

    if (list.length <= 1) return null;

    return new Map(list.map((p) => [p.id, p.name]));
  }, [availableData?.programs]);

  // Fallback para la sesión activa cuando ya no está en el listado de
  // disponibles (programa recién pausado): el cache de programs del cliente
  // trae TODOS los status, así que el template sigue ahí para el banner.
  const sessionFromCache = useMemo<AvailableSession | null>(() => {
    if (!activeSessionId) return null;
    for (const program of programs as WorkoutProgram[]) {
      // Solo active/paused: resucitar sesiones de programas completed/
      // cancelled pintaría una vista sin ejercicios (el fallback de
      // active-session-view también los excluye).
      if (program.status !== "active" && program.status !== "paused") continue;
      const match = program.sessions.find((s) => s.id === activeSessionId);

      if (match) {
        return {
          id: match.id,
          name: match.name,
          session_type: match.sessionType ?? null,
          duration_minutes: null,
          exercise_count: match.exercises.length,
        };
      }
    }

    return null;
  }, [programs, activeSessionId]);

  const activeSession = activeSessionId
    ? (availableData?.sessions.find((s) => s.id === activeSessionId) ??
      sessionFromCache)
    : null;

  // Estado servidor de la sesión activa en la fecha elegida: una fila real
  // (hora de inicio declarada / status) es evidencia de trabajo iniciado.
  const activeSchedState = useScheduledSessionState(
    activeSessionId !== null ? selectedDate : "",
    activeSessionId ?? ""
  );
  const activeHasLoggedWork = useMemo(() => {
    if (activeSessionId === null) return false;

    return (
      exerciseLogs as Array<{
        training_date?: string;
        scheduled_date?: string;
        session_id?: string;
      }>
    ).some(
      (log) =>
        (log.training_date ?? log.scheduled_date) === selectedDate &&
        log.session_id === activeSessionId
    );
  }, [exerciseLogs, activeSessionId, selectedDate]);

  // Si la sesión persistida ya no existe en el programa activo (el
  // trainer la borró/movió, pausó el programa, o el cliente cambió de
  // programa), limpiamos la persistencia para evitar quedar bloqueados
  // sin "Cambiar entrenamiento". EXCEPCIÓN (llamada 4 Ago): con trabajo
  // ya iniciado — logs de esa sesión ese día o fila real con hora de
  // inicio — la sesión sigue viva y el cliente la termina; pausar afecta
  // el futuro, no lo empezado. Solo corre cuando availableData ya cargó.
  useEffect(() => {
    if (!availableData || !activeSessionId) return;
    const stillExists = availableData.sessions.some(
      (s) => s.id === activeSessionId
    );

    if (stillExists) return;
    if (activeHasLoggedWork) return;
    // Esperar CUALQUIER fetch en vuelo antes de expulsar (isPending cubre la
    // primera carga, isFetching el refetch que dispara el POST de inicio):
    // con solo isLoading, el clear ganaba la carrera contra la fila recién
    // creada. Un error de red tampoco expulsa — "no sé" no es "no hay fila".
    if (activeSchedState.isPending || activeSchedState.isFetching) return;
    if (activeSchedState.isError) return;
    if (activeSchedState.data != null) return;

    setActiveSessionId(null);
    clearActive();
  }, [
    availableData,
    activeSessionId,
    activeHasLoggedWork,
    activeSchedState.isPending,
    activeSchedState.isFetching,
    activeSchedState.isError,
    activeSchedState.data,
    clearActive,
  ]);

  const handleActivateSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      setActive({ date: selectedDate, sessionId });
    },
    [selectedDate, setActive]
  );

  const handleExitSession = useCallback(() => {
    setActiveSessionId(null);
    clearActive();
  }, [clearActive]);

  const handleSelectDate = useCallback(
    (ymd: string) => {
      // Cambiar de fecha resetea la sesión activa: cada día tiene su
      // propio contexto. Si en la nueva fecha hay logs, la pantalla
      // los va a mostrar via LoggedSessionsSection. Si no hay nada, el
      // cliente arranca fresh con la lista de templates.
      //
      // setSelectedExercise(null) cierra el modal de log si estaba
      // abierto: antes cambiar de día con el modal abierto dejaba el
      // modal apuntando a la fecha vieja y el save persistía contra
      // ese día.
      setSelectedDate(ymd);
      setActiveSessionId(null);
      setSelectedExercise(null);
      clearActive();
    },
    [clearActive]
  );

  // Set de fechas con al menos un exercise_log. Lo usamos para pintar
  // un puntito en cada día del selector de semana que tuvo actividad
  // — así el cliente escanea de un vistazo qué días entrenó. Cubre
  // el rango +/-30 días que carga useExerciseLogs.
  const datesWithActivity = useMemo(() => {
    const set = new Set<string>();

    for (const log of exerciseLogs as Array<{
      training_date?: string;
      scheduled_date?: string;
    }>) {
      const d = log.training_date ?? log.scheduled_date;

      if (typeof d === "string") set.add(d);
    }

    return set;
  }, [exerciseLogs]);

  // Sesiones que el cliente ya registró en la fecha seleccionada. Se
  // deriva del cache de exercise logs — no hay fetch extra. La usamos
  // para mostrar el bloque "Tu entrenamiento del [día]" cuando hay
  // historial en esa fecha.
  const loggedSessions = useLoggedSessionsForDate(
    exerciseLogs as Array<{
      id: string;
      training_date?: string;
      scheduled_date?: string;
      session_id?: string;
      exercise_id?: string;
    }>,
    programs,
    selectedDate
  );
  const isViewingPast = selectedDate < todayYmd;
  const isViewingToday = selectedDate === todayYmd;
  const deleteLogs = useDeleteExerciseLogs(clientId);

  const handleDeleteLoggedSession = useCallback(
    (sessionId: string) => {
      deleteLogs.mutate({ sessionId, scheduledDate: selectedDate });
    },
    [deleteLogs, selectedDate]
  );

  const handleLogExercise = (payload: OpenLogPayload) => {
    setSelectedExercise(payload);
    setIsLogModalOpen(true);
  };

  const handleLogModalClose = () => {
    setIsLogModalOpen(false);
  };

  const handleLogModalSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["client", "exerciseLogs", clientId],
    });
    queryClient.invalidateQueries({
      queryKey: ["client", "past-sessions"],
    });
  };

  const isLoading = isLoadingAvailable;
  const error = availableError ? (availableError as Error).message : null;
  const hasActiveProgram = (availableData?.programs?.length ?? 0) > 0;
  // Sin programa activo el HISTORIAL sigue siendo del cliente (pausar
  // afecta el futuro, no el pasado): con actividad registrada se mantienen
  // el selector de semana y las sesiones pasadas; solo se retira la lista
  // de entrenamientos disponibles. El empty state grande queda para
  // clientes sin programa Y sin historial.
  const hasHistory = datesWithActivity.size > 0;
  const showNoProgramEmptyState =
    !hasActiveProgram && !hasHistory && activeSession === null;

  const hasPausedPrograms = programs.some(
    (p: WorkoutProgram) => p.status === "paused"
  );

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="px-4 space-y-6 w-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
              </div>
            ) : null}

            {error && !isLoading ? (
              <Card className="bg-content1 border border-danger-200">
                <CardBody className="p-12 text-center">
                  <Icon
                    className="text-danger text-6xl mx-auto mb-4"
                    icon="solar:danger-circle-bold"
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                    Error al cargar entrenamientos
                  </h3>
                  <p className="text-foreground/60 font-body text-sm mb-4">
                    {error}
                  </p>
                  <Button
                    color="primary"
                    startContent={
                      <Icon icon="solar:refresh-linear" width={18} />
                    }
                    onPress={() => refetchAvailable()}
                  >
                    Reintentar
                  </Button>
                </CardBody>
              </Card>
            ) : null}

            {!isLoading && !error && showNoProgramEmptyState ? (
              <Card className="bg-content1 border border-default-200 shadow-sm">
                <CardBody className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="bg-default-100 p-4 rounded-full mb-4">
                      <Icon
                        className="text-foreground/40 text-5xl"
                        icon="solar:dumbbell-linear"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground font-heading mb-2">
                      No tienes un programa activo
                    </h3>
                    <p className="text-foreground/60 text-sm font-body">
                      {hasPausedPrograms
                        ? "Tienes programas en pausa — actívalos desde Más → Programas"
                        : "Tu entrenador asignará un programa pronto"}
                    </p>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {!isLoading && !error && (hasActiveProgram || hasHistory) ? (
              <WeekDateSelector
                datesWithActivity={datesWithActivity}
                selectedDate={selectedDate}
                todayYmd={todayYmd}
                onSelect={handleSelectDate}
              />
            ) : null}

            {!isLoading && !error && activeSession ? (
              <ActiveSessionView
                exerciseLogs={exerciseLogs}
                programs={programs}
                scheduledDate={selectedDate}
                session={activeSession}
                onExit={handleExitSession}
                onLogExercise={handleLogExercise}
              />
            ) : null}

            {!isLoading &&
            !error &&
            !activeSession &&
            (hasActiveProgram || hasHistory) ? (
              <>
                {loggedSessions.length > 0 ? (
                  <LoggedSessionsSection
                    loggedSessions={loggedSessions}
                    scheduledDate={selectedDate}
                    todayYmd={todayYmd}
                    onActivate={handleActivateSession}
                    onDelete={handleDeleteLoggedSession}
                  />
                ) : null}

                {hasActiveProgram ? (
                  <AvailableSessionsList
                    availableSessions={availableData?.sessions ?? []}
                    heading={
                      isViewingToday
                        ? "Escoge tu siguiente entrenamiento"
                        : loggedSessions.length > 0
                          ? "Agregar otro entrenamiento"
                          : isViewingPast
                            ? "¿Qué hiciste ese día?"
                            : "Plan para ese día"
                    }
                    loggedSessionIds={
                      new Set(loggedSessions.map((s) => s.sessionId))
                    }
                    programNameById={programNameById}
                    recommendedSessionIds={recommendedSessionIds}
                    onActivate={handleActivateSession}
                  />
                ) : (
                  <Card className="bg-content1 border border-default-200 shadow-sm">
                    <CardBody className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-default-100">
                          <Icon
                            className="text-foreground/40 text-xl"
                            icon="solar:pause-circle-linear"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-heading font-semibold text-foreground">
                            No tienes un programa activo ahora mismo
                          </p>
                          <p className="text-xs font-body text-foreground/60">
                            Tu historial de entrenamientos sigue disponible
                            aquí.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {hasActiveProgram && microcycle ? (
                  <div className="flex justify-center">
                    <Button
                      className="text-foreground/70"
                      endContent={
                        <Icon icon="solar:alt-arrow-right-linear" width={16} />
                      }
                      size="sm"
                      variant="light"
                      onPress={() => setIsMicrocycleModalOpen(true)}
                    >
                      Ver mi microciclo
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
      <ClientBottomNav />

      <ExerciseLogModal
        clientId={clientId}
        // El shape de exercise viene del WorkoutExercise transformado por
        // training-utils, que históricamente trae id implícito (no
        // declarado en el tipo). El modal lo acepta tal cual; mantenemos
        // el cast para no inflar tipos del módulo legacy.
        exercise={
          (selectedExercise?.exercise ?? null) as React.ComponentProps<
            typeof ExerciseLogModal
          >["exercise"]
        }
        exerciseId={
          (selectedExercise?.exercise as { exercise_id?: string } | undefined)
            ?.exercise_id ?? ""
        }
        existingLog={selectedExercise?.existingLog ?? null}
        isOpen={isLogModalOpen}
        scheduledDate={selectedExercise?.scheduledDate ?? ""}
        sessionExerciseId={
          (
            selectedExercise?.exercise as
              | { session_exercise_id?: string }
              | undefined
          )?.session_exercise_id ?? null
        }
        sessionId={selectedExercise?.sessionId ?? ""}
        onClose={handleLogModalClose}
        onSuccess={handleLogModalSuccess}
      />

      {microcycle ? (
        <MicrocycleReferenceModal
          durationDays={microcycle.duration_days}
          isOpen={isMicrocycleModalOpen}
          slots={microcycle.slots}
          onClose={() => setIsMicrocycleModalOpen(false)}
        />
      ) : null}
    </>
  );
}
