"use client";

import { useState } from "react";

import { CalendarSection } from "@/features/trainer/cycles/calendar-section";
import { CycleBuilderContent } from "@/features/trainer/cycles/cycle-builder-content";

interface NutritionV2PanelProps {
  clientId: number;
}

type PanelView = "plan" | "calendario";

/**
 * The flag-on nutrition area for a client. The plan (cycle builder) is the home
 * view; "Ver calendario" swaps to the date-by-date calendar with overrides, and
 * a back button returns to the plan. No tab bar — one primary surface.
 */
export function NutritionV2Panel({ clientId }: NutritionV2PanelProps) {
  const [view, setView] = useState<PanelView>("plan");

  return (
    <div className="flex flex-col gap-4">
      {view === "plan" ? (
        <CycleBuilderContent
          clientId={clientId}
          onViewCalendar={() => setView("calendario")}
        />
      ) : (
        <CalendarSection clientId={clientId} onBack={() => setView("plan")} />
      )}
    </div>
  );
}
