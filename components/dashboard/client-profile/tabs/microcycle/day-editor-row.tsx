"use client";

import type { EditorRow, EditorSetRow } from "./use-day-editor";

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  row: EditorRow;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onChange: (patch: Partial<EditorRow>) => void;
  onRemove: () => void;
  onSwitchToPerSet: () => void;
  onSwitchToUniform: () => void;
  onUpdateSet: (setKey: string, patch: Partial<EditorSetRow>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
  disabled?: boolean;
}

export function DayEditorRow({
  row,
  dragHandleProps,
  onChange,
  onRemove,
  onSwitchToPerSet,
  onSwitchToUniform,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2 border border-gray-200 rounded-md bg-white">
      <div className="flex items-center gap-2">
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

        <button
          aria-label={
            row.mode === "uniform"
              ? "Personalizar por serie"
              : "Volver a uniforme"
          }
          className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
          disabled={disabled}
          title={
            row.mode === "uniform"
              ? "Personalizar por serie"
              : "Volver a uniforme"
          }
          type="button"
          onClick={() =>
            row.mode === "uniform" ? onSwitchToPerSet() : onSwitchToUniform()
          }
        >
          <Icon
            icon={
              row.mode === "uniform"
                ? "solar:settings-linear"
                : "solar:refresh-linear"
            }
            width={13}
          />
          {row.mode === "uniform" ? "Por serie" : "Uniforme"}
        </button>

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

      {row.mode === "uniform" ? (
        <div className="flex items-center gap-2 ml-6">
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
          <span className="text-xs text-gray-400">×</span>
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
          <span className="text-xs text-gray-400">@</span>
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
              const v =
                e.target.value === "" ? null : parseFloat(e.target.value);

              onChange({ weightKg: Number.isNaN(v) ? null : v });
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 ml-6">
          {row.setsDetail.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                {s.setNumber}
              </span>
              <Input
                aria-label={`Reps serie ${s.setNumber}`}
                className="w-20"
                isDisabled={disabled}
                placeholder="Reps"
                size="sm"
                value={s.reps ?? ""}
                onChange={(e) =>
                  onUpdateSet(s.key, {
                    reps: e.target.value === "" ? null : e.target.value,
                  })
                }
              />
              <span className="text-xs text-gray-400">×</span>
              <Input
                aria-label={`Peso serie ${s.setNumber}`}
                className="w-20"
                endContent={
                  <span className="text-[11px] text-gray-400">kg</span>
                }
                isDisabled={disabled}
                placeholder="Kg"
                size="sm"
                step="0.5"
                type="number"
                value={s.weightKg != null ? String(s.weightKg) : ""}
                onChange={(e) => {
                  const v =
                    e.target.value === "" ? null : parseFloat(e.target.value);

                  onUpdateSet(s.key, {
                    weightKg: Number.isNaN(v) ? null : v,
                  });
                }}
              />
              <button
                aria-label={`Eliminar serie ${s.setNumber}`}
                className="shrink-0 text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                disabled={disabled || row.setsDetail.length <= 1}
                type="button"
                onClick={() => onRemoveSet(s.key)}
              >
                <Icon icon="solar:close-circle-linear" width={14} />
              </button>
            </div>
          ))}
          <Button
            className="self-start"
            isDisabled={disabled}
            size="sm"
            startContent={<Icon icon="solar:add-circle-linear" width={14} />}
            variant="flat"
            onPress={onAddSet}
          >
            Añadir set
          </Button>
        </div>
      )}
    </div>
  );
}
