"use client";

// Card-botón "PROGRAMA ACTUAL" con dropdown de todos los programas activos
// (ambas categorías, cada uno con su punto de color) + "Nuevo programa".
// Imita el patrón visual de features/trainer/cycles/cycle-selector.tsx.

import type { WorkoutProgram } from "./training-api";

import {
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  CATEGORY_VISUAL,
  programCategory,
  programStatus,
} from "./programa-format";

interface ProgramSelectorProps {
  /** Programas con status "active". */
  programs: WorkoutProgram[];
  /** Programas pausados — sección aparte para poder verlos y reactivarlos. */
  pausedPrograms: WorkoutProgram[];
  activeId: string | null;
  onSelect: (programId: string) => void;
  onCreateNew: () => void;
}

export function ProgramSelector({
  programs,
  pausedPrograms,
  activeId,
  onSelect,
  onCreateNew,
}: ProgramSelectorProps) {
  const active =
    [...programs, ...pausedPrograms].find(
      (program) => program.programId === activeId
    ) ?? null;
  const activeVisual =
    active !== null ? CATEGORY_VISUAL[programCategory(active)] : null;
  const activeStatus = active !== null ? programStatus(active.status) : null;

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          className="group flex min-w-[14rem] items-center gap-2.5 rounded-large border border-gray-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow data-[open=true]:border-slate-300 data-[open=true]:ring-1 data-[open=true]:ring-slate-200"
          type="button"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${activeVisual?.square ?? "bg-slate-100 text-slate-700"}`}
          >
            <Icon
              icon={activeVisual?.icon ?? "solar:dumbbell-bold"}
              width={18}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
              Programa actual
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-gray-900">
                {active?.name ?? "Sin programa"}
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
            className="shrink-0 text-gray-600 transition-transform group-data-[open=true]:rotate-180"
            icon="solar:alt-arrow-down-linear"
            width={16}
          />
        </button>
      </DropdownTrigger>
      {/* selectionMode es obligatorio para que react-aria pinte selectedKeys;
          onAction sigue disparando una sola vez por click. */}
      <DropdownMenu
        aria-label="Seleccionar programa"
        selectedKeys={activeId !== null ? [activeId] : []}
        selectionMode="single"
        onAction={(key) => {
          if (key === "new-program") onCreateNew();
          else onSelect(String(key));
        }}
      >
        {[
          ...(programs.length > 0
            ? [
                <DropdownSection
                  key="active-section"
                  showDivider
                  title="Programas activos"
                >
                  {programs.map((program) => {
                    const visual = CATEGORY_VISUAL[programCategory(program)];

                    return (
                      <DropdownItem
                        key={program.programId}
                        description={`${visual.label} · ${program.sessions.length} ${program.sessions.length === 1 ? "sesión" : "sesiones"}`}
                        startContent={
                          <span
                            className={`h-2 w-2 rounded-full ${visual.dot}`}
                          />
                        }
                      >
                        {program.name}
                      </DropdownItem>
                    );
                  })}
                </DropdownSection>,
              ]
            : []),
          /* Pausados accesibles (llamada 29 Jul): antes desaparecían de la
             vista sin forma de reactivarlos. */
          ...(pausedPrograms.length > 0
            ? [
                <DropdownSection
                  key="paused-section"
                  showDivider
                  title="Pausados"
                >
                  {pausedPrograms.map((program) => {
                    const visual = CATEGORY_VISUAL[programCategory(program)];

                    return (
                      <DropdownItem
                        key={program.programId}
                        description={`${visual.label} · ${program.sessions.length} ${program.sessions.length === 1 ? "sesión" : "sesiones"}`}
                        startContent={
                          <Icon
                            className="text-default-400"
                            icon="solar:pause-circle-linear"
                            width={14}
                          />
                        }
                      >
                        <span className="text-default-600">{program.name}</span>
                      </DropdownItem>
                    );
                  })}
                </DropdownSection>,
              ]
            : []),
          <DropdownSection key="actions-section">
            <DropdownItem
              key="new-program"
              startContent={
                <Icon
                  className="text-default-500"
                  icon="solar:add-circle-bold"
                  width={16}
                />
              }
            >
              Nuevo programa
            </DropdownItem>
          </DropdownSection>,
        ]}
      </DropdownMenu>
    </Dropdown>
  );
}
