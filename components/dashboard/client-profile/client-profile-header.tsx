"use client";

import {
  Avatar,
  BreadcrumbItem,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useEffect, useId, useState } from "react";

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

const EMPTY = "—";

/** La ficha arranca plegada: el trabajo del perfil son las pestañas, no la
 *  cabecera. Se recuerda la preferencia porque un entrenador abre muchos
 *  clientes seguidos y no debería desplegarla en cada uno. */
const FICHA_KEY = "topcoach:client-profile:ficha";

const dateFmt = (value: string | null | undefined, long: boolean): string => {
  if (!value) return EMPTY;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return EMPTY;

  return date.toLocaleDateString(
    "es-ES",
    long
      ? { day: "numeric", month: "short", year: "numeric" }
      : { month: "short", year: "numeric" }
  );
};

/** «hace 3 días» es lo que un entrenador quiere saber de la última conexión;
 *  la fecha exacta queda en el title para quien la necesite. */
const relativeDays = (value: string | null | undefined): string => {
  if (!value) return "Nunca";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return EMPTY;

  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(days) < 31) return rtf.format(-days, "day");

  return rtf.format(-Math.round(days / 30), "month");
};

/** Fila etiqueta/valor de la ficha. La etiqueta no se encoge y el valor se
 *  trunca, así una columna estrecha nunca parte la etiqueta en dos líneas. */
