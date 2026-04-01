import type { CheckInSchedule, FormResponse } from "./types";

import {
  chartPeriodCountForRange,
  formatPeriodTooltipSpan,
  generatePeriodLabels,
  responseTimestampMs,
} from "./chart-helpers";
import { getScheduleOrDefault } from "./schedule";

export type CheckInPeriodWindow = {
  start: Date;
  end: Date;
  label: string;
};

/**
 * Past check-in submission windows (oldest → newest) for chart bucketing.
 */
export function listCheckInPeriodWindows(
  schedule: CheckInSchedule,
  now: Date,
  maxWindows: number,
  oldestCutoff: Date
): CheckInPeriodWindow[] {
  const pool = generatePeriodLabels(
    schedule,
    Math.min(200, Math.max(maxWindows * 4, maxWindows)),
    now
  );
  const filtered = pool.filter(
    (p) => p.end.getTime() >= oldestCutoff.getTime()
  );
  const sliced = filtered.slice(-maxWindows);

  return sliced.map((p) => ({
    start: p.start,
    end: p.end,
    label: p.label,
  }));
}

/**
 * One weight point per check-in period (latest submission in each window).
 * Merges check-in and daily habit responses in the same window.
 */
export function aggregateWeightByCheckInPeriods(
  schedule: CheckInSchedule,
  checkinResponses: FormResponse[],
  dailyResponses: FormResponse[],
  selectedPeriod: string,
  lookbackDays: number
): { date: string; weight: number; periodTooltip: string }[] {
  const s = getScheduleOrDefault(schedule);
  const now = new Date();
  const oldest = new Date(now.getTime() - lookbackDays * 86400000);
  const maxW = chartPeriodCountForRange(selectedPeriod, s.frequency);
  const windows = listCheckInPeriodWindows(s, now, maxW, oldest);

  const data: { date: string; weight: number; periodTooltip: string }[] = [];

  for (const w of windows) {
    const inWindow = [...checkinResponses, ...dailyResponses]
      .filter((r) => {
        const t = responseTimestampMs(r);

        return t >= w.start.getTime() && t <= w.end.getTime();
      })
      .sort((a, b) => responseTimestampMs(a) - responseTimestampMs(b));

    let weight = 0;

    const latest = inWindow[inWindow.length - 1];

    if (latest?.answers) {
      weight = Number(
        latest.answers.body_weight ||
          latest.answers.weight ||
          latest.answers.peso ||
          0
      );
    }

    data.push({
      date: w.label,
      weight,
      periodTooltip: formatPeriodTooltipSpan(w.start, w.end, s.timezone),
    });
  }

  let last = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    if (row && row.weight > 0) {
      last = row.weight;
    } else if (row) {
      row.weight = last;
    }
  }

  return data;
}
