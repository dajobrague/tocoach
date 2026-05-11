"use client";

import type { DayClassification, DayMetrics } from "./types";

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

interface Props {
  days: DayMetrics[];
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Arrow-key navigation handler. Buttons attach onKeyDown to call this. */
  onArrowNav?: (direction: "left" | "right") => void;
}

export function WeekStrip({ days, selectedDate, onSelect, onArrowNav }: Props) {
  return (
    <div
      aria-label="Días de la semana con adherencia"
      className="grid grid-cols-7 gap-1.5"
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
              "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors text-left",
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50",
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
                day.isToday
                  ? "text-blue-600 ring-1 ring-blue-300 rounded-full w-7 h-7 flex items-center justify-center"
                  : "text-gray-900",
              ].join(" ")}
            >
              {dayNumber}
            </span>
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
  );
}
