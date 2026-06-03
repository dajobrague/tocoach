"use client";

import { Tab, Tabs } from "@heroui/react";
import { useState } from "react";

import { AdherenceSection } from "@/features/trainer/adherence/adherence-section";
import { CycleBuilderContent } from "@/features/trainer/cycles/cycle-builder-content";

interface NutritionV2PanelProps {
  clientId: number;
}

/**
 * The flag-on nutrition area for a client: a "Plan / Adherencia" toggle over the
 * cycle builder (P3/P4) and the adherence view (P5-T6). Keeping both behind one
 * toggle means no second nav entry and a coach sees the plan and how the client
 * is following it in one place.
 */
export function NutritionV2Panel({ clientId }: NutritionV2PanelProps) {
  const [view, setView] = useState<"plan" | "adherencia">("plan");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        aria-label="Nutrición"
        selectedKey={view}
        onSelectionChange={(key) => setView(key as "plan" | "adherencia")}
      >
        <Tab key="plan" title="Plan" />
        <Tab key="adherencia" title="Adherencia" />
      </Tabs>

      {view === "plan" ? (
        <CycleBuilderContent clientId={clientId} />
      ) : (
        <AdherenceSection clientId={clientId} />
      )}
    </div>
  );
}
