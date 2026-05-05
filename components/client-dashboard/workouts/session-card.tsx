// Card reusable de sesión. Pura presentación: tag por tipo, nombre,
// recuento, slot opcional para fecha (modo "pasado") y slot opcional
// para acción/expansión (modo "disponible"). La lógica de expansión
// vive en available-sessions-list.tsx.

import type { SessionType } from "@/types/training";
import type { ReactNode } from "react";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

const TYPE_LABEL: Record<SessionType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

const TYPE_COLOR: Record<
  SessionType,
  "primary" | "danger" | "warning" | "secondary" | "success" | "default"
> = {
  strength: "primary",
  cardio: "danger",
  flexibility: "secondary",
  sports: "warning",
  recovery: "success",
  other: "default",
};

const TYPE_ICON: Record<SessionType, string> = {
  strength: "solar:dumbbell-bold",
  cardio: "solar:heart-pulse-bold",
  flexibility: "solar:body-bold",
  sports: "solar:medal-star-bold",
  recovery: "solar:sleeping-bold",
  other: "solar:dumbbell-linear",
};

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
  const iconKey = sessionType ?? "other";
  const colorKey: SessionType = sessionType ?? "other";

  return (
    <Card className="bg-content1 border border-default-200 w-full">
      <CardBody className="p-4">
        <div className="flex items-start gap-3 w-full">
          {dateBadge ? (
            <div className="shrink-0">{dateBadge}</div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-default-100">
              <Icon
                className="text-foreground/70"
                icon={TYPE_ICON[iconKey]}
                width={22}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-heading font-bold text-foreground mb-1 truncate">
              {name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {sessionType ? (
                <Chip color={TYPE_COLOR[colorKey]} size="sm" variant="flat">
                  {TYPE_LABEL[sessionType]}
                </Chip>
              ) : null}
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
