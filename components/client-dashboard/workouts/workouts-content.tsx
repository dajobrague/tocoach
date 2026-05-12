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
import { useAvailableSessions } from "./hooks/use-available-sessions";
import { useLoggedSessionsForDate } from "./hooks/use-logged-sessions-for-date";
import { useMicrocycle } from "./hooks/use-microcycle";
import { usePastSessions } from "./hooks/use-past-sessions";
import { usePersistedActiveTraining } from "./hooks/use-persisted-active-training";
import { useResolvedDayPrescription } from "./hooks/use-resolved-day-prescription";
import { LoggedSessionsSection } from "./logged-sessions-section";
import { MicrocycleReferenceModal } from "./microcycle-reference-modal";
import { PastWorkoutsList } from "./past-workouts-list";
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
  const { data: pastSessions = [] } = usePastSessions();

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
  const { data: resolvedForSelectedDate } =
    useResolvedDayPrescription(selectedDate);
  const isPastDate = selectedDate < todayYmd;
  const recommendedSessionId = isPastDate
    ? null
    : (resolvedForSelectedDate?.session?.id ?? null);

  const activeSession = activeSessionId
    ? (availableData?.sessions.find((s) => s.id === activeSessionId) ?? null)
    : null;

  // Si la sesión persistida ya no existe en el programa activo (el
  // trainer la borró/movió, o el cliente cambió de programa), limpiamos
  // la persistencia para evitar quedar bloqueados sin "Cambiar
  // entrenamiento". Solo corre cuando availableData ya cargó.
  useEffect(() => {
    if (!availableData || !activeSessionId) return;
    const stillExists = availableData.sessions.some(
      (s) => s.id === activeSessionId
    );

    if (!stillExists) {
      setActiveSessionId(null);
      clearActive();
    }
  }, [availableData, activeSessionId, clearActive]);

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

    for (const log of exerciseLogs as Array<{ scheduled_date?: string }>) {
      if (typeof log.scheduled_date === "string") {
        set.add(log.scheduled_date);
      }
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

            {!isLoading && !error && !hasActiveProgram ? (
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
                      Tu entrenador asignará un programa pronto
                    </p>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {!isLoading && !error && hasActiveProgram ? (
              <WeekDateSelector
                datesWithActivity={datesWithActivity}
                selectedDate={selectedDate}
                todayYmd={todayYmd}
                onSelect={handleSelectDate}
              />
            ) : null}

            {!isLoading && !error && hasActiveProgram && activeSession ? (
              <ActiveSessionView
                exerciseLogs={exerciseLogs}
                programs={programs}
                scheduledDate={selectedDate}
                session={activeSession}
                onExit={handleExitSession}
                onLogExercise={handleLogExercise}
              />
            ) : null}

            {!isLoading && !error && hasActiveProgram && !activeSession ? (
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
                  recommendedSessionId={recommendedSessionId}
                  onActivate={handleActivateSession}
                />

                {microcycle ? (
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

                {isViewingToday ? (
                  <PastWorkoutsList sessions={pastSessions} />
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
