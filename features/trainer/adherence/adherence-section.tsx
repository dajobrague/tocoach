"use client";

import type { AdherenceRangePreset } from "./adherence-format";
import type { MealLogRow } from "@/lib/nutrition/logs/meal-log-service";

import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

import { ADHERENCE_METRICS, adherenceDateRange } from "./adherence-format";
import { useClientAdherence } from "./use-adherence";

import { mealLogChoiceLabel } from "@/components/client-dashboard/meal-cycle/meal-log-options";

interface AdherenceSectionProps {
  clientId: number;
}

const RANGE_PRESETS: { key: AdherenceRangePreset; label: string }[] = [
  { key: "this-week", label: "Esta semana" },
  { key: "last-4-weeks", label: "Últimas 4 semanas" },
];

// Static class names per metric color (Tailwind can't see interpolated names).
const METRIC_STYLES = {
  primary: {
    dot: "bg-primary",
    text: "text-primary",
    border: "border-primary/40",
  },
  success: {
    dot: "bg-success",
    text: "text-success",
    border: "border-success/40",
  },
} as const;

/** One headline metric, big and clearly labeled so it can't be conflated. */
function MetricCard({
  metric,
  value,
}: {
  metric:
    | typeof ADHERENCE_METRICS.engagement
    | typeof ADHERENCE_METRICS.adherence;
  value: number;
}) {
  const styles = METRIC_STYLES[metric.color];

  return (
    <Card className={`flex-1 border-2 ${styles.border}`}>
      <CardBody className="gap-1">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${styles.dot}`} />
          <p className="text-sm font-semibold text-foreground">
            {metric.label}
          </p>
        </div>
        <p
          className={`text-4xl font-bold ${styles.text}`}
          data-testid={`metric-${metric.key}`}
        >
          {value}%
        </p>
        <p className="text-xs font-medium text-default-500">
          {metric.sublabel}
        </p>
        <p className="text-[11px] text-default-400">{metric.description}</p>
      </CardBody>
    </Card>
  );
}

/** Per-week engagement vs adherence bars (two colors, never merged). */
function WeekBars({
  weeks,
}: {
  weeks: {
    weekStart: string;
    engagementPct: number;
    adherencePct: number;
  }[];
}) {
  if (weeks.length === 0) return null;

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {weeks.map((week) => (
        <div key={week.weekStart} className="flex flex-col items-center gap-1">
          <div className="flex h-24 items-end gap-1">
            <div
              className="w-4 rounded-t bg-primary"
              style={{ height: `${Math.max(week.engagementPct, 2)}%` }}
              title={`Engagement ${week.engagementPct}%`}
            />
            <div
              className="w-4 rounded-t bg-success"
              style={{ height: `${Math.max(week.adherencePct, 2)}%` }}
              title={`On-plan ${week.adherencePct}%`}
            />
          </div>
          <span className="text-[10px] text-default-400">
            {week.weekStart.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoggedMeal({ log }: { log: MealLogRow }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-default-200 bg-content1 p-3"
      data-testid="logged-meal"
    >
      {log.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Foto de la comida"
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
          src={log.photo_url}
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-default-100">
          <Icon
            className="text-default-300"
            icon="solar:plate-linear"
            width={22}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-default-400">{log.log_date}</span>
          <Chip
            color={
              log.status === "eaten_planned"
                ? "success"
                : log.status === "eaten_other"
                  ? "warning"
                  : "danger"
            }
            size="sm"
            variant="flat"
          >
            {mealLogChoiceLabel(log.status)}
          </Chip>
        </div>
        {log.comment ? (
          <p className="mt-1 text-sm text-default-600">{log.comment}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Trainer adherence view (P5-T6). Shows the two headline numbers — Engagement %
 * (logged anything) and On-plan/Adherencia % (ate the plan) — kept visually
 * distinct (separate colored cards + legend), per-week bars, the status
 * breakdown, and the client's logged meals with photos + comments.
 */
export function AdherenceSection({ clientId }: AdherenceSectionProps) {
  const [preset, setPreset] = useState<AdherenceRangePreset>("last-4-weeks");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const range = useMemo(
    () => adherenceDateRange(preset, today),
    [preset, today]
  );
  const { data, isPending, isError } = useClientAdherence(
    clientId,
    range.from,
    range.to
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {RANGE_PRESETS.map((r) => (
          <Button
            key={r.key}
            color={preset === r.key ? "primary" : "default"}
            size="sm"
            variant={preset === r.key ? "solid" : "bordered"}
            onPress={() => setPreset(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {isPending ? (
        <div className="flex justify-center p-12">
          <Spinner color="primary" />
        </div>
      ) : isError || data === undefined ? (
        <p className="p-6 text-center text-sm text-default-500">
          No pudimos cargar la adherencia.
        </p>
      ) : (
        <>
          <div className="flex gap-3">
            <MetricCard
              metric={ADHERENCE_METRICS.engagement}
              value={data.report.totals.engagementPct}
            />
            <MetricCard
              metric={ADHERENCE_METRICS.adherence}
              value={data.report.totals.adherencePct}
            />
          </div>

          <Card>
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Cumplimiento por semana
                </p>
                <div className="flex items-center gap-3 text-[11px] text-default-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    Engagement
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    On-plan
                  </span>
                </div>
              </div>
              <WeekBars weeks={data.report.weeks} />
            </CardBody>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Chip color="success" variant="flat">
              Comió el plan: {data.report.statusBreakdown.eaten_planned}
            </Chip>
            <Chip color="warning" variant="flat">
              Comió otra cosa: {data.report.statusBreakdown.eaten_other}
            </Chip>
            <Chip color="danger" variant="flat">
              Se la saltó: {data.report.statusBreakdown.skipped}
            </Chip>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">
              Comidas registradas
            </p>
            {data.logs.length === 0 ? (
              <p className="text-sm text-default-400">
                Sin registros en este rango.
              </p>
            ) : (
              data.logs.map((log) => <LoggedMeal key={log.id} log={log} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
