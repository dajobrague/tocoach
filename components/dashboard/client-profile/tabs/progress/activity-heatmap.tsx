"use client";

import type { ExerciseLog, StepsPoint } from "./types";

import { useMemo } from "react";
import { ActivityCalendar } from "react-activity-calendar";

const SPANISH_LABELS = {
  months: [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ],
  weekdays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  totalCount: "{{count}} actividades en {{year}}",
  legend: { less: "Menos", more: "Más" },
};

const THEME = {
  light: ["#f3f4f6", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af"],
};

function computeLevel(exerciseCount: number, hasSteps: boolean): number {
  if (exerciseCount >= 4) return 4;
  if (exerciseCount >= 3) return 3;
  if (exerciseCount >= 1) return 2;
  if (hasSteps) return 1;

  return 0;
}

function getSizeForRange(daysRange: string): {
  blockSize: number;
  blockMargin: number;
} {
  const days = parseInt(daysRange);

  if (days <= 30) return { blockSize: 22, blockMargin: 5 };
  if (days <= 90) return { blockSize: 18, blockMargin: 5 };
  if (days <= 180) return { blockSize: 16, blockMargin: 4 };

  return { blockSize: 14, blockMargin: 4 };
}

export function ActivityHeatmap({
  logs,
  stepsData,
  daysRange,
}: {
  logs: ExerciseLog[];
  stepsData: StepsPoint[];
  daysRange: string;
}) {
  const calendarData = useMemo(() => {
    const exerciseMap = new Map<string, number>();

    for (const l of logs) {
      const d = l.scheduled_date;

      exerciseMap.set(d, (exerciseMap.get(d) ?? 0) + 1);
    }
    const stepsSet = new Set(stepsData.map((s) => s.date));

    const totalDays = parseInt(daysRange);
    const end = new Date();
    const start = new Date();

    start.setDate(end.getDate() - totalDays + 1);

    const data: { date: string; count: number; level: number }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dateStr = cursor.toISOString().split("T")[0]!;
      const exerciseCount = exerciseMap.get(dateStr) ?? 0;
      const hasSteps = stepsSet.has(dateStr);
      const totalCount = exerciseCount + (hasSteps ? 1 : 0);

      data.push({
        date: dateStr,
        count: totalCount,
        level: computeLevel(exerciseCount, hasSteps),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return data;
  }, [logs, stepsData, daysRange]);

  const { blockSize, blockMargin } = getSizeForRange(daysRange);

  if (calendarData.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Actividad</h3>
      <ActivityCalendar
        blockMargin={blockMargin}
        blockRadius={3}
        blockSize={blockSize}
        colorScheme="light"
        data={calendarData}
        fontSize={12}
        labels={SPANISH_LABELS}
        maxLevel={4}
        showWeekdayLabels={["mon", "wed", "fri"]}
        theme={THEME}
        tooltips={{
          activity: {
            text: (activity) => {
              if (activity.count === 0)
                return `${formatTooltipDate(activity.date)}: sin actividad`;

              return `${formatTooltipDate(activity.date)}: ${activity.count} actividad${activity.count > 1 ? "es" : ""}`;
            },
          },
          colorLegend: {
            text: (level) => {
              const labels = [
                "Sin actividad",
                "Solo pasos",
                "1-2 ejercicios",
                "3 ejercicios",
                "4+ ejercicios",
              ];

              return labels[level] ?? "";
            },
          },
        }}
        weekStart={1}
      />
    </div>
  );
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
