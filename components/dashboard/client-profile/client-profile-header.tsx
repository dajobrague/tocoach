"use client";

import {
  Avatar,
  BreadcrumbItem,
  Breadcrumbs,
  Button,
  Chip,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { OutlineChip } from "@/components/shared/outline-chip";
import { MockClient } from "@/lib/mock-data/client-profile-mock";

interface ClientProfileHeaderProps {
  client: MockClient;
  onBack: () => void;
  onEdit?: () => void;
  onUpdateStatus?: () => void;
  onDelete?: () => void;
}

type StatusColor = "success" | "primary" | "warning" | "default" | "secondary";

const STATUS_COLORS: Record<string, StatusColor> = {
  Activo: "success",
  "Onboarding Completado": "secondary",
  "Programación Inicial Pendiente": "warning",
};

const SEX_LABELS: Record<string, string> = {
  male: "Hombre",
  female: "Mujer",
};

/** Guion largo tipográfico: un dato ausente ocupa la celda igual que uno
 *  presente, así la rejilla no se descuadra entre clientes. */
const EMPTY = "—";

const formatJoined = (dateString: string): string => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return EMPTY;

  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
};

/** Celda de la rejilla de datos: microetiqueta + valor. Es un `<dl>` real,
 *  no dos `<p>`, para que un lector de pantalla lea "Edad: 34 años". */
function Fact({
  label,
  numeric = false,
  value,
}: {
  label: string;
  numeric?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.09em] text-default-400">
        {label}
      </dt>
      <dd
        className={`truncate text-sm font-medium text-foreground ${
          numeric ? "tabular-nums" : ""
        }`}
        title={value === EMPTY ? undefined : value}
      >
        {value}
      </dd>
    </div>
  );
}

export function ClientProfileHeaderSkeleton() {
  return (
    <div className="bg-content1">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className="mt-5 flex items-start gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-large" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-7 w-64 rounded-md" />
            <Skeleton className="h-5 w-48 rounded-md" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider pt-4 sm:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-12 rounded-sm" />
              <Skeleton className="h-4 w-20 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClientProfileHeader({
  client,
  onBack,
  onDelete,
  onEdit,
  onUpdateStatus,
}: ClientProfileHeaderProps) {
  const facts: { label: string; numeric?: boolean; value: string }[] = [
    {
      label: "Edad",
      numeric: true,
      value: client.age != null ? `${client.age} años` : EMPTY,
    },
    {
      label: "Sexo",
      value: (client.sex && SEX_LABELS[client.sex]) || EMPTY,
    },
    {
      label: "Altura",
      numeric: true,
      value: client.heightCm != null ? `${client.heightCm} cm` : EMPTY,
    },
    { label: "Ocupación", value: client.occupation || EMPTY },
    { label: "Email", value: client.email || EMPTY },
    { label: "Teléfono", value: client.phone || EMPTY },
    {
      label: "Ciudad",
      value:
        [client.location?.city, client.location?.country]
          .filter(Boolean)
          .join(", ") || EMPTY,
    },
    { label: "Alta", value: formatJoined(client.joinedDate) },
  ];

  return (
    <header className="bg-content1">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Fila de mando: ubicación a la izquierda, acciones a la derecha. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            classNames={{ list: "flex-nowrap" }}
            size="sm"
            variant="light"
          >
            <BreadcrumbItem onPress={onBack}>Clientes</BreadcrumbItem>
            <BreadcrumbItem>{client.name}</BreadcrumbItem>
          </Breadcrumbs>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                className="font-semibold"
                color="primary"
                size="sm"
                startContent={<Icon icon="solar:pen-bold" width={16} />}
                onPress={onEdit}
              >
                Editar
              </Button>
            )}
            {onUpdateStatus && (
              <Button
                className="font-semibold"
                size="sm"
                startContent={<Icon icon="solar:refresh-bold" width={16} />}
                variant="flat"
                onPress={onUpdateStatus}
              >
                Estado
              </Button>
            )}
            {onDelete && (
              <Button
                className="font-semibold"
                color="danger"
                size="sm"
                startContent={
                  <Icon icon="solar:trash-bin-trash-bold" width={16} />
                }
                variant="light"
                onPress={onDelete}
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>

        {/* Identidad: quién es, en qué estado está, y para qué entrena. */}
        <div className="mt-5 flex items-start gap-4">
          <Avatar
            {...(client.avatar ? { src: client.avatar } : {})}
            isBordered
            showFallback
            className="h-16 w-16 shrink-0"
            color="primary"
            name={client.name}
            radius="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-heading text-2xl font-bold leading-tight text-foreground">
                {client.name}
              </h1>
              {client.nickName && (
                <span className="text-sm text-default-400">
                  «{client.nickName}»
                </span>
              )}
              <Chip
                color={STATUS_COLORS[client.status] ?? "default"}
                size="sm"
                variant="flat"
              >
                {client.status}
              </Chip>
            </div>

            {client.goals && client.goals.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Icon
                  aria-hidden
                  className="mr-0.5 shrink-0 text-default-400"
                  icon="solar:target-linear"
                  width={14}
                />
                {client.goals.map((goal) => (
                  <OutlineChip key={goal}>{goal}</OutlineChip>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rejilla de datos: la ficha completa, siempre visible, sin abrir nada. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider pt-4 sm:grid-cols-4 xl:grid-cols-8">
          {facts.map((fact) => (
            <Fact key={fact.label} {...fact} />
          ))}
        </dl>
      </div>
    </header>
  );
}
