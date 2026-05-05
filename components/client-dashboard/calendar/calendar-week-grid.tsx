// Vista semanal: 7 días en una fila, celdas grandes que muestran nombre
// de la primera sesión del día y chip de tipo. Más densidad de
// información que la mensual o quincenal — útil cuando el cliente quiere
// ver "qué hizo esta semana" de un vistazo.

import type { CalendarEntrySession } from "./hooks/use-calendar-entries";

import { Icon } from "@iconify/react";

import {
  DAY_NAMES_SHORT,
  chipColor,
  isFullyCompleted,
  typeLabel,
} from "./calendar-shared";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface Props {
  startDate: Date;
  todayYmd: string;
  selectedDate: string | null;
  byDate: Map<string, CalendarEntrySession[]>;
  onSelectDate: (date: string | null) => void;
}

export function CalendarWeekGrid({
  startDate,
  todayYmd,
  selectedDate,
  byDate,
  onSelectDate,
}: Props) {
  const cells = buildWeekCells(startDate);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((cell) => {
        const sessions = byDate.get(cell.date) ?? [];
        const hasSessions = sessions.length > 0;
        const isToday = cell.date === todayYmd;
        const isSelected = cell.date === selectedDate;
        const allDone = hasSessions && sessions.every(isFullyCompleted);
        const first = sessions[0];

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
              {DAY_NAMES_SHORT[new Date(`${cell.date}T12:00:00Z`).getDay()]}
            </span>
            <span
              className={`text-lg leading-none ${isToday ? "font-bold text-white" : "text-foreground"}`}
            >
              {cell.day}
            </span>
            {first ? (
              <SessionPreview
                allDone={allDone}
                extra={sessions.length - 1}
                isToday={isToday}
                session={first}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SessionPreview({
  session,
  extra,
  allDone,
  isToday,
}: {
  session: CalendarEntrySession;
  extra: number;
  allDone: boolean;
  isToday: boolean;
}) {
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5 w-full">
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium leading-tight max-w-full truncate ${chipBgClass(
          chipColor(session.session_type),
          isToday
        )}`}
      >
        {typeLabel(session.session_type)}
      </span>
      <span
        className={`text-[9px] truncate max-w-full ${isToday ? "text-white/80" : "text-foreground/70"}`}
      >
        {session.name}
      </span>
      <div className="flex items-center gap-0.5">
        {allDone ? (
          <Icon
            className={isToday ? "text-white" : "text-success"}
            icon="solar:check-circle-bold"
            width={10}
          />
        ) : null}
        {extra > 0 ? (
          <span
            className={`text-[8px] ${isToday ? "text-white/80" : "text-default-500"}`}
          >
            +{extra}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function chipBgClass(
  color: ReturnType<typeof chipColor>,
  isToday: boolean
): string {
  if (isToday) return "bg-white/20 text-white";
  switch (color) {
    case "primary":
      return "bg-primary/15 text-primary";
    case "danger":
      return "bg-danger/15 text-danger";
    case "warning":
      return "bg-warning/15 text-warning-700";
    case "secondary":
      return "bg-secondary/15 text-secondary";
    case "success":
      return "bg-success/15 text-success-700";
    default:
      return "bg-default-200 text-foreground/70";
  }
}

interface DayCell {
  date: string;
  day: number;
}

function buildWeekCells(startDate: Date): DayCell[] {
  const cells: DayCell[] = [];
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const startDayOfMonth = startDate.getDate();

  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month, startDayOfMonth + i);

    cells.push({ date: getLocalYmd(d), day: d.getDate() });
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
    "min-h-[6rem] rounded-lg p-1.5 flex flex-col items-center justify-start transition-all";
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