function Row({
  children,
  label,
  title,
}: {
  children: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-default-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-[13px] font-medium ${
          children === EMPTY ? "text-default-400" : "text-foreground"
        }`}
        {...(title ? { title } : {})}
      >
        {children}
      </dd>
    </div>
  );
}

function Section({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-2.5 bg-content1 px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden className="text-default-400" icon={icon} width={14} />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
          {title}
        </h3>
      </div>
      <dl className="flex flex-col gap-2">{children}</dl>
    </section>
  );
}

/** Contacto accionable: enlace real (mailto / tel), no texto plano. */
function ContactValue({
  href,
  value,
}: {
  href: string | null;
  value: string | null | undefined;
}) {
  if (!value) return <span className="text-default-400">{EMPTY}</span>;
  if (!href) return <>{value}</>;

  return (
    <a
      className="transition-colors hover:text-primary hover:underline"
      href={href}
    >
      {value}
    </a>
  );
}

export function ClientProfileHeaderSkeleton() {
  return (
    <div className="bg-content1">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-large" />
          <Skeleton className="h-7 w-64 rounded-md" />
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
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Se lee tras montar (no en el initializer) para no romper la hidratación.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(FICHA_KEY) === "open") setOpen(true);
    } catch {
      // Modo privado / storage bloqueado: la ficha no se recuerda y ya está.
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      try {
        window.localStorage.setItem(FICHA_KEY, prev ? "closed" : "open");
      } catch {
        // idem
      }

      return !prev;
    });
  };

  const loc = client.location;

  return (
    <header className="bg-content1">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          classNames={{ list: "flex-nowrap" }}
          size="sm"
          variant="light"
        >
          <BreadcrumbItem onPress={onBack}>Clientes</BreadcrumbItem>
          <BreadcrumbItem>{client.name}</BreadcrumbItem>
        </Breadcrumbs>

        {/* Fila de identidad: lo justo para confirmar en qué cliente estás.
            Todo lo demás — datos y acciones — vive en la ficha plegable. */}
        <div className="mt-3 flex items-center gap-3">
          <Avatar
            {...(client.avatar ? { src: client.avatar } : {})}
            isBordered
            showFallback
            className="h-12 w-12 shrink-0"
            color="primary"
            name={client.name}
            radius="lg"
          />

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground">
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

          <Button
            aria-controls={panelId}
            aria-expanded={open}
            className="shrink-0 font-medium text-default-500"
            endContent={
              <Icon
                className={`transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
                icon="solar:alt-arrow-down-linear"
                width={16}
              />
            }
            size="sm"
            variant="light"
            onPress={toggle}
          >
            Ficha
          </Button>
        </div>

        {open && (
          <Card
            className="mt-4 border border-default-200 bg-content1 shadow-sm"
            id={panelId}
            shadow="none"
          >
            <CardBody className="gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      aria-hidden
                      className="text-primary"
                      icon="solar:user-id-linear"
                      width={18}
                    />
                    <h2 className="font-heading text-sm font-semibold text-foreground">
                      Ficha del cliente
                    </h2>
                  </div>
                  <p className="text-xs text-default-500">
                    Datos personales, contacto y estado de la cuenta.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {onEdit && (
                    <Button
                      className="font-medium"
                      color="primary"
                      size="sm"
                      startContent={<Icon icon="solar:pen-linear" width={16} />}
                      variant="flat"
                      onPress={onEdit}
                    >
                      Editar
                    </Button>
                  )}

                  {/* Acciones secundarias tras un menú, como en la card de
                      programa: deja una sola acción visible y aparta la
                      destructiva de un clic accidental. */}
                  {(onUpdateStatus || onDelete) && (
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          aria-label="Más acciones del cliente"
                          size="sm"
                          variant="light"
                        >
                          <Icon icon="solar:menu-dots-bold" width={18} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Más acciones del cliente"
                        onAction={(key) => {
                          if (key === "status") onUpdateStatus?.();
                          else if (key === "delete") onDelete?.();
                        }}
                      >
                        {/* Array con spread: las colecciones de HeroUI no
                            aceptan null entre los hijos. */}
                        {[
                          ...(onUpdateStatus
                            ? [
                                <DropdownItem
                                  key="status"
                                  description="Activo, onboarding, pendiente…"
                                  startContent={
                                    <Icon
                                      icon="solar:refresh-linear"
                                      width={16}
                                    />
                                  }
                                >
                                  Cambiar estado
                                </DropdownItem>,
                              ]
                            : []),
                          ...(onDelete
                            ? [
                                <DropdownItem
                                  key="delete"
                                  className="text-danger"
                                  color="danger"
                                  description="Borra el cliente y su historial"
                                  startContent={
                                    <Icon
                                      icon="solar:trash-bin-trash-linear"
                                      width={16}
                                    />
                                  }
                                >
                                  Eliminar cliente
                                </DropdownItem>,
                              ]
                            : []),
                        ]}
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </div>
              </div>

              {/* Hairlines internos un escalón por debajo del borde de la card
                  (default-100 vs default-200), como el resto de la app. */}
              <div className="grid gap-px overflow-hidden rounded-large border border-default-100 bg-default-100 md:grid-cols-3">
                <Section icon="solar:user-linear" title="Personal">
                  <Row label="Apodo">{client.nickName || EMPTY}</Row>
                  <Row label="Nacimiento">{dateFmt(client.dob, true)}</Row>
                  <Row label="Edad">
                    {client.age != null ? (
                      <>
                        <span className="tabular-nums">{client.age}</span>
                        <span className="ml-0.5 text-[11px] font-normal text-default-400">
                          años
                        </span>
                      </>
                    ) : (
                      EMPTY
                    )}
                  </Row>
                  <Row label="Sexo">
                    {(client.sex && SEX_LABELS[client.sex]) || EMPTY}
                  </Row>
                  <Row label="Altura">
                    {client.heightCm != null ? (
                      <>
                        <span className="tabular-nums">{client.heightCm}</span>
                        <span className="ml-0.5 text-[11px] font-normal text-default-400">
                          cm
                        </span>
                      </>
                    ) : (
                      EMPTY
                    )}
                  </Row>
                  <Row label="Ocupación" title={client.occupation}>
                    {client.occupation || EMPTY}
                  </Row>
                </Section>

                <Section icon="solar:letter-linear" title="Contacto">
                  <Row label="Email" title={client.email}>
                    <ContactValue
                      href={client.email ? `mailto:${client.email}` : null}
                      value={client.email}
                    />
                  </Row>
                  <Row label="Teléfono">
                    <ContactValue
                      href={
                        client.phone
                          ? `tel:${client.phone.replace(/\s/g, "")}`
                          : null
                      }
                      value={client.phone}
                    />
                  </Row>
                  <Row label="Ciudad">{loc?.city || EMPTY}</Row>
                  <Row label="Provincia">{loc?.state || EMPTY}</Row>
                  <Row label="País">{loc?.country || EMPTY}</Row>
                  <Row label="Código postal">
                    <span className="tabular-nums">{loc?.zip || EMPTY}</span>
                  </Row>
                </Section>

                <Section icon="solar:shield-user-linear" title="Cuenta">
                  <Row label="Documento">
                    <span className="tabular-nums">
                      {client.nationalId || EMPTY}
                    </span>
                  </Row>
                  <Row label="Alta">{dateFmt(client.joinedDate, false)}</Row>
                  <Row
                    label="Última conexión"
                    {...(client.lastLoginAt
                      ? { title: dateFmt(client.lastLoginAt, true) }
                      : {})}
                  >
                    {relativeDays(client.lastLoginAt)}
                  </Row>
                </Section>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </header>
  );
}
