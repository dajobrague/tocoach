"use client";

import type { FormResponse, StepsPoint } from "../progress/types";

import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import { buildDateRange } from "../progress/helpers";
import { NeatSection } from "../progress/neat-section";
import { DateRangeSelector, SectionHeader } from "../progress/ui-atoms";

import { resolveStepsAnswer } from "@/lib/forms/analytics-keys";

interface Props {
  clientId: string;
}

/**
 * Client steps / NEAT chart with date-range selector. Lifted out of the
 * old Progress tab so this lives in the same place as the trainer's
 * existing NEAT goal configuration.
 */
export function ClientStepsSection({ clientId }: Props) {
  const [daysRange, setDaysRange] = useState("90");
  const [stepsData, setStepsData] = useState<StepsPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    const { start, end } = buildDateRange(daysRange);

    try {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=habits&start_date=${start}&end_date=${end}&days=${daysRange}`
      );
      const json = await res.json();

      if (json.success) {
        const responses: FormResponse[] = json.responses ?? [];
        // resolveStepsAnswer captures non-canonical answer keys (daily_steps,
        // stepsTaken, etc.) that previously came back as 0 and were dropped.
        // Distinguish "no respondió" (null) from "respondió 0" (rest day): only
        // null values are filtered out.
        const points = responses
          .map((r) => ({
            date: r.response_date,
            steps: resolveStepsAnswer(r.answers),
          }))
          .filter((p): p is { date: string; steps: number } => p.steps !== null)
          .sort((a, b) => a.date.localeCompare(b.date));

        setStepsData(points);
      }
    } catch {
      /* steps are non-critical — leave empty */
    } finally {
      setLoading(false);
    }
  }, [clientId, daysRange]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <SectionHeader icon="solar:walking-bold" title="Pasos del cliente" />
        <DateRangeSelector value={daysRange} onChange={setDaysRange} />
      </div>
      {loading || stepsData.length > 0 ? (
        <NeatSection isLoading={loading} stepsData={stepsData} />
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 bg-gray-50 border border-gray-200 rounded-lg">
          <Icon icon="solar:walking-bold" width={32} />
          <p className="text-sm">Sin registros de pasos en este rango.</p>
        </div>
      )}
    </section>
  );
}
