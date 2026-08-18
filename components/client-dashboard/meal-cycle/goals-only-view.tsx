"use client";

import type { ClientDietPreset } from "@/lib/nutrition/cycles/client-week";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MACRO_COLORS } from "@/components/client-dashboard/meal-cycle/macro-ui";

interface GoalsOnlyViewProps {
  /** The client's default daily targets, or null when only presets exist. */
  goals: NutritionGoals | null;
  /** Named per-day objectives ("Día de entrenamiento"), possibly empty. */
  presets: ClientDietPreset[];
}

/**
 * Goals-only nutrition delivery: no meal plan, no PDF — the client manages
 * their own food against the macro targets the trainer set. Shows the default
 * daily objective plus every named objective, in the same macro visual
 * language as the plan view.
 */
export function GoalsOnlyView({ goals, presets }: GoalsOnlyViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          Tus objetivos nutricionales
        </h2>
        <p className="text-sm text-default-500">
          Tu entrenador gestiona tu dieta por objetivos: organiza tus comidas
          libremente para acercarte a estas metas.
        </p>
      </div>

      {goals !== null ? (
        <GoalCard
          highlight
          icon="solar:target-bold"
          name="Objetivo diario"
          values={goals}
        />
      ) : null}

      {presets.map((preset) => (
        <GoalCard
          key={preset.id}
          icon="solar:target-linear"
          name={preset.name}
          values={preset}
        />
      ))}
    </div>
  );
}

/**
 * Tarjeta de un objetivo (nombre + kcal + macros). Exportada además para la
 * vista con plan: ahí se muestra UNA sola — la del objetivo al que el día
 * seleccionado está vinculado.
 */
export function GoalCard({
  name,
  values,
  icon,
  highlight = false,
}: {
  name: string;
  values: NutritionGoals;
  icon: string;
  highlight?: boolean;
}) {
  const macros = [
    {
      label: "Proteína",
      grams: values.protein_g,
      dot: MACRO_COLORS.protein.dot,
    },
    { label: "Carbos", grams: values.carbs_g, dot: MACRO_COLORS.carbs.dot },
    { label: "Grasa", grams: values.fat_g, dot: MACRO_COLORS.fat.dot },
  ];

  return (
    <Card className={highlight ? "border border-primary/30" : ""}>
      <CardBody className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Icon
              className={highlight ? "text-primary" : "text-default-400"}
              icon={icon}
              width={18}
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {name}
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-foreground tabular-nums">
            {Math.round(values.kcal)}{" "}
            <span className="text-xs font-medium text-default-400">kcal</span>
          </span>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-default-200 bg-content2">
          {macros.map((macro) => (
            <div
              key={macro.label}
              className="flex flex-col items-center gap-0.5 border-l border-default-200 py-2 first:border-l-0"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-foreground tabular-nums">
                <span className={`h-1.5 w-1.5 rounded-full ${macro.dot}`} />
                {Math.round(macro.grams)} g
              </span>
              <span className="text-[10px] uppercase tracking-wide text-default-400">
                {macro.label}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
