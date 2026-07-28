"use client";

// Chip de estado de una celda de día — COMPARTIDO por la tira semanal y la
// grilla mensual para que ambas digan y pinten exactamente lo mismo:
// pasado/hoy → palabra de estado (Hecho/Empezado/Sin hacer); futuro con
// sesión → chip punteado con el nombre (recomendación, no hecho); descanso →
// nada. La regla de agregación vive en day-label.ts.

import type { DayMetrics } from "./types";

import { classificationLabel } from "./adherence";
import { dayLabelClassification } from "./day-label";

export function dayCellInfo(day: DayMetrics): {
  statusWord: string;
  label: ReturnType<typeof dayLabelClassification>;
  sessionName: string | null;
} {
  const label = dayLabelClassification(day);

  return {
    label,
    statusWord: classificationLabel(label),
    sessionName:
      day.sessions[0]?.scheduledSession.session?.name ??
      day.recommendedSessionName ??
      null,
  };
}

export function DayCellChip({ day }: { day: DayMetrics }) {
  const { statusWord, label, sessionName } = dayCellInfo(day);

  if (day.isFuture && sessionName !== null) {
    return (
      <span className="w-fit max-w-full truncate rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500 opacity-70">
        {sessionName}
      </span>
    );
  }

  if (statusWord.length === 0) {
    return null;
  }

  return (
    <span
      className={[
        "w-fit max-w-full truncate rounded-full px-1.5 py-px text-[10px] font-semibold",
        label === "complete"
          ? "bg-emerald-100 text-emerald-700"
          : label === "partial"
            ? "bg-amber-100 text-amber-700"
            : "bg-gray-100 text-gray-500",
      ].join(" ")}
    >
      {statusWord}
    </span>
  );
}
