"use client";

import { Tab, Tabs } from "@heroui/react";
import { useState } from "react";

import { AdherenceSection } from "@/features/trainer/adherence/adherence-section";
import { CalendarSection } from "@/features/trainer/cycles/calendar-section";
import { CycleBuilderContent } from "@/features/trainer/cycles/cycle-builder-content";

interface NutritionV2PanelProps {
  clientId: number;
}

type PanelView = "plan" | "calendario" | "adherencia";

/**
 * The flag-on nutrition area for a client: a "Plan / Calendario / Adherencia"
 * toggle over the cycle builder (P3/P4), the calendar overlay with overrides
 * (P7-T3), and the adherence view (P5-T6). One toggle, no second nav entry — a
 * coach sees the plan, the date-by-date overrides, and adherence in one place.
 */
export function NutritionV2Panel({ clientId }: NutritionV2PanelProps) {
  const [view, setView] = useState<PanelView>("plan");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        aria-label="Nutrición"
        selectedKey={view}
        onSelectionChange={(key) => setView(key as PanelView)}
      >
        <Tab key="plan" title="Plan" />
        <Tab key="calendario" title="Calendario" />
        <Tab key="adherencia" title="Adherencia" />
      </Tabs>

      {view === "plan" ? (
        <CycleBuilderContent clientId={clientId} />
      ) : view === "calendario" ? (
        <CalendarSection clientId={clientId} />
      ) : (
        <AdherenceSection clientId={clientId} />
      )}
    </div>
  );
}
