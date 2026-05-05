// Vista quincenal: 14 días empezando en startDate, en 2 filas de 7. Cada
// celda más alta que la mensual; muestra día de la semana, número, y un
// resumen mini de la sesión (chip pequeño con label de tipo).

import type { CalendarEntrySession } from "./hooks/use-calendar-entries";

import { Icon } from "@iconify/react";

import { DAY_NAMES_SHORT, dotColor, isFullyCompleted } from "./calendar-shared";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface Props {
  startDate: Date;
  todayYmd: string;
  selectedDate: string | null;
  byDate: Map<string, CalendarEntrySession[]>;
  onSelectDate: (date: string | null) => void;
}

export function CalendarFortnightGrid({
  startDate,
  todayYmd,
  selectedDate,
  byDate,
  onSelectDate,
}: Props) {
  const cells = buildFortnightCells(startDate);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((cell) => {
        const sessions = byDate.get(cell.date) ?? [];
        const hasSessions = sessions.length > 0;
        const isToday = cell.date === todayYmd;
        const isSelected = cell.date === selectedDate;
        const allDone = hasSessions && sessions.every(isFullyCompleted);
        const dow = new Date(`${cell.date}T12:00:00Z`).getDay();

        return (
          <button
            key={cell.date}
            className={cellClass({ isToday, isSelected, hasSessions })}
            type="button"
            onClick={() =>
              hasSessions
                ? onSelectDate(isSelected ? null : cell.date)
                : undefined
            }
          >
            <span
              className={`text-[10px] font-semibold ${isToday ? "text-white" : "text-default-500"}`}
            >
              {DAY_NAMES_SHORT[dow]}
            </span>
            <span
              className={`text-base ${isToday ? "font-bold text-white" : "text-foreground"}`}
            >
              {cell.day}
            </span>
            {hasSessions ? (
              <div className="flex items-center gap-0.5 mt-1">
                {Array.from(new Set(sessions.map((s) => s.session_type)))
                  .slice(0, 3)
                  .map((t, i) => (
                    <span
                      key={`${t ?? "none"}-${i}`}
                      className={`h-1.5 w-1.5 rounded-full ${dotColor(t)}`}
                    />
                  ))}
                {allDone ? (
                  <Icon
                    className="text-success ml-0.5"
                    icon="solar:check-circle-bold"
                    width={12}
                  />
                ) : null}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface DayCell {
  date: string;
  day: number;
}

function buildFortnightCells(startDate: Date): DayCell[] {
  const cells: DayCell[] = [];
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const startDayOfMonth = startDate.getDate();

  for (let i = 0; i < 14; i++) {
    const d = new Date(year, month, startDayOfMonth + i);

    cells.push({
      date: getLocalYmd(d),
      day: d.getDate(),
    });
  }

  return cells;
}

function cellClass({
  isToday,
  isSelected,
  hasSessions,
}: {
  isToday: boolean;
  isSelected: boolean;
  hasSessions: boolean;
}): string {
  const base =
    "h-20 rounded-lg p-1 flex flex-col items-center justify-start gap-0.5 transition-all relative";
  const bg = isToday
    ? "bg-primary"
    : isSelected
      ? "bg-primary/20"
      : hasSessions
        ? "bg-default-100 hover:bg-default-200"
        : "bg-default-50";
  const cursor = hasSessions ? "cursor-pointer" : "cursor-default";

  return `${base} ${bg} ${cursor}`.trim();
}
