"use client";

import type { CycleSummary } from "./cycle-api";

import {
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { CYCLE_STATUS } from "./cycle-format";

interface CycleSelectorProps {
  cycles: CycleSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CycleSelector({
  cycles,
  activeId,
  onSelect,
}: CycleSelectorProps) {
  const active = cycles.find((cycle) => cycle.id === activeId) ?? null;
  const activeStatus = active !== null ? CYCLE_STATUS[active.status] : null;

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          className="group flex min-w-[14rem] items-center gap-2.5 rounded-large border border-gray-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow data-[open=true]:border-emerald-300 data-[open=true]:ring-1 data-[open=true]:ring-emerald-200"
          type="button"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-emerald-50 text-emerald-600">
            <Icon icon="solar:cup-hot-bold" width={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
              Ciclo actual
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-gray-900">
                {active?.name ?? "Sin ciclo"}
              </span>
              {activeStatus !== null && (
                <Chip
                  className="h-[18px] shrink-0 px-1"
                  color={activeStatus.color}
                  size="sm"
                  variant="flat"
                >
                  <span className="text-[10px] font-medium">
                    {activeStatus.label}
                  </span>
                </Chip>
              )}
            </span>
          </span>
          <Icon
            className="shrink-0 text-default-400 transition-transform group-data-[open=true]:rotate-180"
            icon="solar:alt-arrow-down-linear"
            width={16}
          />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Seleccionar ciclo"
        selectedKeys={activeId !== null ? [activeId] : []}
        selectionMode="single"
        onAction={(key) => onSelect(String(key))}
      >
        {cycles.map((cycle) => {
          const status = CYCLE_STATUS[cycle.status];

          return (
            <DropdownItem
              key={cycle.id}
              description={`${status.label} · ${cycle.duration_days} días`}
              startContent={
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              }
            >
              {cycle.name}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}
