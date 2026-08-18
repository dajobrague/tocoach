import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

/** Empty/error state canónico: card con icono 44px, título y subtítulo.
 *  Fuente: meal-cycle-content CenteredState. */
export function CenteredState({
  action,
  icon,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  icon: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Icon className="text-default-400" icon={icon} width={44} />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {subtitle !== undefined ? (
          <p className="max-w-sm text-sm text-default-500">{subtitle}</p>
        ) : null}
        {action ?? null}
      </CardBody>
    </Card>
  );
}
