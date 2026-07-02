"use client";

import type { CycleSummary } from "./cycle-api";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { CycleSelector } from "./cycle-selector";

interface MealPlanHeaderProps {
  cycles: CycleSummary[];
  activeId: string | null;
  onSelectCycle: (id: string) => void;
  onNewCycle: () => void;
  onViewCalendar?: () => void;
  onOpenGoals?: () => void;
}

export function MealPlanHeader({
  cycles,
  activeId,
  onSelectCycle,
  onNewCycle,
  onViewCalendar,
  onOpenGoals,
}: MealPlanHeaderProps) {
  const hasCycles = cycles.length > 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Plan de comidas
        </h1>
        <p className="text-sm text-default-500">
          Construye ciclos de comidas con días, comidas y opciones.
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
        {hasCycles && onViewCalendar !== undefined && (
          <Button
            startContent={<Icon icon="solar:calendar-linear" width={18} />}
            variant="bordered"
            onPress={onViewCalendar}
          >
            Ver calendario
          </Button>
        )}
        {hasCycles && onOpenGoals !== undefined && (
          <Button
            startContent={<Icon icon="solar:target-linear" width={18} />}
            variant="bordered"
            onPress={onOpenGoals}
          >
            Metas Nutricionales
          </Button>
        )}
        <Button
          className="bg-slate-900 text-white"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          onPress={onNewCycle}
        >
          Nuevo ciclo
        </Button>
      </div>
    </div>
  );
}
