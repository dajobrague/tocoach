"use client";

// Card "Sesiones" del programa seleccionado: lista reordenable (dnd-kit) de
// filas de sesión + modales de alta, renombre, duplicado y borrado. El drag
// llama reorderSessions.mutate de useSessionMutations, que ya parchea el
// cache optimistamente con rollback — aquí no se duplica esa lógica.

import type { ExerciseLog } from "@/components/dashboard/client-profile/tabs/progress/types";
import type {
  ProgramCategory,
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSession,
} from "./training-api";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { programCategory, sessionDayLabel } from "./programa-format";
import { SessionRow } from "./session-row";
import { useSessionMutations } from "./use-training";

interface SessionsCardProps {
  clientId: string;
  program: WorkoutProgram;
  /** Slots del microciclo (día → session_id) para los subtítulos "Día X". */
  slotByDay: Map<number, string | null>;
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  onAddExercise: (session: WorkoutSession) => void;
  onEditExercise: (session: WorkoutSession, exercise: WorkoutExercise) => void;
}

type NameModal =
  | { kind: "add" }
  | { kind: "rename"; session: WorkoutSession }
  | { kind: "duplicate"; session: WorkoutSession };

function SortableSessionItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, unknown>;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

export function SessionsCard({
  clientId,
  program,
  slotByDay,
  getLogsForExercise,
  onAddExercise,
  onEditExercise,
}: SessionsCardProps) {
  const category: ProgramCategory = programCategory(program);
  const mutations = useSessionMutations(clientId, program.programId);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [nameModal, setNameModal] = useState<NameModal | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);
  const [recentlyDuplicatedExerciseId, setRecentlyDuplicatedExerciseId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleExpanded = (sessionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);

      return next;
    });
  };

  const handleSessionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over === null || active.id === over.id) return;

    const oldIndex = program.sessions.findIndex((s) => s.id === active.id);
    const newIndex = program.sessions.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(program.sessions, oldIndex, newIndex);

    mutations.reorderSessions.mutate(
      reordered.map((session, index) => ({
        id: session.id,
        session_order: index + 1,
      })),
      { onError: () => setError("No se pudo reordenar las sesiones") }
    );
  };

  const openNameModal = (modal: NameModal) => {
    setError(null);
    setNameModal(modal);
    setNameDraft(
      modal.kind === "add"
        ? ""
        : modal.kind === "rename"
          ? modal.session.name
          : `${modal.session.name} (copia)`
    );
  };

  const namePending =
    mutations.addSession.isPending ||
    mutations.updateSession.isPending ||
    mutations.duplicateSession.isPending;

  const submitNameModal = () => {
    const name = nameDraft.trim();

    // Guard de doble submit: mientras una mutación está en vuelo, ignora.
    if (nameModal === null || name.length === 0 || namePending) return;

    const close = () => setNameModal(null);
    const fail = (message: string) => () => setError(message);

    if (nameModal.kind === "add") {
      mutations.addSession.mutate(
        { name },
        { onSuccess: close, onError: fail("No se pudo crear la sesión") }
      );
    } else if (nameModal.kind === "rename") {
      mutations.updateSession.mutate(
        { sessionId: nameModal.session.id, patch: { name } },
        { onSuccess: close, onError: fail("No se pudo renombrar la sesión") }
      );
    } else {
      mutations.duplicateSession.mutate(
        { sessionId: nameModal.session.id, name },
        { onSuccess: close, onError: fail("No se pudo duplicar la sesión") }
      );
    }
  };

  const modalTitle =
    nameModal?.kind === "add"
      ? "Añadir sesión"
      : nameModal?.kind === "rename"
        ? "Renombrar sesión"
        : "Duplicar sesión";

  return (
    <div className="rounded-large border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:dumbbell-linear"
            width={16}
          />
          <h3 className="text-sm font-semibold text-gray-900">Sesiones</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-default-600 tabular-nums">
            {program.sessions.length}
          </span>
        </div>
        <Button
          className="bg-slate-900 text-white"
          size="sm"
          startContent={<Icon icon="solar:add-circle-bold" width={15} />}
          onPress={() => openNameModal({ kind: "add" })}
        >
          Añadir sesión
        </Button>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {program.sessions.length === 0 && (
          <button
            className="flex w-full flex-col items-center gap-1.5 rounded-large border border-dashed border-gray-300 py-6 text-sm text-default-500 transition-colors hover:border-gray-400 hover:bg-gray-50"
            type="button"
            onClick={() => openNameModal({ kind: "add" })}
          >
            <Icon icon="solar:add-circle-bold" width={20} />
            Crea la primera sesión del programa
          </button>
        )}

        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handleSessionDragEnd}
        >
          <SortableContext
            items={program.sessions.map((session) => session.id)}
            strategy={verticalListSortingStrategy}
          >
            {program.sessions.map((session) => (
              <SortableSessionItem key={session.id} id={session.id}>
                {({ dragHandleProps }) => (
                  <SessionRow
                    category={category}
                    clientId={clientId}
                    dayLabel={sessionDayLabel(slotByDay, session.id)}
                    dragHandleProps={dragHandleProps}
                    getLogsForExercise={getLogsForExercise}
                    isExpanded={expandedIds.has(session.id)}
                    programId={program.programId}
                    recentlyDuplicatedExerciseId={recentlyDuplicatedExerciseId}
                    session={session}
                    onAddExercise={() => onAddExercise(session)}
                    onEditExercise={(exercise) =>
                      onEditExercise(session, exercise)
                    }
                    onExerciseDuplicated={setRecentlyDuplicatedExerciseId}
                    onRequestDelete={() => setDeleteTarget(session)}
                    onRequestDuplicate={() =>
                      openNameModal({ kind: "duplicate", session })
                    }
                    onRequestRename={() =>
                      openNameModal({ kind: "rename", session })
                    }
                    onToggle={() => toggleExpanded(session.id)}
                  />
                )}
              </SortableSessionItem>
            ))}
          </SortableContext>
        </DndContext>

        {error !== null && (
          <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {error}
          </div>
        )}
      </div>

      {/* Modal compartido de nombre: alta / renombre / duplicado */}
      <Modal
        isOpen={nameModal !== null}
        placement="center"
        size="sm"
        onClose={() => setNameModal(null)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon
              className="text-gray-700"
              icon={
                nameModal?.kind === "duplicate"
                  ? "solar:copy-linear"
                  : "solar:dumbbell-linear"
              }
              width={20}
            />
            {modalTitle}
          </ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              isDisabled={namePending}
              label="Nombre de la sesión"
              placeholder="Ej: Full Body A"
              value={nameDraft}
              variant="bordered"
              onKeyDown={(event) => {
                if (event.key === "Enter") submitNameModal();
              }}
              onValueChange={setNameDraft}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={namePending}
              variant="light"
              onPress={() => setNameModal(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-slate-900 text-white"
              isDisabled={nameDraft.trim().length === 0}
              isLoading={namePending}
              onPress={submitNameModal}
            >
              {nameModal?.kind === "duplicate" ? "Duplicar" : "Guardar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirmación de borrado de sesión */}
      <Modal
        isOpen={deleteTarget !== null}
        placement="center"
        size="sm"
        onClose={() => setDeleteTarget(null)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger-600">
              <Icon icon="solar:trash-bin-trash-linear" width={18} />
            </span>
            Eliminar sesión
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-700">
              ¿Eliminar <strong>{deleteTarget?.name}</strong> y todos sus
              ejercicios? Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={mutations.deleteSession.isPending}
              variant="light"
              onPress={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={mutations.deleteSession.isPending}
              onPress={() => {
                if (deleteTarget === null) return;
                mutations.deleteSession.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                  onError: () => {
                    setDeleteTarget(null);
                    setError("No se pudo eliminar la sesión");
                  },
                });
              }}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
