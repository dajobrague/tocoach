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
  /**
   * Nombres para los chips del día. Futuro: SOLO prescripciones del
   * template (una fila real creada por el cliente en fecha futura es su
   * elección, no plan del trainer). Pasado/hoy: las sesiones del día.
   * Únicos por session ID — los NOMBRES pueden repetirse entre programas
   * ("Día 1" de fuerza y de cardio son dos chips, no uno).
   */
  sessionNames: string[];
  /** Nombres unidos con " + " para aria/labels de una línea; null = rest. */
  sessionName: string | null;
} {
  const label = dayLabelClassification(day);

  // Únicos por session id (no por nombre) — dos programas pueden tener
  // sesiones homónimas y ambas deben contarse.
  const seenIds = new Set<string>();
  const actualNames: string[] = [];

  for (const entry of day.sessions) {
    const session = entry.scheduledSession.session;

    if (session?.name == null) continue;
    const key = session.id ?? `name:${session.name}`;

    if (seenIds.has(key)) continue;
    seenIds.add(key);
    actualNames.push(session.name);
  }

  const recommendedNames = day.recommendedSessions.map((s) => s.name);
  const sessionNames = day.isFuture
    ? recommendedNames.length > 0
      ? recommendedNames
      : actualNames
    : actualNames.length > 0
      ? actualNames
      : recommendedNames;

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
  // mismo día se apilan dos. Tope de 2 + "+N": la celda mide h-[4.5rem]
  // y con 3+ programas los chips desbordarían sobre la fila siguiente.
  if (day.isFuture && sessionNames.length > 0) {
    const shown = sessionNames.slice(0, 2);
    const extra = sessionNames.length - shown.length;

    return (
      <span className="flex w-fit max-w-full flex-col items-start gap-0.5 overflow-hidden">
        {shown.map((name, idx) => (
          <span
            key={`${name}-${idx}`}
            className="w-fit max-w-full truncate rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500 opacity-70"
          >
            {name}
          </span>
        ))}
        {extra > 0 ? (
          <span className="w-fit rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500 opacity-70">
            +{extra}
          </span>
        ) : null}
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
