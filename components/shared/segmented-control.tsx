"use client";

import React from "react";

/** Segmented control manual (track soft + pill activa con shadow). Se usa en
 *  lugar de <Tabs> de HeroUI: variant="bordered" + color="primary" se sentía
 *  como control de formulario y desfasaba con los cards soft del lenguaje
 *  moderno. Fuente: dashboard-content / training-tabs. */
/** `sm` es la medida del dashboard de cliente (móvil, seis períodos en el
 *  ancho de un teléfono); `md` la de una barra de filtros de escritorio, que
 *  necesita respirar. Fuente de `md`: microcycle/metrics-section. */
const SIZES = {
  sm: "px-1.5 py-1.5 text-xs",
  md: "px-4 py-1.5 text-sm",
} as const;

export function SegmentedControl<K extends string>({
  ariaLabel,
  className = "",
  onChange,
  options,
  size = "sm",
  value,
}: {
  ariaLabel: string;
  /** Se concatena al track. Para soltar el `w-full` por defecto (una barra de
   *  filtros no ocupa el ancho) hace falta `!`: `"!w-auto"`. */
  className?: string;
  onChange: (key: K) => void;
  options: readonly { key: K; label: string }[];
  size?: keyof typeof SIZES;
  value: K;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={`flex w-full rounded-lg bg-default-100 p-1 ${className}`}
      role="tablist"
    >
      {options.map(({ key, label }) => {
        const isActive = value === key;

        return (
          <button
            key={key}
            aria-selected={isActive}
            className={`flex-1 whitespace-nowrap rounded-md transition ${SIZES[size]} ${
              isActive
                ? "bg-content1 text-foreground shadow-sm font-medium"
                : "text-default-500 hover:text-default-700 font-normal"
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
