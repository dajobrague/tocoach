/** Pure formatting + range helpers for the trainer adherence view (P5-T6). */

const MS_PER_DAY = 86_400_000;

export type AdherenceRangePreset = "this-week" | "last-4-weeks";

export interface DateRange {
  from: string;
  to: string;
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.slice(0, 10).split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The inclusive `{from, to}` for a preset, ending on `today` (ISO YYYY-MM-DD):
 * "this-week" → the last 7 days, "last-4-weeks" → the last 28 days. Pure (today
 * is injected) and UTC calendar-day based, so it's deterministic and testable.
 */
export function adherenceDateRange(
  preset: AdherenceRangePreset,
  today: string
): DateRange {
  const span = preset === "this-week" ? 7 : 28;
  const toMs = ymdToMs(today);

  return {
    from: isoDay(toMs - (span - 1) * MS_PER_DAY),
    to: isoDay(toMs),
  };
}

/** Distinct presentation for the two headline metrics — never conflated. */
export const ADHERENCE_METRICS = {
  engagement: {
    key: "engagementPct" as const,
    label: "Engagement",
    sublabel: "comidas registradas",
    description: "Cuántas comidas registró (de cualquier tipo).",
    color: "primary" as const,
  },
  adherence: {
    key: "adherencePct" as const,
    label: "On-plan (Adherencia)",
    sublabel: "comió el plan",
    description: "Solo las que comió como estaba planeado.",
    color: "success" as const,
  },
};
