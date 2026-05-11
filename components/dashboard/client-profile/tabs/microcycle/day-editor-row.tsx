"use client";

import type { EditorRow } from "./use-day-editor";

import { Input } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  row: EditorRow;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onChange: (patch: Partial<EditorRow>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function DayEditorRow({
  row,
  dragHandleProps,
  onChange,
  onRemove,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-md bg-white">
      {dragHandleProps ? (
        <div
          aria-label="Reordenar"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
          {...dragHandleProps}
        >
          <Icon icon="solar:hamburger-menu-linear" width={16} />
        </div>
      ) : null}

      <p className="flex-1 min-w-0 text-sm text-gray-900 truncate">
        {row.name}
      </p>

      <Input
        aria-label="Series"
        className="w-16"
        isDisabled={disabled}
        placeholder="Sets"
        size="sm"
        type="number"
        value={row.sets != null ? String(row.sets) : ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value);

          onChange({ sets: Number.isNaN(v) ? null : v });
        }}
      />

      <Input
        aria-label="Reps"
        className="w-20"
        isDisabled={disabled}
        placeholder="Reps"
        size="sm"
        value={row.reps ?? ""}
        onChange={(e) =>
          onChange({ reps: e.target.value === "" ? null : e.target.value })
        }
      />

      <Input
        aria-label="Peso en kilos"
        className="w-20"
        endContent={<span className="text-[11px] text-gray-400">kg</span>}
        isDisabled={disabled}
        placeholder="Kg"
        size="sm"
        step="0.5"
        type="number"
        value={row.weightKg != null ? String(row.weightKg) : ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseFloat(e.target.value);

          onChange({ weightKg: Number.isNaN(v) ? null : v });
        }}
      />

      <button
        aria-label={`Eliminar ${row.name}`}
        className="shrink-0 text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
        disabled={disabled}
        type="button"
        onClick={onRemove}
      >
        <Icon icon="solar:trash-bin-trash-linear" width={16} />
      </button>
    </div>
  );
}
