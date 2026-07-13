"use client";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import NutritionTab from "./nutrition-tab";
import { NutritionV2Panel } from "./nutrition-v2-panel";
import { resolveNutritionTabView } from "./nutrition-tab-view";

import { useNutritionV2FlagStatus } from "@/features/trainer/nav/use-nutrition-v2-flag";

interface NutritionTabSwitchProps {
  clientId: string;
}

/**
 * Renders the Nutrición tab behind the nutrition-v2 flags:
 * - trainer tools ON → the v2 Plan/Adherencia panel. In PREPARE mode (clients
 *   still on legacy) a banner says so and offers the legacy editor — the
 *   trainer keeps serving current clients in v1 while building in v2.
 * - trainer tools OFF → the unchanged legacy <NutritionTab>.
 */
export function NutritionTabSwitch({ clientId }: NutritionTabSwitchProps) {
  const { trainerEnabled, prepareMode, isLoading } = useNutritionV2FlagStatus();
  const view = resolveNutritionTabView(trainerEnabled, isLoading);
  // Prepare-mode escape hatch: view the legacy editor without flipping flags.
  const [showLegacy, setShowLegacy] = useState(false);

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
    return (
      <div className="flex flex-col gap-3">
        {prepareMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-large border border-primary/25 bg-primary/5 px-4 py-2.5">
            <Icon
              className="shrink-0 text-primary"
              icon="solar:info-circle-linear"
              width={18}
            />
            <p className="min-w-0 flex-1 text-xs text-default-600">
              Estás preparando la nueva nutrición.{" "}
              <span className="font-medium text-foreground">
                Tus clientes aún ven la versión anterior
              </span>{" "}
              — lo que construyas aquí no les llega hasta que actives el cambio.
            </p>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setShowLegacy((value) => value === false)}
            >
              {showLegacy ? "Volver al editor nuevo" : "Ver versión anterior"}
            </Button>
          </div>
        ) : null}

        {prepareMode && showLegacy ? (
          <NutritionTab clientId={clientId} />
        ) : (
          <NutritionV2Panel clientId={Number(clientId)} />
        )}
      </div>
    );
  }

  return <NutritionTab clientId={clientId} />;
}
