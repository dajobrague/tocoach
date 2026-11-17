"use client";

import { Button } from "@heroui/react";

import { HistoryDateFilter } from "../workouts/history-date-filter";

interface Props {
  /** Local Y-M-D of the Monday of the displayed week. */
  weekStartYmd: string;
  onToday: () => void;
  /** Called with a Y-M-D string when the trainer picks any day in the popover. */
  onPickDate: (ymd: string) => void;
  /** Volumen (kg·reps) de la semana mostrada; null mientras carga. */
  volume: number | null;
}

function formatRange(weekStartYmd: string): string {
  const start = new Date(weekStartYmd + "T00:00:00");
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString("es-ES", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  });
  const endStr = end.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `Semana del ${startStr} – ${endStr}`;
}

export function WeekNavigator({
  weekStartYmd,
  onToday,
  onPickDate,
  volume,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-gray-800 tabular-nums">
          {formatRange(weekStartYmd)}
        </p>
        {volume !== null && volume > 0 ? (
          <p className="text-xs text-default-500 tabular-nums">
            Volumen semanal{" "}
            <span className="font-semibold text-gray-800">
              {volume.toLocaleString("es-ES")}
            </span>{" "}
            kg·reps
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <HistoryDateFilter
          allowAnyDate
          datesWithSessions={[]}
          value=""
          onChange={onPickDate}
        />
        <Button className="ml-1" size="sm" variant="flat" onPress={onToday}>
          Hoy
        </Button>
      </div>
    </div>
  );
}
