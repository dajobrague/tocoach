"use client";

import type { CycleSlot } from "./cycle-api";

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";

import { resolveRelabel } from "./cycle-api";
import { OptionChip } from "./option-chip";

interface SlotCardProps {
  slot: CycleSlot;
  disabled: boolean;
  onAddOption: () => void;
  onRemoveSlot: () => void;
  onRemoveOption: (optionId: string) => void;
  onRelabel: (label: string) => void;
}

const DEFAULT_LABEL = "Comida";

/** A single meal slot: a sortable card with an inline-editable label. */
export function SlotCard({
  slot,
  disabled,
  onAddOption,
  onRemoveSlot,
  onRemoveOption,
  onRelabel,
}: SlotCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipBlurRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const displayLabel = slot.label.length > 0 ? slot.label : DEFAULT_LABEL;

  function startEditing(): void {
    if (disabled) return;

    setDraft(slot.label);
    setEditing(true);
  }

  function commit(): void {
    const patch = resolveRelabel(draft, slot.label);

    if (patch !== null) {
      onRelabel(patch.label);
    }

    setEditing(false);
  }

  function cancel(): void {
    skipBlurRef.current = true;
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
      data-slot-id={slot.id}
      data-testid="slot-card"
      style={style}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <button
            aria-label="Reordenar"
            className="shrink-0 cursor-grab text-default-300 hover:text-default-500"
            type="button"
            {...attributes}
            {...listeners}
          >
            <Icon icon="solar:menu-dots-bold" width={16} />
          </button>

          {editing ? (
            <Input
              // Focusing the field the trainer just opened for inline rename is
              // the expected UX; it only mounts on an explicit click.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              aria-label="Nombre de la comida"
              className="max-w-[10rem]"
              data-testid="slot-label-input"
              size="sm"
              value={draft}
              onBlur={() => {
                if (skipBlurRef.current) {
                  skipBlurRef.current = false;

                  return;
                }

                commit();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                }
              }}
              onValueChange={setDraft}
            />
          ) : (
            <button
              aria-label={`Renombrar ${displayLabel}`}
              className="group flex min-w-0 items-center gap-1"
              data-testid="slot-label"
              disabled={disabled}
              type="button"
              onClick={startEditing}
            >
              <span className="truncate text-sm font-semibold text-gray-900">
                {displayLabel}
              </span>
              {disabled ? null : (
                <Icon
                  className="shrink-0 text-default-300 opacity-0 transition-opacity group-hover:opacity-100"
                  icon="solar:pen-linear"
                  width={13}
                />
              )}
            </button>
          )}
        </div>

        <button
          aria-label="Eliminar slot"
          className="shrink-0 text-default-400 hover:text-danger"
          type="button"
          onClick={onRemoveSlot}
        >
          <Icon icon="solar:trash-bin-trash-linear" width={15} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {slot.options.map((option) => (
          <OptionChip
            key={option.id}
            option={option}
            onRemove={() => onRemoveOption(option.id)}
          />
        ))}
      </div>

      <Button
        className="justify-start"
        isDisabled={disabled}
        size="sm"
        startContent={<Icon icon="solar:add-circle-linear" width={16} />}
        variant="light"
        onPress={onAddOption}
      >
        Añadir opción
      </Button>
    </div>
  );
}
