"use client";

import type { PrescribedExercise } from "./types";

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
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef } from "react";

import { DayEditorExercisePicker } from "./day-editor-exercise-picker";
import { DayEditorRow } from "./day-editor-row";
import { DayEditorSessionPicker } from "./day-editor-session-picker";
import { useDayEditor, type EditorRow } from "./use-day-editor";

function SortableEditorItem({
  id,
  children,
}: {
  id: string;
  children: (p: { dragHandleProps: Record<string, any> }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

interface Props {
  clientId: string;
  scheduledDate: string;
  initialPrescribed: PrescribedExercise[];
  initialSessionId: string | null;
  /** Whether an override row already exists (controls "Restaurar al template" visibility). */
  hasExistingOverride: boolean;
  onClose: () => void;
  /** Called after a successful save or reset so the parent can invalidate cache. */
  onCommitted: () => void;
}

export function DayEditor({
  clientId,
  scheduledDate,
  initialPrescribed,
  initialSessionId,
  hasExistingOverride,
  onClose,
  onCommitted,
}: Props) {
  const editor = useDayEditor({
    clientId,
    scheduledDate,
    initialPrescribed,
    initialSessionId,
    onSaved: () => {
      onCommitted();
      onClose();
    },
  });

  // Aborts in-flight session-pick fetches when the editor closes/unmounts
  // o cuando cambia clientId/scheduledDate (vía key remount). Antes el
  // fetch podía resolverse después del unmount y disparar
  // replaceFromPrescribed contra estado huérfano.
  const sessionPickAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      sessionPickAbortRef.current?.abort();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = editor.rows.findIndex((r) => r.key === active.id);
    const newIndex = editor.rows.findIndex((r) => r.key === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(editor.rows, oldIndex, newIndex);

    editor.reorderRows(next);
  };

  const handleSessionPick = (nextSessionId: string) => {
    if (editor.hasChanges) {
      const ok = window.confirm(
        "Cambiar de sesión descartará tus cambios sin guardar. ¿Continuar?"
      );

      if (!ok) return;
    }

    // Cancela cualquier pick previo en vuelo: si el usuario abre el
    // dropdown y elige rápido dos sesiones, la primera no debe ganar la
    // carrera y pisar las exercises de la segunda.
    sessionPickAbortRef.current?.abort();
    const controller = new AbortController();

    sessionPickAbortRef.current = controller;

    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/programs`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (!res.ok) {
          editor.setError("No se pudieron cargar las sesiones del programa.");

          return;
        }
        const json = await res.json();

        if (controller.signal.aborted) return;
        if (!json.success) {
          editor.setError(json.error ?? "Error al cargar sesiones.");

          return;
        }

        let pickedExercises: PrescribedExercise[] = [];
        let sessionFound = false;

        for (const program of json.programs ?? []) {
          for (const sess of program.sessions ?? []) {
            if (sess.id === nextSessionId) {
              sessionFound = true;
              pickedExercises = (sess.exercises ?? []).map((e: any) => ({
                // El transformer expone `exercise_id` (UUID real) y `id`
                // (session_exercises row id). exerciseId debe ser el UUID.
                exerciseId: e.exercise_id ?? e.exerciseId ?? e.id,
                name: e.name,
                category: e.category ?? "strength",
                prescribedSets: e.sets ?? 0,
                prescribedReps: e.reps ?? null,
                // NOTA: WorkoutExercise actualmente no expone `weight_kg`
                // (ver lib/utils/training-utils.ts:330). El swap llega
                // sin peso prescripto hasta que el transformer lo
                // surface. Mejor null que adivinar.
                prescribedWeightKg: e.weight_kg ?? null,
                perSet: [],
              }));
              break;
            }
          }
          if (sessionFound) break;
        }

        if (!sessionFound) {
          editor.setError(
            "La sesión seleccionada ya no existe. Recargá el editor."
          );

          return;
        }

        editor.replaceFromPrescribed(pickedExercises, nextSessionId);
      } catch (err) {
        // AbortError es el caso esperado al cancelar — no mostrar error.
        if (err instanceof DOMException && err.name === "AbortError") return;
        editor.setError("Error de conexión al cargar la sesión.");
      }
    })();
  };

  const handleReset = async () => {
    const ok = window.confirm(
      "¿Quitar el plan personalizado de este día? Volverá a usar el template."
    );

    if (!ok) return;

    await editor.reset();
  };

  const showRestore = hasExistingOverride;

  return (
    <section className="rounded-lg border-2 border-blue-300 bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50/40 border-b border-blue-200 flex-wrap">
        <div className="flex items-center gap-2">
          <DayEditorSessionPicker
            clientId={clientId}
            disabled={editor.saving || editor.resetting}
            value={editor.sessionId}
            onSelect={handleSessionPick}
          />
        </div>

        <div className="flex items-center gap-2">
          {showRestore ? (
            <Button
              isDisabled={editor.saving || editor.resetting}
              isLoading={editor.resetting}
              size="sm"
              variant="flat"
              onPress={handleReset}
            >
              Restaurar al template
            </Button>
          ) : null}
          <Button
            isDisabled={editor.saving || editor.resetting}
            size="sm"
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={
              !editor.isValid ||
              !editor.hasChanges ||
              editor.saving ||
              editor.resetting
            }
            isLoading={editor.saving}
            size="sm"
            onPress={() => {
              void editor.save();
            }}
          >
            Guardar
          </Button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-3">
        <p className="text-[11px] text-blue-700 inline-flex items-center gap-1">
          <Icon icon="solar:info-circle-linear" width={12} />
          Editando — los cambios se aplicarán solo al {scheduledDate}.
        </p>

        {editor.error ? (
          <div className="text-[11px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-2 py-1">
            {editor.error}
          </div>
        ) : null}

        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={editor.rows.map((r) => r.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {editor.rows.map((row: EditorRow) => (
                <SortableEditorItem key={row.key} id={row.key}>
                  {({ dragHandleProps }) => (
                    <DayEditorRow
                      disabled={editor.saving || editor.resetting}
                      dragHandleProps={dragHandleProps}
                      row={row}
                      onAddSet={() => editor.addSetDetail(row.key)}
                      onChange={(patch) => editor.updateRow(row.key, patch)}
                      onRemove={() => editor.removeRow(row.key)}
                      onRemoveSet={(setKey) =>
                        editor.removeSetDetail(row.key, setKey)
                      }
                      onSwitchToPerSet={() => editor.switchToPerSet(row.key)}
                      onSwitchToUniform={() => editor.switchToUniform(row.key)}
                      onUpdateSet={(setKey, patch) =>
                        editor.updateSetDetail(row.key, setKey, patch)
                      }
                    />
                  )}
                </SortableEditorItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {editor.rows.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Sin ejercicios. Añade uno para empezar.
          </p>
        ) : null}

        <DayEditorExercisePicker
          disabled={editor.saving || editor.resetting}
          onPick={(ex) =>
            editor.addRow({
              exerciseId: ex.id,
              name: ex.name,
              category: ex.category,
            })
          }
        />
      </div>
    </section>
  );
}
