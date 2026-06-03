"use client";

import type { DayGroup } from "./cycle-api";
import type { DragEndEvent } from "@dnd-kit/core";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import { DayColumn } from "./day-column";

interface CycleGridProps {
  days: DayGroup[];
  disabled: boolean;
  onAddSlot: (dayIndex: number) => void;
  onAddOption: (slotId: string) => void;
  onRemoveSlot: (slotId: string) => void;
  onRemoveOption: (slotId: string, optionId: string) => void;
  onRelabelSlot: (slotId: string, label: string) => void;
  /** Persist a day's new slot order (ids in their new order). */
  onReorder: (dayIndex: number, orderedSlotIds: string[]) => void;
}

/**
 * The days × slots grid. A single DndContext spans the grid; each day is its own
 * SortableContext, so reorder is within a day (we persist the day's new order).
 */
export function CycleGrid({
  days,
  disabled,
  onAddSlot,
  onAddOption,
  onRemoveSlot,
  onRemoveOption,
  onRelabelSlot,
  onReorder,
}: CycleGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;

    if (over === null || active.id === over.id) {
      return;
    }

    const day = days.find((group) =>
      group.slots.some((slot) => slot.id === active.id)
    );

    if (day === undefined) {
      return;
    }

    const ids = day.slots.map((slot) => slot.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);

    if (from === -1 || to === -1) {
      return;
    }

    onReorder(day.dayIndex, arrayMove(ids, from, to));
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="cycle-grid">
        {days.map((day) => (
          <DayColumn
            key={day.dayIndex}
            dayIndex={day.dayIndex}
            disabled={disabled}
            slots={day.slots}
            onAddOption={onAddOption}
            onAddSlot={() => onAddSlot(day.dayIndex)}
            onRelabelSlot={onRelabelSlot}
            onRemoveOption={onRemoveOption}
            onRemoveSlot={onRemoveSlot}
          />
        ))}
      </div>
    </DndContext>
  );
}
