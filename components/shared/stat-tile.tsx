import React from "react";

import { IconTile } from "./icon-tile";

/** Celda de KPI de los dashboards de trainer: tile tintado + etiqueta encima
 *  del número, pie opcional. Vive en una rejilla `gap-px` sobre `bg-default-200`
 *  para que los hairlines los pinte el contenedor. Fuente: cycle-summary-card. */
export function StatTile({
  caption,
  children,
  icon,
  label,
  tone = "default",
  value,
}: {
  /** Línea de contexto bajo el número ("esta semana", "conectados hoy"). */
  caption?: string;
  /** Barra de progreso u otro extra bajo el pie. */
  children?: React.ReactNode;
  icon: string;
  label: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 bg-content1 p-4">
      <IconTile icon={icon} size="sm" tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-default-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-foreground">
          {value}
        </p>
        {caption !== undefined && (
          <p className="mt-1 truncate text-xs text-default-400">{caption}</p>
        )}
        {children}
      </div>
    </div>
  );
}
