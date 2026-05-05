// Pantalla principal del cliente — orquestador del nuevo flujo "Escoge
// tu siguiente entrenamiento" (Bloque 1, ver bloque-1-spec.md §5.1).
// Sin secciones fijas Hoy/Mañana/Próximos: el cliente elige libremente
// qué sesión hacer y cuándo. La pantalla mantiene la sección histórica
// "Entrenamientos pasados" abajo y un enlace al plan semanal del trainer
// como referencia (oculto si no hay microciclo configurado).

"use client";

import type { WorkoutProgram } from "@/types/training";

import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  AvailableSessionsList,
  type OpenLogPayload,
} from "./available-sessions-list";
import { useAvailableSessions } from "./hooks/use-available-sessions";
import { useMicrocycle } from "./hooks/use-microcycle";
import { usePastSessions } from "./hooks/use-past-sessions";
import { MicrocycleReferenceModal } from "./microcycle-reference-modal";
import { PastWorkoutsList } from "./past-workouts-list";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { ExerciseLogModal } from "@/components/client-dashboard/exercise-log-modal";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { useExerciseLogs, usePrograms } from "@/lib/hooks/use-client-queries";

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
  const hasActiveProgram = Boolean(availableData?.program);
  const todayYmd = getLocalTodayYmd();

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
              <>
                <AvailableSessionsList
                  availableSessions={availableData?.sessions ?? []}
                  exerciseLogs={exerciseLogs}
                  programs={programs}
                  scheduledDate={todayYmd}
                  onLogExercise={handleLogExercise}
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
                      Ver mi plan semanal
                    </Button>
                  </div>
                ) : null}

                <PastWorkoutsList sessions={pastSessions} />
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
