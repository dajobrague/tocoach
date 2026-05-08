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
}

export function SessionCard({
  name,
  sessionType,
  exerciseCount,
  dateBadge,
  rightContent,
  expandedContent,
  isExpanded = false,
}: Props) {
  const style = getSessionTypeStyle(sessionType);

  return (
    <Card className="bg-content1 border border-default-200 w-full">
      <CardBody className="p-4">
        <div className="flex items-start gap-3 w-full">
          {dateBadge ? (
            <div className="shrink-0">{dateBadge}</div>
          ) : (
            <div
              aria-label={`Sesión de ${style.label.toLowerCase()}`}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.iconBgClass}`}
              role="img"
            >
              <Icon
                aria-hidden="true"
                className={style.iconColorClass}
                icon={style.icon}
                width={22}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-heading font-bold text-foreground mb-1 truncate">
              {name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-foreground/60 font-body">
                {exerciseCount}{" "}
                {exerciseCount === 1 ? "ejercicio" : "ejercicios"}
              </span>
            </div>
          </div>

          {rightContent ? (
            <div className="shrink-0 flex items-center">{rightContent}</div>
          ) : null}
        </div>

        {isExpanded && expandedContent ? (
          <div className="mt-4 pt-4 border-t border-default-200">
            {expandedContent}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
