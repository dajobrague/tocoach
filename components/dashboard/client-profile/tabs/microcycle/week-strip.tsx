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
          const isRest = day.sessions.length === 0;

          // Derive a representative classification for the day card border/ring.
          // If any session is complete → complete; if any partial → partial;
          // if all future → future; else rest.
          const dayClassification: DayClassification = isRest
            ? day.isFuture
              ? "future"
              : "rest"
            : day.sessions.some((s) => s.classification === "complete")
              ? "complete"
              : day.sessions.some((s) => s.classification === "partial")
                ? "partial"
                : day.sessions.some((s) => s.classification === "future")
                  ? "future"
                  : "pending";

          // Session label: "Descanso" / single name / "N sesiones"
          const sessionLabel = isRest
            ? day.recommendedSessionName != null
              ? `Descanso · ${day.recommendedSessionName}`
              : "Descanso"
            : day.sessions.length === 1
              ? (day.sessions[0]!.scheduledSession.session?.name ?? "Sesión")
              : `${day.sessions.length} sesiones`;

          // Adherence % to show: aggregate across sessions when multiple.
          const showPercent =
            !isRest &&
            dayClassification !== "future" &&
            dayClassification !== "rest";

          const totalPrescribed = day.sessions.reduce(
            (acc, s) => acc + s.adherence.totalPrescribed,
            0
          );
          const completedExercises = day.sessions.reduce(
            (acc, s) => acc + s.adherence.completedExercises,
            0
          );
          const agregateEjercicios =
            totalPrescribed === 0 ? 0 : completedExercises / totalPrescribed;

          const ariaLabel = isRest
            ? `${DAY_LABELS[idx]} ${dayNumber}, día de descanso`
            : `${DAY_LABELS[idx]} ${dayNumber}, ${sessionLabel}, ${
                showPercent
                  ? `${completedExercises} de ${totalPrescribed} ejercicios completados`
                  : "sin actividad aún"
              }`;

          return (
            <button
              key={day.date}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={ariaLabel}
              aria-selected={isSelected}
              className={[
                "relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors text-left",
                borderClassFor(dayClassification, isSelected),
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
                {sessionLabel}
              </span>
              {/* When multiple sessions, show a small stack of symbols */}
              {day.sessions.length > 1 ? (
                <span aria-hidden="true" className="flex gap-0.5 leading-none">
                  {day.sessions.map((s) => (
                    <span
                      key={s.scheduledSession.id}
                      className={`text-sm leading-none ${colorClassFor(s.classification)}`}
                    >
                      {symbolFor(s.classification)}
                    </span>
                  ))}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`text-lg leading-none ${colorClassFor(dayClassification)}`}
                >
                  {symbolFor(dayClassification)}
                </span>
              )}
              <span className="text-[10px] tabular-nums text-gray-500 min-h-[1rem]">
                {showPercent ? formatPercent(agregateEjercicios) : ""}
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
