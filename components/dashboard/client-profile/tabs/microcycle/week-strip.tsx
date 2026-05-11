"use client";

import type { DayClassification, DayMetrics } from "./types";

import { Icon } from "@iconify/react";

import { formatPercent } from "./adherence";

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function symbolFor(classification: DayClassification): string {
  if (classification === "complete") return "●";
  if (classification === "partial") return "◐";
  if (classification === "pending") return "○";

  return "—";
}

function colorClassFor(classification: DayClassification): string {
  if (classification === "complete") return "text-green-600";
  if (classification === "partial") return "text-amber-500";
  if (classification === "pending") return "text-gray-400";

  return "text-gray-300";
}

function borderClassFor(
  classification: DayClassification,
  isSelected: boolean
): string {
  if (isSelected) return "border-blue-500 bg-blue-50";
  if (classification === "complete")
    return "border-green-200 hover:bg-green-50/50";
  if (classification === "partial")
    return "border-amber-200 hover:bg-amber-50/50";
  if (classification === "pending") return "border-gray-200 hover:bg-gray-50";

  return "border-gray-200 hover:bg-gray-50";
}

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
          className="shrink-0 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          type="button"
          onClick={onPrevWeek}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={18} />
        </button>
      ) : null}

      <div
        aria-label="Días de la semana con adherencia"
        className="grid grid-cols-7 gap-1.5 flex-1 min-w-0"
        role="grid"
      >
        {days.map((day, idx) => {
          const isSelected = day.date === selectedDate;
          const dayNumber = parseInt(day.date.split("-")[2] ?? "0");
          const sessionName = day.scheduledSession?.session?.name ?? "Descanso";
          const showPercent =
            day.classification !== "rest" && day.classification !== "future";
          const ariaLabel = day.scheduledSession
            ? `${DAY_LABELS[idx]} ${dayNumber}, ${sessionName}, ${
                showPercent
                  ? `${day.adherence.completedExercises} de ${day.adherence.totalPrescribed} ejercicios completados`
                  : "sin actividad aún"
              }`
            : `${DAY_LABELS[idx]} ${dayNumber}, día de descanso`;

          return (
            <button
              key={day.date}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={ariaLabel}
              aria-selected={isSelected}
              className={[
                "relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors text-left",
                borderClassFor(day.classification, isSelected),
                day.isFuture ? "opacity-70" : "",
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
              <span className="text-[10px] font-semibold text-gray-500 tracking-wider">
                {DAY_LABELS[idx]}
              </span>
              <span
                className={[
                  "text-base font-semibold tabular-nums",
                  day.isToday ? "text-blue-600" : "text-gray-900",
                ].join(" ")}
              >
                {dayNumber}
              </span>
              {day.isToday ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500"
                />
              ) : null}
              <span className="text-[10px] text-gray-500 leading-tight text-center min-h-[1rem] line-clamp-1">
                {sessionName}
              </span>
              <span
                aria-hidden="true"
                className={`text-lg leading-none ${colorClassFor(day.classification)}`}
              >
                {symbolFor(day.classification)}
              </span>
              <span className="text-[10px] tabular-nums text-gray-500 min-h-[1rem]">
                {showPercent ? formatPercent(day.adherence.ejercicios) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {onNextWeek ? (
        <button
          aria-label="Semana siguiente"
          className="shrink-0 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          type="button"
          onClick={onNextWeek}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={18} />
        </button>
      ) : null}
    </div>
  );
}
