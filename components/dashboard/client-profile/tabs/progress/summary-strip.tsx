"use client";

import type { ExerciseLog, StepsPoint } from "./types";

import { useMemo } from "react";

import { StatCard } from "./ui-atoms";

export function SummaryStrip({
  logs,
  stepsData,
}: {
  logs: ExerciseLog[];
  stepsData: StepsPoint[];
}) {
  const stats = useMemo(() => {
    const activeDates = new Set(logs.map((l) => l.scheduled_date));
    const activeDays = activeDates.size;
    const totalSessions = activeDays;

    const avgSteps = stepsData.length
      ? Math.round(
          stepsData.reduce((s, p) => s + p.steps, 0) / stepsData.length
        )
      : 0;

    let streak = 0;

    if (activeDates.size > 0) {
      const sorted = [...activeDates].sort().reverse();
      const today = new Date().toISOString().split("T")[0]!;
      const mostRecent = sorted[0]!;
      const daysDiff = Math.floor(
        (new Date(today).getTime() - new Date(mostRecent).getTime()) / 86400000
      );

      if (daysDiff <= 1) {
        let cursor = new Date(mostRecent);

        while (activeDates.has(cursor.toISOString().split("T")[0]!)) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
      }
    }

    return { totalSessions, activeDays, avgSteps, streak };
  }, [logs, stepsData]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        accent="blue"
        icon="solar:calendar-bold"
        label="Sesiones"
        value={String(stats.totalSessions)}
      />
      <StatCard
        accent="green"
        icon="solar:fire-bold"
        label="Días Activos"
        value={String(stats.activeDays)}
      />
      <StatCard
        accent="purple"
        icon="solar:walking-bold"
        label="Media Pasos"
        value={
          stats.avgSteps > 0 ? stats.avgSteps.toLocaleString("es-ES") : "—"
        }
      />
      <StatCard
        accent="amber"
        icon="solar:bolt-bold"
        label="Racha Actual"
        value={stats.streak > 0 ? `${stats.streak} días` : "—"}
      />
    </div>
  );
}
