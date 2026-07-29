"use client";

// Fila de sesión de la card "Sesiones": cabecera (drag, icono por categoría,
// nombre, subtítulo con conteo + días del microciclo, chip, acciones) y
// cuerpo expandido con las filas de ejercicios (drag propio, línea de
// prescripción, popover de progreso y acciones). El reorder de ejercicios usa
// la mutación optimista de useExerciseMutations — sin rollback local.

import type { ExerciseLog } from "@/components/dashboard/client-profile/tabs/progress/types";
import type { WorkoutExercise, WorkoutSession } from "./training-api";

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
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { CATEGORY_VISUAL, prescriptionLine } from "./programa-format";
import { useExerciseMutations } from "./use-training";

import { ExerciseMetricsPopover } from "@/components/dashboard/client-profile/tabs/microcycle/exercise-metrics-popover";

interface SessionRowProps {
  clientId: string;
  programId: string;
  session: WorkoutSession;
  /** "Día 1, 4" según el microciclo, o null si no está asignada. */
  dayLabel: string | null;
  isExpanded: boolean;
  dragHandleProps: Record<string, unknown>;
  /** id de session_exercises del último duplicado — muestra el chip "Copia". */
  recentlyDuplicatedExerciseId: string | null;
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  onToggle: () => void;
  onRequestRename: () => void;
  onRequestDuplicate: () => void;
  onRequestDelete: () => void;
  onAddExercise: () => void;
  onEditExercise: (exercise: WorkoutExercise) => void;
  onExerciseDuplicated: (sessionExerciseId: string) => void;
}

