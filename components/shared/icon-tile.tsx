import { Icon } from "@iconify/react";
import React from "react";

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success-700",
  warning: "bg-warning/10 text-warning-700",
  danger: "bg-danger/10 text-danger",
  default: "bg-default-100 text-default-600",
} as const;

const SIZES = {
  sm: { box: "h-9 w-9", icon: 18 },
  md: { box: "h-10 w-10", icon: 20 },
  lg: { box: "h-12 w-12", icon: 24 },
} as const;

/** Tile cuadrado con icono tintado — el elemento líder ubicuo del lenguaje
 *  moderno (cards, headers de modal, filas). Tintes alpha dark-safe. */
export function IconTile({
  className = "",
  icon,
  size = "md",
  tone = "primary",
}: {
  className?: string;
  icon: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
}) {
  const s = SIZES[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${s.box} ${TONES[tone]} ${className}`}
      // Appended className does not override same-property utilities; consumers must use ! to override sizing
    >
      <Icon icon={icon} width={s.icon} />
    </div>
  );
}
