"use client";

// Una card-botón POR CATEGORÍA ("Programa de fuerza" | "Programa de cardio"),
// una al lado de la otra en el toolbar (Loom JC, 10 sep: "este mismo cuadro
// que pone programa actual, uno al lado del otro, uno para fuerza y otro para
// cardio"). Cada card lista SOLO los programas de su categoría (activos y
// pausados) + "Nuevo programa de …". La card enfocada (ring) es la que manda
// sobre la cabecera, los modales y el drawer.
// Imita el patrón visual de features/trainer/cycles/cycle-selector.tsx.

import type { ProgramCategory, WorkoutProgram } from "./training-api";

import {
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { CATEGORY_VISUAL, programStatus } from "./programa-format";

interface ProgramCategoryCardProps {
  category: ProgramCategory;
  /** Programas activos de ESTA categoría. */
  programs: WorkoutProgram[];
  /** Pausados de esta categoría — sección aparte para verlos y reactivarlos. */
  pausedPrograms: WorkoutProgram[];
  /** Programa que muestra la card (null = "Sin programa"). */
  selected: WorkoutProgram | null;
  /** true = esta card manda sobre la cabecera y los modales. */
  isFocused: boolean;
  onSelect: (programId: string) => void;
  onCreateNew: () => void;
}

const sessionsLabel = (count: number) =>
  `${count} ${count === 1 ? "sesión" : "sesiones"}`;

export function ProgramCategoryCard({
  category,
  programs,
  pausedPrograms,
  selected,
  isFocused,
  onSelect,
  onCreateNew,
}: ProgramCategoryCardProps) {
  const visual = CATEGORY_VISUAL[category];
  const label = visual.label.toLowerCase();
  const status = selected !== null ? programStatus(selected.status) : null;

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          className={`group flex min-w-[12rem] items-center gap-2.5 rounded-large border bg-white px-2.5 py-1.5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow data-[open=true]:border-slate-300 data-[open=true]:ring-1 data-[open=true]:ring-slate-200 ${
            isFocused
              ? "border-gray-400 ring-1 ring-gray-300"
              : "border-gray-200"
          }`}
          type="button"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${visual.square}`}
          >
            <Icon icon={visual.icon} width={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
              Programa de {label}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`truncate text-sm font-semibold ${
                  selected !== null ? "text-gray-900" : "text-default-400"
                }`}
              >
                {selected?.name ?? "Sin programa"}
              </span>
              {status !== null && (
                <Chip
                  className="h-[18px] shrink-0 px-1"
                  color={status.color}
                  size="sm"
                  variant="flat"
                >
                  <span className="text-[10px] font-medium">
                    {status.label}
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
        aria-label={`Seleccionar programa de ${label}`}
        selectedKeys={selected !== null ? [selected.programId] : []}
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
                  title="Activos"
                >
                  {programs.map((program) => (
                    <DropdownItem
                      key={program.programId}
                      description={sessionsLabel(program.sessions.length)}
                      endContent={
                        /* Pin = programa principal (ancla del microciclo). */
                        program.isPrimary === true ? (
                          <Icon
                            className="shrink-0 text-default-400"
                            icon="solar:star-bold"
                            width={13}
                          />
                        ) : null
                      }
                      startContent={
                        <span
                          className={`h-2 w-2 rounded-full ${visual.dot}`}
                        />
                      }
                    >
                      {program.name}
                    </DropdownItem>
                  ))}
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
                  {pausedPrograms.map((program) => (
                    <DropdownItem
                      key={program.programId}
                      description={sessionsLabel(program.sessions.length)}
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
                  ))}
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
              Nuevo programa de {label}
            </DropdownItem>
          </DropdownSection>,
        ]}
      </DropdownMenu>
    </Dropdown>
  );
}
