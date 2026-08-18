"use client";

import React from "react";

/** Segmented control manual (track soft + pill activa con shadow). Se usa en
 *  lugar de <Tabs> de HeroUI: variant="bordered" + color="primary" se sentía
 *  como control de formulario y desfasaba con los cards soft del lenguaje
 *  moderno. Fuente: dashboard-content / training-tabs. */
export function SegmentedControl<K extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (key: K) => void;
  options: readonly { key: K; label: string }[];
  value: K;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex w-full rounded-lg bg-default-100 p-1"
      role="tablist"
    >
      {options.map(({ key, label }) => {
        const isActive = value === key;

        return (
          <button
            key={key}
            aria-selected={isActive}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs transition ${
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
