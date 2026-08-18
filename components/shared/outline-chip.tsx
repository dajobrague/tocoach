import React from "react";

const TONES = {
  primary: "border-primary/50 text-primary",
  muted: "border-default-300 text-default-500",
  success: "border-success/50 text-success-700",
  warning: "border-warning/50 text-warning-700",
  danger: "border-danger/50 text-danger",
} as const;

/** Chip outline canónico del lenguaje moderno: borde + texto tintado sobre el
 *  fondo de la card, legible con cualquier tema de tenant (un tinte relleno
 *  puede tragarse texto del mismo tono). Fuente: meal-cycle/menu-picker. */
export function OutlineChip({
  children,
  className = "",
  tone = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
