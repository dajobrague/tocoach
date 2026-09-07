"use client";

import type { CycleSummary } from "./cycle-api";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { CycleSelector } from "./cycle-selector";
import { WeightHistoryModal } from "./weight-history-modal";

interface MealPlanHeaderProps {
  clientId: number;
  cycles: CycleSummary[];
  activeId: string | null;
  onSelectCycle: (id: string) => void;
  onNewCycle: () => void;
  onViewCalendar?: () => void;
}

export function MealPlanHeader({
  clientId,
  cycles,
  activeId,
  onSelectCycle,
  onNewCycle,
  onViewCalendar,
}: MealPlanHeaderProps) {
  const hasCycles = cycles.length > 0;
  // Weight evolution is a read-only lookup the trainer checks before
  // readjusting the diet; it is deliberately NOT wired to goals/calculator.
  const [weightOpen, setWeightOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Plan de comidas
        </h1>
        <p className="text-sm text-default-500">
          Construye planes de comidas con días, comidas y opciones.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasCycles && (
          <CycleSelector
            activeId={activeId}
            cycles={cycles}
            onSelect={onSelectCycle}
          />
        )}
        <Button
          startContent={<Icon icon="solar:graph-up-linear" width={18} />}
          variant="bordered"
          onPress={() => setWeightOpen(true)}
        >
          Ver evolución del peso
        </Button>
        {hasCycles && onViewCalendar !== undefined && (
          <Button
            startContent={<Icon icon="solar:calendar-linear" width={18} />}
            variant="bordered"
            onPress={onViewCalendar}
          >
            Ver calendario
          </Button>
        )}
        <Button
          className="bg-slate-900 text-white"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          onPress={onNewCycle}
        >
          Nuevo plan
        </Button>
      </div>

      <WeightHistoryModal
        clientId={clientId}
        isOpen={weightOpen}
        onClose={() => setWeightOpen(false)}
      />
    </div>
  );
}
