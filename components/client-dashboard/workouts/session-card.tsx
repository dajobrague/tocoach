// Tile del tipo de sesión (fuerza, cardio…) con su color fijo de producto.
// Lo comparten las cards de sesión, la pantalla de sesión activa, el
// microciclo y el selector de "agregar de otro día".

import type { SessionType } from "@/types/training";

import { Icon } from "@iconify/react";

import { getSessionTypeStyle } from "./session-type-style";

export function SessionTypeTile({
  sessionType,
  size = "md",
  className = "",
}: {
  sessionType: SessionType | null | undefined;
  size?: "md" | "lg";
  className?: string;
}) {
  const style = getSessionTypeStyle(sessionType);

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${
        size === "lg" ? "h-12 w-12 rounded-[14px]" : "h-10 w-10 rounded-xl"
      } ${style.tileClass} ${className}`}
    >
      <Icon icon={style.icon} width={size === "lg" ? 26 : 22} />
    </span>
  );
}
