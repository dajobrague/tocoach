// Slider de duración del microciclo (1–28 días). Reemplaza al input
// numérico por un range nativo + warning ámbar inline cuando bajar el
// slider implica perder asignaciones existentes (Trabajo 3 §5.6).

import { Icon } from "@iconify/react";

const MIN_DAYS = 1;
const MAX_DAYS = 28;

interface Props {
  value: number;
  /** day_index más alto con asignación (0 si nada asignado). */
  maxAssignedDay: number;
  isDisabled?: boolean;
  onChange: (next: number) => void;
}

export default function MicrocycleDurationSelector({
  value,
  maxAssignedDay,
  isDisabled = false,
  onChange,
}: Props) {
  const willTruncate = maxAssignedDay > value;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <label
          className="text-xs font-semibold uppercase text-gray-500"
          htmlFor="microcycle-duration"
        >
          Duración del ciclo
        </label>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {value} {value === 1 ? "día" : "días"}
        </span>
      </div>
      <input
        className="w-full accent-blue-500 disabled:opacity-50"
        disabled={isDisabled}
        id="microcycle-duration"
        max={MAX_DAYS}
        min={MIN_DAYS}
        step={1}
        type="range"
        value={value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);

          if (!Number.isFinite(parsed)) return;
          onChange(Math.max(MIN_DAYS, Math.min(MAX_DAYS, parsed)));
        }}
      />
      {willTruncate ? (
        <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800">
          <Icon
            className="text-warning-700 shrink-0 mt-0.5"
            icon="solar:danger-triangle-bold"
            width={14}
          />
          <span>
            {value < maxAssignedDay
              ? `Vas a perder las asignaciones de los días ${value + 1}${
                  maxAssignedDay > value + 1 ? `–${maxAssignedDay}` : ""
                } al guardar.`
              : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
