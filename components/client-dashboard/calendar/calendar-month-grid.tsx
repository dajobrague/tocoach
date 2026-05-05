// Vista mensual: 6×7 grid con días anteriores/siguientes para completar
// las semanas. Cada celda con datos muestra punto indicador (color por
// session_type) + icono ✓ si todos los ejercicios fueron completados.

import type { CalendarEntrySession } from "./hooks/use-calendar-entries";

import { Icon } from "@iconify/react";

import { DAY_NAMES_SHORT, dotColor, isFullyCompleted } from "./calendar-shared";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface Props {
  monthDate: Date;
  todayYmd: string;
  selectedDate: string | null;
  byDate: Map<string, CalendarEntrySession[]>;
  onSelectDate: (date: string | null) => void;
}

export function CalendarMonthGrid({
  monthDate,
  todayYmd,
  selectedDate,
  byDate,
  onSelectDate,
}: Props) {
  const cells = buildMonthCells(monthDate);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-default-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          const sessions = byDate.get(cell.date) ?? [];
          const hasSessions = sessions.length > 0;
          const isToday = cell.date === todayYmd;
          const isSelected = cell.date === selectedDate;
          const allDone = hasSessions && sessions.every(isFullyCompleted);

          return (
            <button
              key={`${cell.date}-${idx}`}
              className={cellClass({
                inMonth: cell.inCurrentMonth,
                isToday,
                isSelected,
                hasSessions,
              })}
              type="button"
              onClick={() =>
                hasSessions
                  ? onSelectDate(isSelected ? null : cell.date)
                  : undefined
              }
            >
              <span
                className={`text-sm ${isToday ? "font-bold text-white" : ""}`}
              >
                {cell.day}
              </span>
              {hasSessions ? (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from(new Set(sessions.map((s) => s.session_type)))
                    .slice(0, 3)
                    .map((t, i) => (
                      <span
                        key={`${t ?? "none"}-${i}`}
                        className={`h-1 w-1 rounded-full ${dotColor(t)}`}
                      />
                    ))}
                  {allDone ? (
                    <Icon
                      className="text-success ml-0.5"
                      icon="solar:check-circle-bold"
                      width={10}
                    />
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MonthCell {
  date: string;
  day: number;
  inCurrentMonth: boolean;
}

function buildMonthCells(monthDate: Date): MonthCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDow = firstDay.getDay();
  const cells: MonthCell[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();

  for (let i = startingDow - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;

    cells.push({
      date: getLocalYmd(new Date(year, month - 1, day)),
      day,
      inCurrentMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: getLocalYmd(new Date(year, month, day)),
      day,
      inCurrentMonth: true,
    });
  }
  const remaining = 42 - cells.length;

  for (let day = 1; day <= remaining; day++) {
    cells.push({
      date: getLocalYmd(new Date(year, month + 1, day)),
      day,
      inCurrentMonth: false,
    });
  }

  return cells;
}

function cellClass({
  inMonth,
  isToday,
  isSelected,
  hasSessions,
}: {
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasSessions: boolean;
}): string {
  const base =
    "aspect-square rounded-lg p-1 flex flex-col items-center justify-center transition-all relative";
  const text = inMonth ? "text-foreground" : "text-default-300";
  const bg = isToday
    ? "bg-primary"
    : isSelected
      ? "bg-primary/20"
      : hasSessions
        ? "bg-default-100 hover:bg-default-200"
        : "";
  const cursor = hasSessions ? "cursor-pointer" : "cursor-default";

  return `${base} ${text} ${bg} ${cursor}`.trim();
}
