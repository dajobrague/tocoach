"use client";

import type { PlannedTotals } from "@/components/client-dashboard/meal-cycle/slot-grouping";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";

import {
  KcalRing,
  MACRO_COLORS,
  MacroProgressBar,
  MacroStrip,
  SoftChip,
} from "@/components/client-dashboard/meal-cycle/macro-ui";
import { pctOf } from "@/components/client-dashboard/meal-cycle/slot-grouping";

/**
 * "Nutrición del día" — the day's planned totals, against the goals the
 * trainer set when they exist (ring + per-macro bars, mirroring the trainer's
 * day panel) or as a compact 4-stat strip when no goals are saved yet.
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
    <section
      className="rounded-large bg-content1 p-4 shadow-small"
      data-testid="day-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg leading-tight tracking-[-0.01em] text-foreground">
          Nutrición del día
        </h2>
        {goalName !== null && (
          <SoftChip className="min-w-0 max-w-[55%] truncate">
            {goalName}
          </SoftChip>
        )}
      </div>

      {goals === null ? (
        <div className="mt-3.5">
          <MacroStrip
            carbs_g={totals.carbs_g}
            fat_g={totals.fat_g}
            kcal={totals.kcal}
            protein_g={totals.protein_g}
          />
        </div>
      ) : (
        <GoalsProgress goals={goals} totals={totals} />
      )}
    </section>
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
      <div className="mb-4 mt-3.5 flex items-center gap-4">
        <KcalRing value={kcalPct} />
        <div className="min-w-0 flex-1">
          <p className="tabular-nums">
            <span className="font-heading text-[32px] leading-none tracking-[-0.02em] text-foreground">
              {Math.round(totals.kcal).toLocaleString("es")}
            </span>
            <span className="text-[15px] font-semibold text-default-500">
              {" "}
              / {goals.kcal.toLocaleString("es")} kcal
            </span>
          </p>
          <p className="mt-1.5 text-sm text-default-500">
            {kcalPct}% de tu objetivo diario
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {macros.map((macro) => (
          <div key={macro.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                <span className={`h-2 w-2 rounded-full ${macro.dot}`} />
                {macro.label}
              </span>
              <span className="text-default-500 tabular-nums">
                <span className="font-semibold text-foreground">
                  {Math.round(macro.value)}
                </span>{" "}
                / {macro.target} g
              </span>
            </div>
            <MacroProgressBar
              color={macro.bar}
              value={pctOf(macro.value, macro.target)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
