"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { HistoryDateFilter } from "../workouts/history-date-filter";

interface Props {
  /** Local Y-M-D of the Monday of the displayed week. */
  weekStartYmd: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Called with a Y-M-D string when the trainer picks any day in the popover. */
  onPickDate: (ymd: string) => void;
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
  onPrev,
  onNext,
  onToday,
  onPickDate,
}: Props) {
  const [pickerValue, setPickerValue] = useState("");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        isIconOnly
        aria-label="Semana anterior"
        size="sm"
        variant="flat"
        onPress={onPrev}
      >
        <Icon icon="solar:alt-arrow-left-linear" width={18} />
      </Button>

      <div className="flex-1 min-w-[14rem] flex items-center justify-center">
        <HistoryDateFilter
          allowAnyDate
          datesWithSessions={[]}
          value={pickerValue}
          onChange={(ymd) => {
            setPickerValue(ymd);
            onPickDate(ymd);
          }}
        />
      </div>

      <Button size="sm" variant="flat" onPress={onToday}>
        Hoy
      </Button>
      <Button
        isIconOnly
        aria-label="Semana siguiente"
        size="sm"
        variant="flat"
        onPress={onNext}
      >
        <Icon icon="solar:alt-arrow-right-linear" width={18} />
      </Button>

      <p className="text-xs font-medium text-gray-600 tabular-nums w-full text-center sm:w-auto sm:ml-2">
        {formatRange(weekStartYmd)}
      </p>
    </div>
  );
}
