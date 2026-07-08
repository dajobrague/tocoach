"use client";

import type { PlannedTotals } from "@/components/client-dashboard/meal-cycle/slot-grouping";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  KcalRing,
  MACRO_COLORS,
  MacroProgressBar,
} from "@/components/client-dashboard/meal-cycle/macro-ui";
import { pctOf } from "@/components/client-dashboard/meal-cycle/slot-grouping";

/**
 * "Nutrición del día" — the day's planned totals, against the goals the
 * trainer set when they exist (ring + per-macro bars, mirroring the trainer's
 * day panel) or as a compact 4-stat row when no goals are saved yet.
 */
export function DaySummaryCard({
  totals,
  goals,
  goalName = null,
}: {
  totals: PlannedTotals;
  goals: NutritionGoals | null;
  /** Name of the day's assigned objective, when the trainer set one. */
  goalName?: string | null;
}) {
  return (
    <Card data-testid="day-summary">
      <CardBody className="gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            className="text-primary"
            icon="solar:pie-chart-2-linear"
            width={18}
          />
          <h2 className="text-sm font-semibold text-foreground">
            Nutrición del día
          </h2>
          {goalName !== null && (
            <span className="ml-auto rounded-full border border-primary/50 px-2 py-0.5 text-[11px] font-medium text-primary">
              {goalName}
            </span>
          )}
        </div>

        {goals === null ? (
          <TotalsRow totals={totals} />
        ) : (
          <GoalsProgress goals={goals} totals={totals} />
        )}
      </CardBody>
    </Card>
  );
}

/** No goals saved: the planned totals as a simple 4-stat strip. */
function TotalsRow({ totals }: { totals: PlannedTotals }) {
  const stats = [
    { label: "Calorías", value: `${Math.round(totals.kcal)}`, unit: "kcal" },
    { label: "Proteína", value: `${Math.round(totals.protein_g)}`, unit: "g" },
    { label: "Carbos", value: `${Math.round(totals.carbs_g)}`, unit: "g" },
    { label: "Grasa", value: `${Math.round(totals.fat_g)}`, unit: "g" },
  ];

  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-default-200 bg-content2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-0.5 border-l border-default-200 py-3 first:border-l-0"
        >
          <span className="text-sm font-bold text-foreground tabular-nums">
            {stat.value}
            <span className="ml-0.5 text-[10px] font-medium text-default-400">
              {stat.unit}
            </span>
          </span>
          <span className="text-[11px] text-default-500">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Goals saved: kcal ring + per-macro progress bars vs the daily targets. */
function GoalsProgress({
  totals,
  goals,
}: {
  totals: PlannedTotals;
  goals: NutritionGoals;
}) {
  const kcalPct = pctOf(totals.kcal, goals.kcal);

  const macros = [
    {
      label: "Proteína",
      ...MACRO_COLORS.protein,
      value: totals.protein_g,
      target: goals.protein_g,
    },
    {
      label: "Carbohidratos",
      ...MACRO_COLORS.carbs,
      value: totals.carbs_g,
      target: goals.carbs_g,
    },
    {
      label: "Grasas",
      ...MACRO_COLORS.fat,
      value: totals.fat_g,
      target: goals.fat_g,
    },
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <KcalRing value={kcalPct} />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-foreground tabular-nums">
            {Math.round(totals.kcal).toLocaleString("es")}{" "}
            <span className="text-sm font-medium text-default-400">
              / {goals.kcal.toLocaleString("es")} kcal
            </span>
          </p>
          <p className="text-xs text-default-500">
            {kcalPct}% de tu objetivo diario
          </p>
          <MacroProgressBar
            className="mt-2"
            color="bg-primary"
            value={kcalPct}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {macros.map((macro) => (
          <div key={macro.label} className="flex items-center gap-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${macro.dot}`} />
            <span className="w-28 shrink-0 text-xs text-default-600">
              {macro.label}
            </span>
            <MacroProgressBar
              color={macro.bar}
              value={pctOf(macro.value, macro.target)}
            />
            <span className="w-16 shrink-0 text-right text-xs font-medium text-default-500 tabular-nums">
              {Math.round(macro.value)}/{macro.target}g
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
