"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

interface Props {
  /** All dates with at least one session, ISO YYYY-MM-DD. Order irrelevant. */
  datesWithSessions: string[];
  /** Currently selected YYYY-MM-DD, or "" for no filter. */
  value: string;
  onChange: (next: string) => void;
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromYmd(s: string): Date {
  return new Date(s + "T00:00:00");
}

function formatTriggerLabel(ymd: string): string {
  const d = fromYmd(ymd);

  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * 6×7 grid of dates for `monthStart`'s month, starting on Monday.
 * Includes overflow days from the previous and next month so the grid stays
 * rectangular — those overflow cells render visually muted.
 */
function buildMonthGrid(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  // 0 = Sun..6 = Sat. We want 0 = Mon..6 = Sun.
  const firstDow = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);

  gridStart.setDate(first.getDate() - firstDow);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);

    d.setDate(gridStart.getDate() + i);

    return { date: d, inMonth: d.getMonth() === monthStart.getMonth() };
  });
}

export function HistoryDateFilter({
  datesWithSessions,
  value,
  onChange,
}: Props) {
  // Set of YYYY-MM-DD for O(1) lookup while rendering cells.
  const dataSet = useMemo(
    () => new Set(datesWithSessions),
    [datesWithSessions]
  );

  // Latest data date — used as the initial month when no value is selected.
  const latestData = useMemo(() => {
    if (datesWithSessions.length === 0) return new Date();

    const sorted = [...datesWithSessions].sort();
    const last = sorted[sorted.length - 1];

    return last ? fromYmd(last) : new Date();
  }, [datesWithSessions]);

  const [open, setOpen] = useState(false);
  const [monthStart, setMonthStart] = useState<Date>(() =>
    value
      ? new Date(fromYmd(value).getFullYear(), fromYmd(value).getMonth(), 1)
      : new Date(latestData.getFullYear(), latestData.getMonth(), 1)
  );

  const grid = useMemo(() => buildMonthGrid(monthStart), [monthStart]);
  const todayYmd = useMemo(() => toYmd(new Date()), []);

  if (datesWithSessions.length <= 1) return null;

  const handlePrev = () =>
    setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const handleNext = () =>
    setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const handleSelect = (ymd: string, hasData: boolean) => {
    if (!hasData) return;
    onChange(ymd);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover
      isOpen={open}
      offset={4}
      placement="bottom-end"
      onOpenChange={setOpen}
    >
      <PopoverTrigger>
        <button
          aria-label="Filtrar historial por fecha"
          className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
          type="button"
        >
          <Icon
            className="text-gray-400"
            icon="solar:calendar-linear"
            width={13}
          />
          <span className="tabular-nums">
            {value ? formatTriggerLabel(value) : "Todas las fechas"}
          </span>
          <Icon
            className="text-gray-400"
            icon="solar:alt-arrow-down-linear"
            width={11}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="w-[260px] bg-white rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
            <button
              aria-label="Mes anterior"
              className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              type="button"
              onClick={handlePrev}
            >
              <Icon icon="solar:alt-arrow-left-linear" width={14} />
            </button>
            <p className="text-xs font-semibold text-gray-700 capitalize tabular-nums">
              {MONTH_LABELS[monthStart.getMonth()]} {monthStart.getFullYear()}
            </p>
            <button
              aria-label="Mes siguiente"
              className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              type="button"
              onClick={handleNext}
            >
              <Icon icon="solar:alt-arrow-right-linear" width={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 pb-1">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-center text-[9px] font-semibold text-gray-400 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
            {grid.map(({ date, inMonth }) => {
              const ymd = toYmd(date);
              const hasData = dataSet.has(ymd);
              const isSelected = ymd === value;
              const isToday = ymd === todayYmd;

              return (
                <button
                  key={ymd}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={[
                    "relative h-8 rounded text-[11px] tabular-nums transition-colors",
                    !inMonth ? "text-gray-300" : "",
                    inMonth && !hasData && !isSelected
                      ? "text-gray-400 cursor-not-allowed"
                      : "",
                    hasData && !isSelected
                      ? "text-gray-900 font-medium hover:bg-blue-50 cursor-pointer"
                      : "",
                    isSelected
                      ? "bg-blue-600 text-white font-semibold cursor-pointer"
                      : "",
                    isToday && !isSelected
                      ? "ring-1 ring-inset ring-blue-300"
                      : "",
                  ].join(" ")}
                  disabled={!hasData}
                  type="button"
                  onClick={() => handleSelect(ymd, hasData)}
                >
                  {date.getDate()}
                  {hasData && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50">
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-blue-500" />
              Días con registros
            </span>
            {value ? (
              <button
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-1"
                type="button"
                onClick={handleClear}
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
