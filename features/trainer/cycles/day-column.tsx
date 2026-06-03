"use client";

import type { CycleSlot } from "./cycle-api";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SlotCard } from "./slot-card";

interface DayColumnProps {
  dayIndex: number;
  slots: CycleSlot[];
  disabled: boolean;
  onAddSlot: () => void;
  onAddOption: (slotId: string) => void;
  onRemoveSlot: (slotId: string) => void;
  onRemoveOption: (slotId: string, optionId: string) => void;
  onRelabelSlot: (slotId: string, label: string) => void;
}

/** One day of the cycle: a sortable column of meal slots + an "add slot" action. */
export function DayColumn({
  dayIndex,
  slots,
  disabled,
  onAddSlot,
  onAddOption,
  onRemoveSlot,
  onRemoveOption,
  onRelabelSlot,
}: DayColumnProps) {
  return (
    <div
      className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-gray-100/60 p-3"
      data-day-index={dayIndex}
      data-testid="day-column"
    >
      <h3 className="text-sm font-bold text-gray-700">Día {dayIndex + 1}</h3>

      <SortableContext
        items={slots.map((slot) => slot.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              disabled={disabled}
              slot={slot}
              onAddOption={() => onAddOption(slot.id)}
              onRelabel={(label) => onRelabelSlot(slot.id, label)}
              onRemoveOption={(optionId) => onRemoveOption(slot.id, optionId)}
              onRemoveSlot={() => onRemoveSlot(slot.id)}
            />
          ))}
        </div>
      </SortableContext>

      <Button
        isDisabled={disabled}
        size="sm"
        startContent={<Icon icon="solar:add-square-linear" width={16} />}
        variant="flat"
        onPress={onAddSlot}
      >
        Añadir comida
      </Button>
    </div>
  );
}