function SortableExerciseRow({
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

export function SessionRow({
  clientId,
  programId,
  session,
  dayLabel,
  isExpanded,
  dragHandleProps,
  recentlyDuplicatedExerciseId,
  getLogsForExercise,
  onToggle,
  onRequestRename,
  onRequestDuplicate,
  onRequestDelete,
  onAddExercise,
  onEditExercise,
  onExerciseDuplicated,
}: SessionRowProps) {
  // El tipo es de la SESIÓN, no del programa (pueden mezclarse).
  const visual = CATEGORY_VISUAL[session.sessionType];
  const mutations = useExerciseMutations(clientId, programId, session.id);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutExercise | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const exerciseKey = (exercise: WorkoutExercise) =>
    exercise.id ?? `exercise-${exercise.order}`;

  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over === null || active.id === over.id) return;

    const oldIndex = session.exercises.findIndex(
      (exercise) => exerciseKey(exercise) === active.id
    );
    const newIndex = session.exercises.findIndex(
      (exercise) => exerciseKey(exercise) === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(session.exercises, oldIndex, newIndex);
    const payload = reordered.flatMap((exercise, index) =>
      exercise.id !== undefined
        ? [{ id: exercise.id, exercise_order: index + 1 }]
        : []
    );

    if (payload.length !== reordered.length) return;

    mutations.reorderExercises.mutate(payload, {
      onError: () => setActionError("No se pudo reordenar los ejercicios"),
    });
  };

  const subtitleParts = [
    `${session.exercises.length} ${session.exercises.length === 1 ? "ejercicio" : "ejercicios"}`,
  ];

  if (dayLabel !== null) subtitleParts.push(dayLabel);

  return (
    <div className="rounded-large border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          aria-label={`Reordenar ${session.name}`}
          className="cursor-grab touch-none rounded-medium p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:cursor-grabbing"
          type="button"
          {...dragHandleProps}
        >
          <Icon icon="solar:hamburger-menu-linear" width={16} />
        </button>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${visual.square}`}
        >
          <Icon icon={visual.icon} width={18} />
        </span>
        <button
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
          type="button"
          onClick={onToggle}
        >
          <span className="truncate text-sm font-semibold text-gray-900">
            {session.name}
          </span>
          <span className="text-xs text-default-500">
            {subtitleParts.join(" · ")}
          </span>
        </button>
        <Chip className={`shrink-0 ${visual.square}`} size="sm" variant="flat">
          <span className="text-[10px] font-medium">{visual.label}</span>
        </Chip>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              aria-label={`Más acciones de ${session.name}`}
              size="sm"
              variant="light"
            >
              <Icon
                className="text-gray-600"
                icon="solar:menu-dots-bold"
                width={16}
              />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Acciones de la sesión"
            onAction={(key) => {
              if (key === "duplicate") onRequestDuplicate();
              else if (key === "rename") onRequestRename();
              else if (key === "delete") onRequestDelete();
            }}
          >
            <DropdownItem
              key="duplicate"
              startContent={<Icon icon="solar:copy-linear" width={16} />}
            >
              Duplicar
            </DropdownItem>
            <DropdownItem
              key="rename"
              startContent={<Icon icon="solar:pen-linear" width={16} />}
            >
              Renombrar
            </DropdownItem>
            <DropdownItem
              key="delete"
              className="text-danger"
              color="danger"
              startContent={
                <Icon icon="solar:trash-bin-trash-linear" width={16} />
              }
            >
              Eliminar
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <Button
          isIconOnly
          aria-label={isExpanded ? "Contraer sesión" : "Expandir sesión"}
          size="sm"
          variant="light"
          onPress={onToggle}
        >
          <Icon
            className={`text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            icon="solar:alt-arrow-down-linear"
            width={16}
          />
        </Button>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50/40 p-3">
          {session.exercises.length === 0 && (
            <p className="px-1 py-2 text-xs text-default-500">
              Esta sesión aún no tiene ejercicios.
            </p>
          )}
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleExerciseDragEnd}
          >
            <SortableContext
              items={session.exercises.map(exerciseKey)}
              strategy={verticalListSortingStrategy}
            >
              {session.exercises.map((exercise) => {
                const line = prescriptionLine(exercise, session.sessionType);
                const isCopy =
                  exercise.id !== undefined &&
                  exercise.id === recentlyDuplicatedExerciseId;

                return (
                  <SortableExerciseRow
                    key={exerciseKey(exercise)}
                    id={exerciseKey(exercise)}
                  >
                    {({ dragHandleProps: exerciseHandle }) => (
                      <div className="flex items-center gap-2 rounded-large border border-gray-200 bg-white px-2.5 py-2">
                        <button
                          aria-label={`Reordenar ${exercise.name}`}
                          className="cursor-grab touch-none rounded-medium p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:cursor-grabbing"
                          type="button"
                          {...exerciseHandle}
                        >
                          <Icon icon="solar:hamburger-menu-linear" width={14} />
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-gray-900">
                              {exercise.name}
                            </span>
                            {isCopy && (
                              <Chip
                                className="h-[18px] shrink-0 bg-amber-50 px-1 text-amber-700"
                                size="sm"
                                variant="flat"
                              >
                                <span className="text-[10px] font-medium">
                                  Copia
                                </span>
                              </Chip>
                            )}
                          </span>
                          {line.length > 0 && (
                            <span className="text-xs text-default-500 tabular-nums">
                              {line}
                            </span>
                          )}
                        </div>
                        <ExerciseMetricsPopover
                          category={exercise.category}
                          exerciseName={exercise.name}
                          logs={
                            exercise.exercise_id !== undefined
                              ? getLogsForExercise(exercise.exercise_id)
                              : []
                          }
                        />
                        <Button
                          isIconOnly
                          aria-label={`Duplicar ${exercise.name}`}
                          isDisabled={
                            exercise.id === undefined ||
                            mutations.duplicateExercise.isPending
                          }
                          size="sm"
                          title="Duplicar ejercicio"
                          variant="light"
                          onPress={() => {
                            if (exercise.id === undefined) return;
                            setActionError(null);
                            mutations.duplicateExercise.mutate(exercise.id, {
                              onSuccess: (row) => onExerciseDuplicated(row.id),
                              onError: () =>
                                setActionError(
                                  "No se pudo duplicar el ejercicio"
                                ),
                            });
                          }}
                        >
                          <Icon
                            className="text-gray-600"
                            icon="solar:copy-linear"
                            width={15}
                          />
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`Editar ${exercise.name}`}
                          size="sm"
                          title="Editar ejercicio"
                          variant="light"
                          onPress={() => onEditExercise(exercise)}
                        >
                          <Icon
                            className="text-gray-600"
                            icon="solar:pen-linear"
                            width={15}
                          />
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`Eliminar ${exercise.name}`}
                          isDisabled={exercise.id === undefined}
                          size="sm"
                          title="Eliminar ejercicio"
                          variant="light"
                          onPress={() => setDeleteTarget(exercise)}
                        >
                          <Icon
                            className="text-gray-600 hover:text-danger"
                            icon="solar:trash-bin-trash-linear"
                            width={15}
                          />
                        </Button>
                      </div>
                    )}
                  </SortableExerciseRow>
                );
              })}
            </SortableContext>
          </DndContext>

          {actionError !== null && (
            <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2 text-xs text-danger-700">
              <Icon icon="solar:danger-bold" width={14} />
              {actionError}
            </div>
          )}

          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-large border border-dashed border-gray-300 py-2 text-xs font-medium text-default-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-default-700"
            type="button"
            onClick={onAddExercise}
          >
            <Icon icon="solar:add-circle-bold" width={15} />
            Añadir ejercicio
          </button>
        </div>
      )}

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
            Eliminar ejercicio
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-700">
              ¿Eliminar <strong>{deleteTarget?.name}</strong> de esta sesión?
              Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={mutations.deleteExercise.isPending}
              variant="light"
              onPress={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={mutations.deleteExercise.isPending}
              onPress={() => {
                const id = deleteTarget?.id;

                if (id === undefined) return;
                setActionError(null);
                mutations.deleteExercise.mutate(id, {
                  onSuccess: () => setDeleteTarget(null),
                  onError: () => {
                    setDeleteTarget(null);
                    setActionError("No se pudo eliminar el ejercicio");
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
