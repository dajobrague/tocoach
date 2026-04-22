"use client";

import type { InstantSaveStatus } from "@/lib/hooks/use-instant-save";

import { Icon } from "@iconify/react";

interface InstantSaveBadgeProps {
  status: InstantSaveStatus;
  error?: string | null;
  className?: string;
}

/**
 * Compact visual indicator for `useInstantSave`. Designed to sit next to a
 * section title so the user sees live save feedback without a Save button.
 */
export function InstantSaveBadge({
  status,
  error,
  className,
}: InstantSaveBadgeProps) {
  const base =
    "inline-flex items-center gap-1 text-xs font-medium transition-opacity";
  const cls = className ? `${base} ${className}` : base;

  if (status === "saving") {
    return (
      <span className={`${cls} text-default-500`}>
        <Icon
          className="animate-spin"
          height={14}
          icon="solar:refresh-linear"
          width={14}
        />
        Guardando…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className={`${cls} text-success-600`}>
        <Icon height={14} icon="solar:check-circle-bold" width={14} />
        Guardado
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className={`${cls} text-danger-600`}
        title={error ?? "Error al guardar"}
      >
        <Icon height={14} icon="solar:danger-triangle-bold" width={14} />
        Error al guardar
      </span>
    );
  }

  return null;
}
