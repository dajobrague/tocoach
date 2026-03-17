"use client";

import type { ExerciseLog, FormResponse, StepsPoint } from "./progress/types";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDateRange,
  groupLogsByExercise,
  isCardio,
} from "./progress/helpers";
import { DateRangeSelector, SectionHeader } from "./progress/ui-atoms";
import { SummaryStrip } from "./progress/summary-strip";
import { ActivityHeatmap } from "./progress/activity-heatmap";
import { StrengthExerciseCard } from "./progress/strength-card";
import { CardioExerciseCard } from "./progress/cardio-card";
import { NeatSection } from "./progress/neat-section";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProgressTab({ clientId }: { clientId: string }) {
  const [daysRange, setDaysRange] = useState("90");
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [stepsData, setStepsData] = useState<StepsPoint[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    const { start, end } = buildDateRange(daysRange);

    try {
      const res = await fetch(
        `/api/clients/${clientId}/exercise-logs/trainer?startDate=${start}&endDate=${end}`
      );
      const json = await res.json();

      if (!json.success) {
        setLogsError("No se pudieron cargar los registros.");

        return;
      }
      setLogs(json.exerciseLogs || []);
    } catch {
      setLogsError("Error al conectar con el servidor.");
    } finally {
      setLogsLoading(false);
    }
  }, [clientId, daysRange]);

  const fetchSteps = useCallback(async () => {
    setStepsLoading(true);
    const { start, end } = buildDateRange(daysRange);

    try {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=habits&start_date=${start}&end_date=${end}&days=${daysRange}`
      );
      const json = await res.json();

      if (json.success) {
        const responses: FormResponse[] = json.responses || [];
        const points = responses
          .map((r) => ({
            date: r.response_date,
            steps: Number(r.answers?.steps ?? r.answers?.pasos ?? 0),
          }))
          .filter((p) => p.steps > 0)
          .sort((a, b) => a.date.localeCompare(b.date));

        setStepsData(points);
      }
    } catch {
      /* steps are non-critical */
    } finally {
      setStepsLoading(false);
    }
  }, [clientId, daysRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const strengthGroups = useMemo(
    () =>
      groupLogsByExercise(
        logs.filter((l) => l.exercises && !isCardio(l.exercises.category))
      ),
    [logs]
  );
  const cardioGroups = useMemo(
    () =>
      groupLogsByExercise(
        logs.filter((l) => l.exercises && isCardio(l.exercises.category))
      ),
    [logs]
  );

  const isLoading = logsLoading && stepsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner color="primary" label="Cargando progreso..." />
      </div>
    );
  }

  if (logsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-500">
        <Icon icon="solar:danger-circle-bold" width={36} />
        <p className="text-sm font-medium">{logsError}</p>
        <Button size="sm" variant="flat" onPress={fetchLogs}>
          Reintentar
        </Button>
      </div>
    );
  }

  const hasAnyData = logs.length > 0 || stepsData.length > 0;

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <h1 className="text-lg font-bold text-gray-900">
          Progreso del Cliente
        </h1>
        <DateRangeSelector value={daysRange} onChange={setDaysRange} />
      </div>

      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <Icon icon="solar:chart-line-duotone" width={48} />
          <p className="text-base font-medium text-gray-500">
            Sin datos de progreso
          </p>
          <p className="text-sm text-center max-w-xs text-gray-400">
            Los datos aparecerán aquí cuando el cliente complete entrenamientos
            o registre hábitos
          </p>
        </div>
      ) : (
        <>
          <SummaryStrip logs={logs} stepsData={stepsData} />

          <ActivityHeatmap
            daysRange={daysRange}
            logs={logs}
            stepsData={stepsData}
          />

          {strengthGroups.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                count={strengthGroups.length}
                icon="solar:dumbbell-bold"
                title="Entrenamientos"
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {strengthGroups.map((g) => (
                  <StrengthExerciseCard
                    key={g.exercise.id}
                    group={g}
                    isExpanded={expandedCard === `s-${g.exercise.id}`}
                    onToggle={() =>
                      setExpandedCard(
                        expandedCard === `s-${g.exercise.id}`
                          ? null
                          : `s-${g.exercise.id}`
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {cardioGroups.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                count={cardioGroups.length}
                icon="solar:heart-pulse-bold"
                title="Cardio"
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {cardioGroups.map((g) => (
                  <CardioExerciseCard
                    key={g.exercise.id}
                    group={g}
                    isExpanded={expandedCard === `c-${g.exercise.id}`}
                    onToggle={() =>
                      setExpandedCard(
                        expandedCard === `c-${g.exercise.id}`
                          ? null
                          : `c-${g.exercise.id}`
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {(stepsData.length > 0 || stepsLoading) && (
            <div className="space-y-3">
              <SectionHeader icon="solar:walking-bold" title="NEAT / Pasos" />
              <NeatSection isLoading={stepsLoading} stepsData={stepsData} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
