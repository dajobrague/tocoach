// Slider custom de duración del microciclo (1–28 días). Construido a mano
// (no usamos HeroUI Slider) para que el aspecto coincida exactamente con
// el wireframe: track de 6px gris, fill azul, thumb circular blanco con
// borde azul, marks numéricos abajo (1, 7, 14, 21, 28).
//
// El <input type="range"> está superpuesto invisible para capturar el
// drag/teclado/a11y. El thumb visual es un <div> que se posiciona via
// style en función de `value`.

import { Icon } from "@iconify/react";

const MIN_DAYS = 1;
const MAX_DAYS = 28;
const MARK_VALUES = [1, 7, 14, 21, 28];

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
  const pct = ((value - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * 100;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wide">
          Duración del ciclo
        </span>
        <span className="text-base font-semibold text-gray-900 tabular-nums">
          {value} {value === 1 ? "día" : "días"}
        </span>
      </div>

      <div className="relative h-5 select-none">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gray-200 rounded-full" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full ${
            isDisabled ? "bg-gray-400" : "bg-blue-600"
          }`}
          style={{ width: `${pct}%` }}
        />
        <div
          className={`absolute top-1/2 w-[18px] h-[18px] bg-white border-2 rounded-full pointer-events-none shadow-sm ${
            isDisabled ? "border-gray-400" : "border-blue-600"
          }`}
          style={{
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
        <input
          aria-label="Duración del ciclo en días"
          className={`absolute inset-0 w-full h-full opacity-0 ${
            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
          disabled={isDisabled}
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
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 tabular-nums px-0">
        {MARK_VALUES.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>

      {willTruncate ? (
        <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800">
          <Icon
            className="text-warning-700 shrink-0 mt-0.5"
            icon="solar:danger-triangle-bold"
            width={14}
          />
          <span>
            Vas a perder las asignaciones de los días {value + 1}
            {maxAssignedDay > value + 1 ? `–${maxAssignedDay}` : ""} al guardar.
          </span>
        </div>
      ) : null}
    </div>
  );
}
