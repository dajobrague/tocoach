"use client";

import { Spinner } from "@heroui/react";

import NutritionTab from "./nutrition-tab";
import { NutritionV2Panel } from "./nutrition-v2-panel";
import { resolveNutritionTabView } from "./nutrition-tab-view";

import { useNutritionV2FlagStatus } from "@/features/trainer/nav/use-nutrition-v2-flag";

interface NutritionTabSwitchProps {
  clientId: string;
}

/**
 * Renders the Nutrición tab behind the nutrition_v2 flag: the new Plan /
 * Adherencia panel (cycle builder + adherence view) when enabled, the unchanged
 * legacy <NutritionTab> when disabled, and a small loading state while the flag
 * resolves.
 */
export function NutritionTabSwitch({ clientId }: NutritionTabSwitchProps) {
  const { enabled, isLoading } = useNutritionV2FlagStatus();
  const view = resolveNutritionTabView(enabled, isLoading);

  if (view === "loading") {
    return (
      <div
        className="flex justify-center p-12"
        data-testid="nutrition-tab-loading"
      >
        <Spinner color="primary" />
      </div>
    );
  }

  if (view === "cycle-builder") {
    return <NutritionV2Panel clientId={Number(clientId)} />;
  }

  return <NutritionTab clientId={clientId} />;
}
