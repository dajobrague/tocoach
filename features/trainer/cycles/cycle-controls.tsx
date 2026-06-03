"use client";

import type { CycleSummary } from "./cycle-api";

import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface CycleControlsProps {
  cycle: CycleSummary;
  isUpdating: boolean;
  activateError: string | null;
  onActivate: () => void;
  onArchive: () => void;
}

const STATUS: Record<
  CycleSummary["status"],
  { label: string; color: "default" | "success" | "warning" }
> = {
  draft: { label: "Borrador", color: "warning" },
  active: { label: "Activo", color: "success" },
  archived: { label: "Archivado", color: "default" },
};

export function CycleControls({
  cycle,
  isUpdating,
  activateError,
  onActivate,
  onArchive,
}: CycleControlsProps) {
  const status = STATUS[cycle.status];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">{cycle.name}</h2>
          <Chip color={status.color} size="sm" variant="flat">
            {status.label}
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          {cycle.status !== "active" ? (
            <Button
              color="success"
              isDisabled={isUpdating}
              size="sm"
              startContent={<Icon icon="solar:play-circle-linear" width={16} />}
              onPress={onActivate}
            >
              Activar
            </Button>
          ) : null}
          {cycle.status !== "archived" ? (
            <Button
              isDisabled={isUpdating}
              size="sm"
              startContent={<Icon icon="solar:archive-linear" width={16} />}
              variant="flat"
              onPress={onArchive}
            >
              Archivar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-default-500">
        <span>{cycle.duration_days} días</span>
        <span>Inicio: {cycle.start_date}</span>
      </div>

      {activateError !== null ? (
        <div
          className="flex items-center gap-2 rounded-md border border-danger-200 bg-danger-50 p-2 text-sm text-danger-700"
          data-testid="activate-error"
        >
          <Icon icon="solar:danger-triangle-linear" width={16} />
          {activateError}
        </div>
      ) : null}
    </div>
  );
}
