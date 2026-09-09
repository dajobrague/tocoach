"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CenteredState } from "@/components/shared/centered-state";
import { IconTile } from "@/components/shared/icon-tile";
import { OutlineChip } from "@/components/shared/outline-chip";
import { SegmentedControl } from "@/components/shared/segmented-control";

import AddClientModal from "./add-client-modal";

const STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "Activo", label: "Activos" },
  { key: "Inactivo", label: "Inactivos" },
] as const;

const SORT_MODES = [
  { key: "default", label: "Alfabético" },
  { key: "pending_first", label: "Pendientes" },
  { key: "expired_first", label: "Expirados" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];
type CheckInSortMode = (typeof SORT_MODES)[number]["key"];

type CheckInListStatus =
  | "pending"
  | "completed"
  | "expired"
  | "not_due"
  | "disabled";

interface ClientCheckInSummary {
  status: CheckInListStatus;
  customName: string;
  scheduleDescription: string;
}

interface Client {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  nickName?: string;
  email: string;
  phone?: string;
  status: string;
  profileImage?: string;
  lastLogin?: string;
  joinedDate: string;
  occupation?: string;
  dob?: string;
  location: {
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  nationalId?: string;
  checkIn: ClientCheckInSummary | null;
}

/** El check-in usa chips outline, no rellenos: en una tabla con una fila por
 *  cliente, tres chips sólidos por pantalla compiten con el propio nombre. */
const CHECK_IN_CHIPS: Record<
  CheckInListStatus,
  { label: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  completed: { label: "Completado", tone: "success" },
  pending: { label: "Pendiente", tone: "warning" },
  expired: { label: "Expirado", tone: "danger" },
  not_due: { label: "Programado", tone: "muted" },
  disabled: { label: "Desactivado", tone: "muted" },
};

const STATUS_COLORS: Record<
  string,
  "success" | "secondary" | "warning" | "default"
> = {
  Activo: "success",
  "Onboarding Completado": "secondary",
  "Programación Inicial Pendiente": "warning",
};

const CHECK_IN_RANK: Record<CheckInSortMode, CheckInListStatus[]> = {
  default: [],
  pending_first: ["pending", "expired", "completed", "not_due", "disabled"],
  expired_first: ["expired", "pending", "completed", "not_due", "disabled"],
};

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const lastLoginText = (value?: string): string => {
  if (!value) return "Nunca";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;

  return formatDate(value);
};

function KpiCell({
  icon,
  label,
  tone,
  value,
}: {
  icon: string;
  label: string;
  tone: "default" | "success" | "primary" | "warning";
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 bg-content1 p-4">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-default-500">{label}</p>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-px bg-default-100">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 bg-content1 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-large" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-48 rounded-sm" />
            <Skeleton className="h-3 w-64 rounded-sm" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function ClientsContent() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Arranca en Activos: es la vista de trabajo real del entrenador. Los
  // inactivos y los de onboarding siguen a un clic, en Todos.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Activo");
  const [sortMode, setSortMode] = useState<CheckInSortMode>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clients/list");

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) throw new Error(data.error || "Error al cargar");

      setClients(data.clients || []);
    } catch (err) {
      // Un diálogo nativo del navegador dentro del ciclo de HeroUI congela la
      // página hasta recargar, así que el fallo se cuenta en la propia tabla.
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los clientes"
      );
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;

    return {
      total: clients.length,
      active: clients.filter((c) => c.status === "Activo").length,
      newThisWeek: clients.filter(
        (c) => new Date(c.joinedDate).getTime() >= weekAgo
      ).length,
      pendingCheckins: clients.filter((c) => c.checkIn?.status === "pending")
        .length,
    };
  }, [clients]);

  const visibleClients = useMemo(() => {
    let list = clients;

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.nickName?.toLowerCase().includes(q) ||
          c.occupation?.toLowerCase().includes(q)
      );
    }

    const order = CHECK_IN_RANK[sortMode];

    if (order.length === 0) {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    const rank = (c: Client) => {
      const i = c.checkIn ? order.indexOf(c.checkIn.status) : -1;

      return i === -1 ? order.length : i;
    };

    return [...list].sort(
      (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es")
    );
  }, [clients, statusFilter, searchQuery, sortMode]);

  const hasNoClients = clients.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5">
            {/* Cabecera de página: título + acción principal, sin card. */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Clientes
                </h1>
                <p className="text-sm text-default-500">
                  Tu cartera completa: estado, check-ins y acceso al perfil.
                </p>
              </div>

              <Button
                className="font-medium"
                color="primary"
                startContent={<Icon icon="solar:user-plus-bold" width={18} />}
                onPress={() => setIsAddModalOpen(true)}
              >
                Añadir cliente
              </Button>
            </div>

            {/* Resumen: rejilla hairline, tintes alpha del tema del tenant. */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-default-200 bg-default-200 lg:grid-cols-4">
              <KpiCell
                icon="solar:users-group-rounded-bold"
                label="Total clientes"
                tone="default"
                value={stats.total}
              />
              <KpiCell
                icon="solar:check-circle-bold"
                label="Activos"
                tone="success"
                value={stats.active}
              />
              <KpiCell
                icon="solar:star-bold"
                label="Nuevos (7 días)"
                tone="primary"
                value={stats.newThisWeek}
              />
              <KpiCell
                icon="solar:clipboard-check-bold"
                label="Check-ins pendientes"
                tone="warning"
                value={stats.pendingCheckins}
              />
            </div>

            {/* Filtros: dos segmented controls en vez de seis botones sueltos
                con estilos condicionales a mano. */}
            <Card
              className="border border-default-200 bg-content1 shadow-sm"
              shadow="none"
            >
              <CardBody className="gap-4 p-4">
                <Input
                  isClearable
                  placeholder="Buscar por nombre, email, apodo u ocupación…"
                  startContent={
                    <Icon
                      className="text-default-400"
                      icon="solar:magnifer-linear"
                      width={18}
                    />
                  }
                  value={searchQuery}
                  onClear={() => setSearchQuery("")}
                  onValueChange={setSearchQuery}
                />

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
                      Estado
                    </span>
                    <SegmentedControl
                      ariaLabel="Filtrar por estado"
                      className="!w-auto"
                      size="md"
                      options={STATUS_FILTERS}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
                      Ordenar check-ins
                    </span>
                    <SegmentedControl
                      ariaLabel="Ordenar por check-in"
                      className="!w-auto"
                      size="md"
                      options={SORT_MODES}
                      value={sortMode}
                      onChange={setSortMode}
                    />
                  </div>

                  <p className="ml-auto self-end text-xs text-default-500">
                    <span className="font-semibold tabular-nums text-foreground">
                      {visibleClients.length}
                    </span>{" "}
                    de <span className="tabular-nums">{clients.length}</span>{" "}
                    {clients.length === 1 ? "cliente" : "clientes"}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card
              className="border border-default-200 bg-content1 shadow-sm"
              shadow="none"
            >
              <CardBody className="p-0">
                {isLoading ? (
                  <TableSkeleton />
                ) : error !== null ? (
                  <div className="p-4">
                    <CenteredState
                      action={
                        <Button
                          className="mt-2"
                          startContent={
                            <Icon icon="solar:refresh-linear" width={16} />
                          }
                          variant="flat"
                          onPress={fetchClients}
                        >
                          Reintentar
                        </Button>
                      }
                      icon="solar:danger-triangle-linear"
                      subtitle={error}
                      title="No se pudo cargar la lista"
                    />
                  </div>
                ) : visibleClients.length === 0 ? (
                  <div className="p-4">
                    <CenteredState
                      action={
                        hasNoClients ? (
                          <Button
                            className="mt-2"
                            color="primary"
                            startContent={
                              <Icon icon="solar:user-plus-bold" width={16} />
                            }
                            onPress={() => setIsAddModalOpen(true)}
                          >
                            Añadir cliente
                          </Button>
                        ) : (
                          <Button
                            className="mt-2"
                            variant="flat"
                            onPress={() => {
                              setSearchQuery("");
                              setStatusFilter("all");
                            }}
                          >
                            Ver todos los clientes
                          </Button>
                        )
                      }
                      icon={
                        hasNoClients
                          ? "solar:users-group-rounded-linear"
                          : "solar:magnifer-linear"
                      }
                      subtitle={
                        hasNoClients
                          ? "Añade tu primer cliente para empezar a programar."
                          : "Ningún cliente coincide con la búsqueda o el estado seleccionado."
                      }
                      title={
                        hasNoClients
                          ? "Todavía no hay clientes"
                          : "Sin resultados"
                      }
                    />
                  </div>
                ) : (
                  <Table
                    removeWrapper
                    aria-label="Lista de clientes"
                    classNames={{
                      th: "bg-content2 text-default-500 font-semibold text-[10px] uppercase tracking-wider",
                      tr: "cursor-pointer border-b border-default-100 transition-colors last:border-b-0 hover:bg-content2 data-[focus-visible=true]:bg-content2",
                      td: "py-3",
                    }}
                    onRowAction={(key) =>
                      router.push(`/trainer/dashboard/clients/${key}`)
                    }
                  >
                    <TableHeader>
                      <TableColumn>Cliente</TableColumn>
                      <TableColumn>Estado</TableColumn>
                      <TableColumn>Check-in</TableColumn>
                      <TableColumn>Último acceso</TableColumn>
                      <TableColumn>Alta</TableColumn>
                      <TableColumn hideHeader>Abrir</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {visibleClients.map((client) => {
                        const chip = client.checkIn
                          ? CHECK_IN_CHIPS[client.checkIn.status]
                          : null;

                        return (
                          <TableRow key={client.id}>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-3">
                                <Avatar
                                  {...(client.profileImage
                                    ? { src: client.profileImage }
                                    : {})}
                                  showFallback
                                  className="h-10 w-10 shrink-0"
                                  color="primary"
                                  name={client.name}
                                  radius="lg"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {client.name}
                                  </p>
                                  <p className="truncate text-xs text-default-500">
                                    {client.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Chip
                                color={
                                  STATUS_COLORS[client.status] ?? "default"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {client.status}
                              </Chip>
                            </TableCell>

                            <TableCell>
                              {client.checkIn && chip ? (
                                <OutlineChip tone={chip.tone}>
                                  {chip.label}
                                </OutlineChip>
                              ) : (
                                <span className="text-sm text-default-400">
                                  —
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <span className="text-sm text-default-600">
                                {lastLoginText(client.lastLogin)}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="text-sm tabular-nums text-default-500">
                                {formatDate(client.joinedDate)}
                              </span>
                            </TableCell>

                            <TableCell>
                              <Icon
                                aria-hidden
                                className="text-default-300"
                                icon="solar:alt-arrow-right-linear"
                                width={18}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchClients}
      />
    </div>
  );
}
