"use client";

import { Spinner } from "@heroui/react";

import { resolveNutritionTabView } from "@/components/dashboard/client-profile/tabs/nutrition-tab-view";
import TemplatesContent from "@/components/dashboard/templates-content";
import { CycleTemplatesContent } from "@/features/trainer/cycles/cycle-templates-content";
import { useNutritionV2FlagStatus } from "@/features/trainer/nav/use-nutrition-v2-flag";

/**
 * Same flag decision as the client-profile Nutrición tab: trainer tools on →
 * the v2 meal-cycle template library; otherwise the legacy nutrition_plans
 * templates. Bridge until nutrition v1 is retired by the rollout.
 */
export default function NutritionTemplatesPage() {
  const { trainerEnabled, isLoading } = useNutritionV2FlagStatus();
  const view = resolveNutritionTabView(trainerEnabled, isLoading);

  if (view === "loading") {
    return (
      <div className="flex justify-center p-12">
        <Spinner color="primary" />
      </div>
    );
  }

  return view === "cycle-builder" ? (
    <CycleTemplatesContent />
  ) : (
    <TemplatesContent type="nutrition" />
  );
}
