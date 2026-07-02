"use client";

import type { DayGroup } from "./cycle-api";
import type { DayStatus } from "./cycle-math";

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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { dayStatus, dayTotals } from "./cycle-math";

interface DaySelectorProps {
  days: DayGroup[];
  selectedDay: number;
  onSelect: (dayIndex: number) => void;
  /** When set, tiles show a hover "×" (remove) and a trailing "+" (add) tile. */
  onRequestRemoveDay?: (dayIndex: number) => void;
  onRequestAddDay?: () => void;
  /** When set, tiles can be dragged to reorder; days renumber on drop. */
  onReorderDay?: (fromIndex: number, toIndex: number) => void;
  /** Archived cycles are read-only: hide the add/remove/reorder affordances. */
  disabled?: boolean;
}

interface DaySummary {
  dayIndex: number;
  status: DayStatus;
  kcal: number;
}

const STATUS_ICON: Record<DayStatus, { icon: string; className: string }> = {
  complete: { icon: "solar:check-circle-bold", className: "text-emerald-500" },
  incomplete: {
    icon: "solar:check-circle-linear",
    className: "text-amber-500",
  },
  empty: { icon: "solar:check-circle-linear", className: "text-default-300" },
};

/** Sortable wrapper for one day tile; hands the tile its drag-handle props. */
function SortableDay({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
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
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} className="group relative" style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export function DaySelector({
  days,
  selectedDay,
  onSelect,
  onRequestRemoveDay,
  onRequestAddDay,
  onReorderDay,
  disabled = false,
}: DaySelectorProps) {
  const summaries = useMemo<DaySummary[]>(
    () =>
      days.map((day) => ({
        dayIndex: day.dayIndex,
        status: dayStatus(day.slots),
        kcal: dayTotals(day.slots).kcal,
      })),
    [days]
  );

  const sensors = useSensors(
    // A small drag threshold so a plain click still selects the day.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Removing is blocked when a single day remains (a cycle keeps at least one).
  const canRemove =
    disabled === false &&
    onRequestRemoveDay !== undefined &&
    summaries.length > 1;
  const canReorder =
    disabled === false && onReorderDay !== undefined && summaries.length > 1;

  const renderTile = (
    summary: DaySummary,
    dragHandleProps?: Record<string, unknown>
  ) => {
    const selected = summary.dayIndex === selectedDay;
    const status = STATUS_ICON[summary.status];

    return (
      <>
        <button
          aria-pressed={selected}
          className={`flex h-full w-full items-center justify-between gap-1.5 rounded-large border px-3 py-3 text-left transition-all ${
            canReorder ? "cursor-grab select-none active:cursor-grabbing" : ""
          } ${
            selected
              ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500"
              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
          }`}
          type="button"
          onClick={() => onSelect(summary.dayIndex)}
          {...dragHandleProps}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-gray-900">
              Día {summary.dayIndex + 1}
            </span>
            <span className="truncate text-xs text-default-500 tabular-nums">
              {summary.status === "empty"
                ? "Sin comidas"
                : `${summary.kcal} kcal`}
            </span>
          </span>
          <Icon
            className={`shrink-0 ${status.className}`}
            icon={status.icon}
            width={20}
          />
        </button>

        {canRemove ? (
          <button
            aria-label={`Quitar Día ${summary.dayIndex + 1}`}
            className="absolute right-1 top-1 z-10 flex items-center justify-center rounded-full text-sm font-bold leading-none text-gray-400 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
            style={{
              height: 16,
              width: 16,
              minHeight: 0,
              minWidth: 0,
              padding: 0,
            }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRequestRemoveDay?.(summary.dayIndex);
            }}
          >
            ×
          </button>
        ) : null}
      </>
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over === null || active.id === over.id) return;

    const from = Number(active.id);
    const to = Number(over.id);

    if (Number.isNaN(from) || Number.isNaN(to)) return;

    onReorderDay?.(from, to);
  };

  return (
    <div className="flex items-stretch gap-3" data-testid="day-selector">
      <div className="grid flex-1 auto-cols-fr grid-flow-col gap-2">
        {canReorder ? (
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={summaries.map((s) => String(s.dayIndex))}
              strategy={horizontalListSortingStrategy}
            >
              {summaries.map((summary) => (
                <SortableDay
                  key={summary.dayIndex}
                  id={String(summary.dayIndex)}
                >
                  {(handle) => renderTile(summary, handle)}
                </SortableDay>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          summaries.map((summary) => (
            <div key={summary.dayIndex} className="group relative">
              {renderTile(summary)}
            </div>
          ))
        )}
      </div>

      {disabled === false && onRequestAddDay !== undefined ? (
        <button
          aria-label="Agregar día"
          className="flex shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-large border border-dashed border-gray-300 px-4 text-xs font-medium text-default-500 transition-all hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600"
          type="button"
          onClick={onRequestAddDay}
        >
          <Icon icon="solar:add-circle-linear" width={22} />
          Día
        </button>
      ) : null}
    </div>
  );
}
