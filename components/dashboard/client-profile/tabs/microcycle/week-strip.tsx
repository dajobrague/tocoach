"use client";

// Tira semanal de Seguimiento — misma anatomía de celda que la grilla del
// mes (pedido de David: consistencia): número arriba a la izquierda (azul si
// es hoy), chip de estado abajo (compartido vía DayCellChip), selección con
// anillo azul, hover sutil. La etiqueta del día de la semana (LUN…) vive
// dentro de la celda porque la tira no tiene fila de cabecera como el mes.

import type { DayMetrics } from "./types";

import { Icon } from "@iconify/react";

import { DayCellChip, dayCellInfo } from "./day-cell-chip";

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

interface Props {
  days: DayMetrics[];
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Arrow-key navigation handler. Buttons attach onKeyDown to call this. */
  onArrowNav?: (direction: "left" | "right") => void;
  /** Previous week button (rendered to the left of the strip). */
  onPrevWeek?: () => void;
  /** Next week button (rendered to the right of the strip). */
  onNextWeek?: () => void;
}

export function WeekStrip({
  days,
  selectedDate,
  onSelect,
  onArrowNav,
  onPrevWeek,
  onNextWeek,
}: Props) {
  return (
    <div className="flex items-stretch gap-2">
      {onPrevWeek ? (
        <button
          aria-label="Semana anterior"
          className="flex w-9 shrink-0 items-center justify-center rounded-large border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          type="button"
          onClick={onPrevWeek}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={18} />
        </button>
      ) : null}

      <div
        aria-label="Días de la semana con adherencia"
        className="grid min-w-0 flex-1 grid-cols-7 gap-1.5"
        role="grid"
      >
        {days.map((day, idx) => {
          const isSelected = day.date === selectedDate;
          const dayNumber = parseInt(day.date.split("-")[2] ?? "0");
          const isRest = day.sessions.length === 0;
          const { statusWord, sessionName } = dayCellInfo(day);

          const ariaLabel = isRest
            ? `${DAY_LABELS[idx]} ${dayNumber}, día de descanso`
            : `${DAY_LABELS[idx]} ${dayNumber}, ${
                sessionName ?? "sesión"
              }, ${statusWord.length > 0 ? statusWord : "sin actividad aún"}`;

          return (
            <button
              key={day.date}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={ariaLabel}
              aria-selected={isSelected}
              className={[
                "relative flex h-[4.5rem] flex-col items-start gap-1 rounded-large border p-1.5 text-left transition-all",
                isSelected
                  ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
              ].join(" ")}
              role="gridcell"
              type="button"
              onClick={() => onSelect(day.date)}
              onKeyDown={(e) => {
                if (!onArrowNav) return;
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  onArrowNav("left");
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  onArrowNav("right");
                }
              }}
            >
              <span className="flex items-baseline gap-1.5">
                <span
                  className={[
                    "text-[11px] font-semibold tabular-nums",
                    day.isToday ? "text-blue-600" : "text-gray-700",
                  ].join(" ")}
                >
                  {dayNumber}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  {DAY_LABELS[idx]}
                </span>
              </span>

              <span className="mt-auto flex w-full flex-col gap-0.5">
                <DayCellChip day={day} />
              </span>
            </button>
          );
        })}
      </div>

      {onNextWeek ? (
        <button
          aria-label="Semana siguiente"
          className="flex w-9 shrink-0 items-center justify-center rounded-large border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          type="button"
          onClick={onNextWeek}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={18} />
        </button>
      ) : null}
    </div>
  );
}
