"use client";

// Surface unificado "Programa": fuerza y cardio en una sola pantalla —
// selector de programa, cabecera con métricas, días del microciclo y lista
// de sesiones. Este componente compone las cards, es dueño del estado del
// drawer de ejercicio y de los modales de ciclo de vida del programa.

import type { WorkoutExercise, WorkoutSession } from "./training-api";

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ExerciseDrawer } from "./exercise-drawer";
import { MicrocycleDaysCard } from "./microcycle-days-card";
import { ProgramHeaderCard } from "./program-header-card";
import {
  CreateProgramModal,
  DeleteProgramModal,
  EditProgramModal,
  SaveTemplateModal,
} from "./program-modals";
import { ProgramSelector } from "./program-selector";
import { programToUpdateInput } from "./programa-format";
import { SessionsCard } from "./sessions-card";
import { useProgramMutations, usePrograms } from "./use-training";
import { useMicrocycleState } from "./use-microcycle-state";

import { useClientExerciseLogs } from "@/components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs";

interface DrawerState {
  session: WorkoutSession;
  /** null = añadir ejercicio nuevo a la sesión. */
  exercise: WorkoutExercise | null;
}

export function ProgramaSection({ clientId }: { clientId: string }) {
  const { programs, isLoading, error, refetch } = usePrograms(clientId);
  const { updateProgram, updateProgramStatus } = useProgramMutations(clientId);
  const microcycle = useMicrocycleState(clientId);
  const logs = useClientExerciseLogs(clientId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      programs.find((program) => program.programId === selectedId) ??
      programs[0] ??
      null,
    [programs, selectedId]
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createFocusTemplates, setCreateFocusTemplates] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  // Slot del shell (fila de pills) donde vive el selector de programa; si no
  // existe (tests, otros hosts) el selector cae en línea como antes.
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarEl(document.getElementById("training-programa-toolbar"));
  }, []);

  const openCreate = (focusTemplates: boolean) => {
    setCreateFocusTemplates(focusTemplates);
    setCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-64 rounded-large" />
        <Skeleton className="h-40 w-full rounded-large" />
        <Skeleton className="h-36 w-full rounded-large" />
        <Skeleton className="h-64 w-full rounded-large" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-large border border-danger-200 bg-danger-50 p-4">
        <div className="flex items-center gap-2 text-sm text-danger-700">
          <Icon icon="solar:danger-bold" width={18} />
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar los programas"}
        </div>
        <Button size="sm" variant="bordered" onPress={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selected === null ? (
        <div className="flex flex-col items-center gap-4 rounded-large border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Icon icon="solar:dumbbell-bold" width={26} />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-gray-900">
              Este cliente no tiene programa activo
            </h3>
            <p className="text-sm text-default-500">
              Crea un programa de fuerza o cardio desde cero, o parte de una de
              tus plantillas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              className="bg-slate-900 text-white"
              startContent={<Icon icon="solar:add-circle-bold" width={16} />}
              onPress={() => openCreate(false)}
            >
              Nuevo programa
            </Button>
            <Button
              startContent={
                <Icon icon="solar:folder-with-files-linear" width={16} />
              }
              variant="bordered"
              onPress={() => openCreate(true)}
            >
              Usar una plantilla
            </Button>
          </div>
        </div>
      ) : (
        <>
          {(() => {
            const selector = (
              <ProgramSelector
                activeId={selected.programId}
                programs={programs}
                onCreateNew={() => openCreate(false)}
                onSelect={setSelectedId}
              />
            );

            return toolbarEl !== null ? (
              createPortal(selector, toolbarEl)
            ) : (
              <div className="flex items-center justify-between gap-3">
                {selector}
              </div>
            );
          })()}

          <ProgramHeaderCard
            isDeactivating={updateProgramStatus.isPending}
            isUpdating={updateProgram.isPending}
            microcycleDays={microcycle.durationDays}
            program={selected}
            updateError={
              updateProgram.isError
                ? updateProgram.error instanceof Error
                  ? updateProgram.error.message
                  : "No se pudo actualizar el programa"
                : updateProgramStatus.isError
                  ? updateProgramStatus.error instanceof Error
                    ? updateProgramStatus.error.message
                    : "No se pudo desactivar el programa"
                  : null
            }
            onDeactivate={() =>
              updateProgramStatus.mutate(
                { programId: selected.programId, status: "paused" },
                { onSuccess: () => setSelectedId(null) }
              )
            }
            onDelete={() => setDeleteOpen(true)}
            onEdit={() => setEditOpen(true)}
            onRename={(name) =>
              updateProgram.mutate({
                programId: selected.programId,
                input: { ...programToUpdateInput(selected), name },
              })
            }
            onSaveAsTemplate={() => setTemplateOpen(true)}
          />

          <MicrocycleDaysCard sessions={selected.sessions} state={microcycle} />

          <SessionsCard
            clientId={clientId}
            getLogsForExercise={logs.getLogsForExercise}
            program={selected}
            slotByDay={microcycle.slotByDay}
            onAddExercise={(session) => setDrawer({ session, exercise: null })}
            onEditExercise={(session, exercise) =>
              setDrawer({ session, exercise })
            }
          />
        </>
      )}

      <CreateProgramModal
        clientId={clientId}
        focusTemplates={createFocusTemplates}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={setSelectedId}
      />
      <EditProgramModal
        clientId={clientId}
        isOpen={editOpen}
        program={selected}
        onClose={() => setEditOpen(false)}
      />
      <DeleteProgramModal
        clientId={clientId}
        isOpen={deleteOpen}
        program={selected}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => setSelectedId(null)}
      />
      <SaveTemplateModal
        clientId={clientId}
        isOpen={templateOpen}
        program={selected}
        onClose={() => setTemplateOpen(false)}
      />

      {selected !== null && drawer !== null && (
        <ExerciseDrawer
          isOpen
          clientId={clientId}
          exercise={drawer.exercise}
          getLogsForSlot={logs.getLogsForSlot}
          programId={selected.programId}
          sessionCategory={drawer.session.sessionType}
          sessionId={drawer.session.id}
          sessionName={drawer.session.name}
          onClose={() => setDrawer(null)}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
