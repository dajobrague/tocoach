// Card reusable de sesión. Pura presentación: tag por tipo, nombre,
// recuento, slot opcional para fecha (modo "pasado") y slot opcional
// para acción/expansión (modo "disponible"). La lógica de expansión
// vive en available-sessions-list.tsx.

import type { SessionType } from "@/types/training";
import type { ReactNode } from "react";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { getSessionTypeStyle } from "./session-type-style";

interface Props {
  name: string;
  sessionType: SessionType | null;
  exerciseCount: number;
  dateBadge?: ReactNode;
  rightContent?: ReactNode;
  expandedContent?: ReactNode;
  isExpanded?: boolean;
  /** Featured variant: trainer-prescribed session for the visible date. */
  isRecommended?: boolean;
  /**
   * Programa al que pertenece la sesión. Solo llega cuando el cliente
   * tiene varios programas activos (fuerza + cardio) — con uno solo la
   * etiqueta sería ruido.
   */
  programName?: string | null;
}

export function SessionCard({
  name,
  sessionType,
  exerciseCount,
  dateBadge,
  rightContent,
  expandedContent,
  isExpanded = false,
  isRecommended = false,
  programName = null,
}: Props) {
  const style = getSessionTypeStyle(sessionType);

  return (
    <Card
      className={isRecommended ? "w-full ring-1 ring-primary" : "w-full"}
      shadow="sm"
    >
      <CardBody className="p-4">
        {isRecommended ? (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1">
              <Icon
                aria-hidden="true"
                className="text-primary-foreground"
                icon="solar:medal-ribbon-star-bold"
                width={13}
              />
              <span className="text-[12px] font-semibold text-primary-foreground leading-none">
                Recomendado por tu coach
              </span>
            </span>
          </div>
        ) : null}
        <div className="flex items-start gap-3 w-full">
          {dateBadge ? (
            <div className="shrink-0">{dateBadge}</div>
          ) : (
            <div
              aria-label={`Sesión de ${style.label.toLowerCase()}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              role="img"
            >
              <Icon
                aria-hidden="true"
                className="text-primary"
                icon={style.icon}
                width={22}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-heading font-bold text-foreground mb-1 truncate">
              {name}
            </h3>
            <p className="truncate text-xs text-default-500">
              {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"}
              {programName != null && programName.length > 0
                ? ` · ${programName}`
                : null}
            </p>
          </div>

          {rightContent ? (
            <div className="shrink-0 flex items-center">{rightContent}</div>
          ) : null}
        </div>

        {isExpanded && expandedContent ? (
          <div className="mt-4 pt-4 border-t border-default-100">
            {expandedContent}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
