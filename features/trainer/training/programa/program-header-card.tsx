"use client";

// Cabecera del programa seleccionado: nombre con rename inline (patrón de
// cycle-summary-card), chips de estado y categoría, fecha de inicio, menú ⋮
// (Editar / Guardar como plantilla / Eliminar) y strip de métricas hairline.

import type { WorkoutProgram } from "./training-api";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useRef, useState } from "react";

import {
  CATEGORY_VISUAL,
  formatDateEs,
  programCategory,
  programStatus,
} from "./programa-format";

interface ProgramHeaderCardProps {
  program: WorkoutProgram;
  /** Duración actual del microciclo (para la métrica "Microciclo"). */
  microcycleDays: number;
  isUpdating: boolean;
  updateError: string | null;
  onRename: (name: string) => void;
  onEdit: () => void;
  onSaveAsTemplate: () => void;
  onDelete: () => void;
}

export function ProgramHeaderCard({
  program,
  microcycleDays,
  isUpdating,
  updateError,
  onRename,
  onEdit,
  onSaveAsTemplate,
  onDelete,
}: ProgramHeaderCardProps) {
  const category = programCategory(program);
  const visual = CATEGORY_VISUAL[category];
  const status = programStatus(program.status);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Se marca en Escape para que el blur del input no committee el cambio.
  const cancelName = useRef(false);

  const exerciseCount = useMemo(
    () =>
      program.sessions.reduce(
        (total, session) => total + session.exercises.length,
        0
      ),
    [program.sessions]
  );

  const startEditName = () => {
    setNameDraft(program.name);
    setEditingName(true);
  };

  const commitName = () => {
    const next = nameDraft.trim();

    if (next.length > 0 && next !== program.name) onRename(next);
    setEditingName(false);
  };

  const metrics: Array<{ label: string; value: string }> = [
    {
      label: "Sesiones",
      value: String(program.sessions.length),
    },
    {
      label: "Microciclo",
      value: `${microcycleDays} ${microcycleDays === 1 ? "día" : "días"}`,
    },
    {
      label: "Ejercicios",
      value: String(exerciseCount),
    },
    {
      label: "Inicio",
      value: formatDateEs(program.assignedDate),
    },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${visual.square}`}
            >
              <Icon icon={visual.icon} width={24} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {editingName ? (
                  <input
                    autoFocus
                    aria-label="Nombre del programa"
                    className="min-w-0 rounded-medium border border-blue-400 bg-white px-2 py-0.5 text-base font-bold text-gray-900 outline-none"
                    value={nameDraft}
                    onBlur={() => {
                      if (cancelName.current) {
                        cancelName.current = false;
                        setEditingName(false);

                        return;
                      }
                      commitName();
                    }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      else if (event.key === "Escape") {
                        cancelName.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="group/name -mx-1.5 flex min-w-0 items-center gap-1.5 rounded-medium px-1.5 py-0.5 text-left transition-colors hover:bg-gray-100"
                    title="Editar nombre"
                    type="button"
                    onClick={startEditName}
                  >
                    <h2 className="truncate text-base font-bold text-gray-900 decoration-gray-300 decoration-dotted underline-offset-4 group-hover/name:underline">
                      {program.name}
                    </h2>
                    <Icon
                      className="shrink-0 text-default-400 transition-colors group-hover/name:text-default-700"
                      icon="solar:pen-linear"
                      width={14}
                    />
                  </button>
                )}
                <Chip color={status.color} size="sm" variant="flat">
                  {status.label}
                </Chip>
                <Chip
                  className={visual.square}
                  size="sm"
                  startContent={<Icon icon={visual.icon} width={12} />}
                  variant="flat"
                >
                  {visual.label}
                </Chip>
              </div>
              <p className="text-xs text-default-500">
                {program.type}
                {category === "strength" && program.division.length > 0
                  ? ` · ${program.division}`
                  : ""}
                {` · desde ${formatDateEs(program.assignedDate)}`}
              </p>
            </div>
          </div>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label="Acciones del programa"
                isDisabled={isUpdating}
                size="sm"
                variant="light"
              >
                <Icon icon="solar:menu-dots-bold" width={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Acciones del programa"
              onAction={(key) => {
                if (key === "edit") onEdit();
                else if (key === "template") onSaveAsTemplate();
                else if (key === "delete") onDelete();
              }}
            >
              <DropdownItem
                key="edit"
                startContent={<Icon icon="solar:pen-linear" width={16} />}
              >
                Editar
              </DropdownItem>
              <DropdownItem
                key="template"
                startContent={<Icon icon="solar:save-bold" width={16} />}
              >
                Guardar como plantilla
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={16} />
                }
              >
                Eliminar
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-gray-100 bg-gray-100 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col gap-0.5 bg-white p-3"
            >
              <span className="text-[11px] font-medium text-default-500">
                {metric.label}
              </span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {updateError !== null && (
          <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {updateError}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
