"use client";

import type { ClientDietPreset } from "@/lib/nutrition/cycles/client-week";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";

import { SectionHeader } from "@/components/client-dashboard/client-page";
import { MACRO_COLORS } from "@/components/client-dashboard/meal-cycle/macro-ui";
import { IconTile } from "@/components/shared/icon-tile";

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
    <section>
      <SectionHeader className="!mb-1" title="Tus objetivos nutricionales" />
      <p className="mb-4 text-[15px] leading-snug text-default-500">
        Tu entrenador gestiona tu dieta por objetivos: organiza tus comidas
        libremente para acercarte a estas metas.
      </p>

      <div className="flex flex-col gap-3">
        {goals !== null ? (
          <GoalCard
            highlight
            icon="solar:target-linear"
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
    </section>
  );
}

/**
 * Tarjeta de un objetivo (nombre + kcal + macros). Exportada además para la
 * vista con plan: ahí se muestra UNA sola — la del objetivo al que el día
 * seleccionado está vinculado. Card plana (sin anillo de marca): `highlight`
 * solo tiñe el icono.
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
    <article className="rounded-large bg-content1 px-4 py-3.5 shadow-small">
      <div className="flex items-center gap-2.5">
        <IconTile
          icon={icon}
          size="sm"
          tone={highlight ? "primary" : "default"}
        />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {name}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-default-500">
          <span className="font-heading text-xl tracking-[-0.01em] text-foreground tabular-nums">
            {Math.round(values.kcal).toLocaleString("es")}
          </span>{" "}
          kcal
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {macros.map((macro) => (
          <div
            key={macro.label}
            className="grid grid-cols-[auto_1fr] items-center gap-x-1.5 rounded-xl bg-default-100 px-2.5 py-2"
          >
            <span className={`h-2 w-2 rounded-full ${macro.dot}`} />
            <span className="text-[15px] font-semibold text-foreground tabular-nums">
              {Math.round(macro.grams)} g
            </span>
            <span className="col-start-2 text-xs text-default-500">
              {macro.label}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
