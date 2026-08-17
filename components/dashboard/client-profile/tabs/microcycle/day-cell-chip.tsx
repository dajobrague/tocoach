"use client";

// Chip de estado de una celda de día — COMPARTIDO por la tira semanal y la
// grilla mensual para que ambas digan y pinten exactamente lo mismo:
// pasado/hoy → palabra de estado (Hecho/Empezado/Sin hacer); futuro con
// sesión → chip punteado con el nombre (recomendación, no hecho); descanso →
// luna + "Descanso" (pedido de David: la celda vacía se sentía rara).
// La regla de agregación vive en day-label.ts.

import type { DayMetrics } from "./types";

import { Icon } from "@iconify/react";

import { classificationLabel } from "./adherence";
import { dayLabelClassification } from "./day-label";

export function dayCellInfo(day: DayMetrics): {
  statusWord: string;
  label: ReturnType<typeof dayLabelClassification>;
  /** Todos los nombres del día (únicos, orden primario-primero). */
  sessionNames: string[];
  /** Nombres unidos con " + " para aria/labels de una línea; null = rest. */
  sessionName: string | null;
} {
  const label = dayLabelClassification(day);

  // Nombres únicos de las sesiones del día; fallback a las recomendadas
  // del template (día futuro sin filas aún) y al campo legacy singular.
  const fromSessions = day.sessions
    .map((s) => s.scheduledSession.session?.name)
    .filter((n): n is string => n != null);
  const base =
    fromSessions.length > 0
      ? fromSessions
      : day.recommendedSessionNames.length > 0
        ? day.recommendedSessionNames
        : day.recommendedSessionName != null
          ? [day.recommendedSessionName]
          : [];
  const sessionNames = Array.from(new Set(base));

  return {
    label,
    statusWord: classificationLabel(label),
    sessionNames,
    sessionName: sessionNames.length > 0 ? sessionNames.join(" + ") : null,
  };
}

export function DayCellChip({ day }: { day: DayMetrics }) {
  const { statusWord, label, sessionName, sessionNames } = dayCellInfo(day);

  // Día de descanso (sin sesiones programadas ni actividad): chip mudo con
  // luna, pasado o futuro por igual. Sin él, la celda vacía parecía un bug.
  if (day.sessions.length === 0 && sessionName === null) {
    return (
      <span className="flex w-fit max-w-full items-center gap-1 rounded-full bg-gray-50 px-1.5 py-px text-[10px] font-medium text-gray-400">
        <Icon className="shrink-0" icon="solar:moon-bold" width={10} />
        Descanso
      </span>
    );
  }

  // Futuro: un chip punteado por sesión prescrita — con fuerza + cardio el
  // mismo día se apilan dos.
  if (day.isFuture && sessionNames.length > 0) {
    return (
      <span className="flex w-fit max-w-full flex-col items-start gap-0.5">
        {sessionNames.map((name) => (
          <span
            key={name}
            className="w-fit max-w-full truncate rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500 opacity-70"
          >
            {name}
          </span>
        ))}
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
