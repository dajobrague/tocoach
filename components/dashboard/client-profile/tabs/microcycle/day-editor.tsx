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

    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/programs`);
        const json = await res.json();

        if (!json.success) return;

        let pickedExercises: PrescribedExercise[] = [];

        for (const program of json.programs ?? []) {
          for (const sess of program.sessions ?? []) {
            if (sess.id === nextSessionId) {
              pickedExercises = (sess.exercises ?? []).map((e: any) => ({
                exerciseId: e.exercise_id ?? e.exerciseId ?? e.id,
                name: e.name,
                category: e.category ?? "strength",
                prescribedSets: e.sets ?? 0,
                prescribedReps: e.reps ?? null,
                prescribedWeightKg: e.weight_kg ?? null,
                perSet: [],
              }));
              break;
            }
          }
        }

        editor.replaceFromPrescribed(pickedExercises, nextSessionId);
      } catch {
        /* swallow — at worst the editor keeps its current rows */
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
                      onChange={(patch) => editor.updateRow(row.key, patch)}
                      onRemove={() => editor.removeRow(row.key)}
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
