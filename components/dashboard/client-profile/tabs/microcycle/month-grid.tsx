"use client";

// Vista de MES de Seguimiento (rediseño, rebanada 1 — pedido de José:
// "una vista de calendario podría tener más sentido").
// Receta visual del calendario de nutrición (calendar-section): celdas
// 4.5rem redondeadas, número azul para hoy, fuera-de-mes al 40%, futuro
// atenuado con chip punteado ("recomendación, no hecho"), leyenda con los
// chips reales. Semántica de estado del training: Hecho / Empezado /
// Sin hacer (misma clasificación que la semana — comparten derivación).

import type { DayMetrics } from "./types";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { classificationLabel } from "./adherence";
import { DayCellChip } from "./day-cell-chip";
import { dayLabelClassification } from "./day-label";

import {
  buildMonthGrid,
  dayNumber,
  monthTitle,
} from "@/features/trainer/cycles/calendar-helpers";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  /** Cualquier fecha "YYYY-MM-DD" dentro del mes a mostrar. */
  monthYmd: string;
  /** DayMetrics por fecha (grilla completa); null mientras carga. */
  byDate: Map<string, DayMetrics> | null;
  selectedDate: string;
  todayYmd: string;
  onSelect: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function MonthGrid({
  monthYmd,
  byDate,
  selectedDate,
  todayYmd,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
}: Props) {
  const grid = buildMonthGrid(monthYmd);

  return (
    <div className="rounded-large border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold capitalize text-gray-900">
          {monthTitle(monthYmd)}
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="flat" onPress={onToday}>
            Hoy
          </Button>
          <Button
            isIconOnly
            aria-label="Mes anterior"
            size="sm"
            variant="light"
            onPress={onPrevMonth}
          >
            <Icon icon="solar:alt-arrow-left-linear" width={18} />
          </Button>
          <Button
            isIconOnly
            aria-label="Mes siguiente"
            size="sm"
            variant="light"
            onPress={onNextMonth}
          >
            <Icon icon="solar:alt-arrow-right-linear" width={18} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 px-1 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-default-400">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell) => {
              const day = byDate?.get(cell.date) ?? null;
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === todayYmd;
              const isRest = day !== null && day.sessions.length === 0;
              const statusWord =
                day !== null
                  ? classificationLabel(dayLabelClassification(day))
                  : "";

              return (
                <button
                  key={cell.date}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${new Date(`${cell.date}T00:00:00`).toLocaleDateString(
                    "es-ES",
                    { weekday: "long", day: "numeric", month: "long" }
                  )}${statusWord ? `, ${statusWord}` : isRest ? ", descanso" : ""}`}
                  aria-pressed={isSelected}
                  className={[
                    "relative flex h-[4.5rem] flex-col items-start gap-1 rounded-large border p-1.5 text-left transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
                    cell.inMonth ? "" : "opacity-40",
                  ].join(" ")}
                  type="button"
                  onClick={() => onSelect(cell.date)}
                >
                  <span
                    className={[
                      "text-[11px] font-semibold tabular-nums",
                      isToday ? "text-blue-600" : "text-gray-700",
                    ].join(" ")}
                  >
                    {dayNumber(cell.date)}
                  </span>

                  <span className="mt-auto flex w-full flex-col gap-0.5">
                    {day !== null ? <DayCellChip day={day} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Leyenda con los chips reales, como el calendario de nutrición. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-[11px] text-default-500">
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">
            Hecho
          </span>
          entrenó (o lo marcó completo)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
            Empezado
          </span>
          registró algo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-semibold text-gray-500">
            Sin hacer
          </span>
          tenía sesión y no entrenó
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500">
            Sesión
          </span>
          programada a futuro
        </span>
      </div>
    </div>
  );
}
