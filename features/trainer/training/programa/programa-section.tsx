"use client";

// Surface unificado "Programa": fuerza y cardio en una sola pantalla — una
// card de programa POR CATEGORÍA (fuerza | cardio) en el toolbar, cabecera
// con métricas del programa enfocado, días del microciclo (asignables desde
// TODOS los programas activos) y una card de sesiones por categoría, una
// debajo de la otra (Loom JC, 10 sep). Este componente compone las cards, es
// dueño del estado del drawer de ejercicio y de los modales de ciclo de vida.

import type { SelectedByCategory } from "./programa-format";
import type {
  ProgramCategory,
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSession,
} from "./training-api";

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
  PauseOthersModal,
  SaveTemplateModal,
} from "./program-modals";
import { ProgramCategoryCard } from "./program-selector";
import {
  pickByCategory,
  programCategory,
  programToUpdateInput,
} from "./programa-format";
import { EmptySessionsCard, SessionsCard } from "./sessions-card";
import { useProgramMutations, usePrograms } from "./use-training";
import { useMicrocycleState } from "./use-microcycle-state";

import { useClientExerciseLogs } from "@/components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs";

/** Orden de las cards: fuerza a la izquierda/arriba, cardio a la derecha/abajo. */
const CATEGORIES: readonly ProgramCategory[] = ["strength", "cardio"];

interface DrawerState {
  /** Programa dueño de la sesión: con una card de sesiones por categoría ya
   *  no es necesariamente el programa enfocado. */
  program: WorkoutProgram;
  session: WorkoutSession;
  /** null = añadir ejercicio nuevo a la sesión. */
  exercise: WorkoutExercise | null;
}

export function ProgramaSection({ clientId }: { clientId: string }) {
  const { programs, isLoading, error, refetch } = usePrograms(clientId);
  const { updateProgram, updateProgramStatus } = useProgramMutations(clientId);
  const microcycle = useMicrocycleState(clientId);
  const logs = useClientExerciseLogs(clientId);

  // Activos y pausados por separado (llamada 29 Jul): desactivar un programa
  // lo movía a un limbo sin forma de verlo ni reactivarlo. Ahora el fetch trae
  // ambos y cada card los lista en secciones; otros estados legacy
  // (completed/cancelled) siguen fuera de esta vista.
  const activePrograms = useMemo(
    () => programs.filter((program) => program.status === "active"),
    [programs]
  );
  const pausedPrograms = useMemo(
    () => programs.filter((program) => program.status === "paused"),
    [programs]
  );

  // Un programa elegido por categoría + qué card manda sobre la cabecera,
  // los modales y el drawer (la enfocada). Ver pickByCategory.
  const [selectedIds, setSelectedIds] = useState<SelectedByCategory>({
    strength: null,
    cardio: null,
  });
  const [focus, setFocus] = useState<ProgramCategory>("strength");
  const selection = useMemo(
    () => pickByCategory(programs, selectedIds, focus),
    [programs, selectedIds, focus]
  );
  const selected = selection.byCategory[selection.focused];

  const choose = (category: ProgramCategory, programId: string | null) => {
    setSelectedIds((prev) => ({ ...prev, [category]: programId }));
    setFocus(category);
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] =
    useState<ProgramCategory>("strength");
  const [createFocusTemplates, setCreateFocusTemplates] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  // Snapshot de los activos PREVIOS a una asignación (misma categoría que el
  // programa nuevo): al crear ofrecemos pausarlos (= ocultarlos al cliente).
  // Snapshot y no lista viva: tras el invalidate el nuevo entraría a la lista.
  const [pausePromptOthers, setPausePromptOthers] = useState<
    WorkoutProgram[] | null
  >(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  // Slot del shell (fila de pills) donde viven las cards de programa; si no
  // existe (tests, otros hosts) caen en línea como antes.
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarEl(document.getElementById("training-programa-toolbar"));
  }, []);

  const openCreate = (category: ProgramCategory, focusTemplates: boolean) => {
    setCreateCategory(category);
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
              onPress={() => openCreate("strength", false)}
            >
              Nuevo programa
            </Button>
            <Button
              startContent={
                <Icon icon="solar:folder-with-files-linear" width={16} />
              }
              variant="bordered"
              onPress={() => openCreate("strength", true)}
            >
              Usar una plantilla
            </Button>
          </div>
        </div>
      ) : (
        <>
          {(() => {
            const selector = (
              <div className="flex min-w-0 items-center gap-2">
                {CATEGORIES.map((category) => (
                  <ProgramCategoryCard
                    key={category}
                    category={category}
                    isFocused={selection.focused === category}
                    pausedPrograms={pausedPrograms.filter(
                      (program) => programCategory(program) === category
                    )}
                    programs={activePrograms.filter(
                      (program) => programCategory(program) === category
                    )}
                    selected={selection.byCategory[category]}
                    onCreateNew={() => openCreate(category, false)}
                    onSelect={(programId) => choose(category, programId)}
                  />
                ))}
              </div>
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
                    : "No se pudo cambiar el estado del programa"
                  : null
            }
            onDeactivate={() =>
              updateProgramStatus.mutate(
                { programId: selected.programId, status: "paused" },
                {
                  onSuccess: () => choose(programCategory(selected), null),
                }
              )
            }
            onDelete={() => setDeleteOpen(true)}
            onEdit={() => setEditOpen(true)}
            onReactivate={() =>
              updateProgramStatus.mutate({
                programId: selected.programId,
                status: "active",
              })
            }
            onRename={(name) =>
              updateProgram.mutate({
                programId: selected.programId,
                input: { ...programToUpdateInput(selected), name },
              })
            }
            onSaveAsTemplate={() => setTemplateOpen(true)}
          />

          <MicrocycleDaysCard programs={activePrograms} state={microcycle} />

          {CATEGORIES.map((category) => {
            const program = selection.byCategory[category];

            return program !== null ? (
              <SessionsCard
                key={category}
                category={category}
                clientId={clientId}
                getLogsForExercise={logs.getLogsForExercise}
                program={program}
                slotByDay={microcycle.slotByDay}
                onAddExercise={(session) =>
                  setDrawer({ program, session, exercise: null })
                }
                onEditExercise={(session, exercise) =>
                  setDrawer({ program, session, exercise })
                }
              />
            ) : (
              <EmptySessionsCard
                key={category}
                category={category}
                onCreateProgram={() => openCreate(category, false)}
              />
            );
          })}
        </>
      )}

      <CreateProgramModal
        clientId={clientId}
        focusTemplates={createFocusTemplates}
        initialCategory={createCategory}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(programId, category) => {
          choose(category, programId);
          const others = activePrograms.filter(
            (program) =>
              programCategory(program) === category &&
              program.programId !== programId
          );

          if (others.length > 0) setPausePromptOthers(others);
        }}
      />
      <PauseOthersModal
        clientId={clientId}
        isOpen={pausePromptOthers !== null}
        others={pausePromptOthers ?? []}
        onClose={() => setPausePromptOthers(null)}
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
        onDeleted={() => {
          if (selected !== null) choose(programCategory(selected), null);
        }}
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
          programId={drawer.program.programId}
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
