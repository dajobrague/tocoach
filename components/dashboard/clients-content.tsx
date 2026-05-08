"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import AddClientModal from "./add-client-modal";

type StatusFilter =
  | "all"
  | "Activo"
  | "Onboarding Completado"
  | "Programación Inicial Pendiente";

type CheckInListStatus =
  | "pending"
  | "completed"
  | "expired"
  | "not_due"
  | "disabled";

type CheckInSortMode = "default" | "pending_first" | "expired_first";

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

interface ClientsStats {
  total: number;
  active: number;
  newThisWeek: number;
  pendingCheckins: number;
}

export default function ClientsContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [checkInSortMode, setCheckInSortMode] =
    useState<CheckInSortMode>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [stats, setStats] = useState<ClientsStats>({
    total: 0,
    active: 0,
    newThisWeek: 0,
    pendingCheckins: 0,
  });

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("[ClientsContent] Fetching clients...");

      // Use the proper list API that filters by tenant
      const listResponse = await fetch("/api/clients/list");

      if (!listResponse.ok) {
        console.error(
          "[ClientsContent] API request failed with status:",
          listResponse.status
        );
        throw new Error(
          `Error ${listResponse.status}: ${listResponse.statusText}`
        );
      }

      const listData = await listResponse.json();

      console.log("[ClientsContent] List response:", listData);

      if (!listData.success) {
        console.error("[ClientsContent] List failed:", listData);
        throw new Error(listData.error || "Error al cargar clientes");
      }

      console.log(
        "[ClientsContent] Successfully loaded clients:",
        listData.total
      );

      // Use the already transformed clients from the list API
      const transformedClients = listData.clients || [];

      console.log(
        "[ClientsContent] Clients loaded:",
        transformedClients.length
      );

      // Store all clients
      setClients(transformedClients);

      // Apply filters and search
      applyFiltersAndSearch(transformedClients);

      // Calculate stats
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      setStats({
        total: transformedClients.length,
        active: transformedClients.filter((c: Client) => c.status === "Activo")
          .length,
        newThisWeek: transformedClients.filter(
          (c: Client) => new Date(c.joinedDate) >= weekAgo
        ).length,
        pendingCheckins: transformedClients.filter(
          (c: Client) => c.checkIn?.status === "pending"
        ).length,
      });

      console.log("[ClientsContent] Stats calculated:", {
        total: transformedClients.length,
        active: transformedClients.filter((c: Client) => c.status === "Activo")
          .length,
      });
    } catch (error) {
      console.error("[ClientsContent] Error fetching clients:", error);
      // Only show alert for actual errors, not for empty results
      alert(
        `Error al cargar clientes: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
      // Set empty state on error
      setClients([]);
      setFilteredClients([]);
      setStats({
        total: 0,
        active: 0,
        newThisWeek: 0,
        pendingCheckins: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to apply status filter and search
  const applyFiltersAndSearch = useCallback(
    (clientsToFilter: Client[]) => {
      let filtered = [...clientsToFilter];

      // Apply status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter((c) => c.status === statusFilter);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();

        filtered = filtered.filter(
          (client) =>
            client.name.toLowerCase().includes(searchLower) ||
            client.email.toLowerCase().includes(searchLower) ||
            client.nickName?.toLowerCase().includes(searchLower) ||
            client.occupation?.toLowerCase().includes(searchLower)
        );
      }

      const rankPendingFirst: Record<CheckInListStatus, number> = {
        pending: 0,
        expired: 1,
        completed: 2,
        not_due: 3,
        disabled: 4,
      };

      const rankExpiredFirst: Record<CheckInListStatus, number> = {
        expired: 0,
        pending: 1,
        completed: 2,
        not_due: 3,
        disabled: 4,
      };

      if (checkInSortMode === "pending_first") {
        filtered.sort((a, b) => {
          const sa = a.checkIn?.status;
          const sb = b.checkIn?.status;
          const ra = sa ? rankPendingFirst[sa] : 99;
          const rb = sb ? rankPendingFirst[sb] : 99;

          if (ra !== rb) return ra - rb;

          return a.name.localeCompare(b.name, "es");
        });
      } else if (checkInSortMode === "expired_first") {
        filtered.sort((a, b) => {
          const sa = a.checkIn?.status;
          const sb = b.checkIn?.status;
          const ra = sa ? rankExpiredFirst[sa] : 99;
          const rb = sb ? rankExpiredFirst[sb] : 99;

          if (ra !== rb) return ra - rb;

          return a.name.localeCompare(b.name, "es");
        });
      }

      console.log(
        "[ClientsContent] Filtered clients:",
        filtered.length,
        "from",
        clientsToFilter.length
      );
      setFilteredClients(filtered);
    },
    [statusFilter, searchQuery, checkInSortMode]
  );

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Re-apply filters when status filter or search changes
  useEffect(() => {
    if (clients.length > 0) {
      applyFiltersAndSearch(clients);
    }
  }, [
    statusFilter,
    searchQuery,
    checkInSortMode,
    clients,
    applyFiltersAndSearch,
  ]);

  const getStatusColor = (
    status: string
  ): "success" | "primary" | "warning" | "default" | "secondary" | "danger" => {
    switch (status) {
      case "Activo":
        return "success"; // Verde brillante
      case "Onboarding Completado":
        return "secondary"; // Morado/Rosa - más distintivo
      case "Programación Inicial Pendiente":
        return "warning"; // Amarillo/Naranja
      default:
        return "default"; // Gris
    }
  };

  const getStatusLabel = (status: string) => {
    // Return status as-is since it's already in Spanish
    return status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getCheckInChip = (status: CheckInListStatus) => {
    switch (status) {
      case "completed":
        return {
          label: "Completado",
          color: "success" as const,
          variant: "solid" as const,
        };
      case "pending":
        return {
          label: "Pendiente",
          color: "warning" as const,
          variant: "solid" as const,
        };
      case "expired":
        return {
          label: "Expirado",
          color: "danger" as const,
          variant: "solid" as const,
        };
      case "not_due":
        return {
          label: "Programado",
          color: "default" as const,
          variant: "flat" as const,
        };
      case "disabled":
        return {
          label: "Desactivado",
          color: "default" as const,
          variant: "bordered" as const,
        };
      default:
        return {
          label: "—",
          color: "default" as const,
          variant: "flat" as const,
        };
    }
  };

  const getLastLoginText = (lastLogin?: string) => {
    if (!lastLogin) return "Nunca";

    const now = new Date();
    const loginDate = new Date(lastLogin);
    const diffMs = now.getTime() - loginDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return formatDate(lastLogin);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-3 rounded-xl">
                      <Icon
                        className="text-slate-700 text-2xl"
                        icon="solar:users-group-rounded-bold"
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.total}
                      </p>
                      <p className="text-xs text-gray-600">Total Clientes</p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-50 p-3 rounded-xl">
                      <Icon
                        className="text-green-600 text-2xl"
                        icon="solar:check-circle-bold"
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.active}
                      </p>
                      <p className="text-xs text-gray-600">Activos</p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-50 p-3 rounded-xl">
                      <Icon
                        className="text-purple-600 text-2xl"
                        icon="solar:star-bold"
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.newThisWeek}
                      </p>
                      <p className="text-xs text-gray-600">Nuevos (7 días)</p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-50 p-3 rounded-xl">
                      <Icon
                        className="text-orange-600 text-2xl"
                        icon="solar:clipboard-check-bold"
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.pendingCheckins}
                      </p>
                      <p className="text-xs text-gray-600">
                        Check-ins pendientes
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Search, Status Filters and Add Button */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-4">
                <div className="flex flex-col gap-4">
                  {/* Top Row: Search Bar and Add Button */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                    {/* Search Bar */}
                    <div className="flex-1">
                      <Input
                        isClearable
                        classNames={{
                          input: "text-sm",
                          inputWrapper: "border border-gray-200",
                        }}
                        placeholder="Buscar cliente por nombre, email o ocupación..."
                        startContent={
                          <Icon
                            className="text-gray-400"
                            icon="solar:magnifer-linear"
                            width={20}
                          />
                        }
                        value={searchQuery}
                        onClear={() => setSearchQuery("")}
                        onValueChange={setSearchQuery}
                      />
                    </div>

                    {/* Add Button */}
                    <Button
                      className="sm:w-auto w-full bg-black text-white hover:bg-slate-800"
                      size="md"
                      startContent={
                        <Icon icon="solar:user-plus-bold" width={18} />
                      }
                      onPress={() => setIsAddModalOpen(true)}
                    >
                      Añadir Cliente
                    </Button>
                  </div>

                  {/* Bottom Row: Status Filters */}
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-sm text-gray-600 font-medium">
                      Estado:
                    </span>
                    <Button
                      className={
                        statusFilter === "all"
                          ? "bg-black text-white hover:bg-slate-800"
                          : "bg-gray-100"
                      }
                      size="sm"
                      variant={statusFilter === "all" ? "solid" : "flat"}
                      onPress={() => setStatusFilter("all")}
                    >
                      Todos
                    </Button>
                    <Button
                      className={statusFilter !== "Activo" ? "bg-gray-100" : ""}
                      color={statusFilter === "Activo" ? "success" : "default"}
                      size="sm"
                      variant={statusFilter === "Activo" ? "solid" : "flat"}
                      onPress={() => setStatusFilter("Activo")}
                    >
                      Activo
                    </Button>
                    <Button
                      className={
                        statusFilter !== "Onboarding Completado"
                          ? "bg-gray-100"
                          : ""
                      }
                      color={
                        statusFilter === "Onboarding Completado"
                          ? "secondary"
                          : "default"
                      }
                      size="sm"
                      variant={
                        statusFilter === "Onboarding Completado"
                          ? "solid"
                          : "flat"
                      }
                      onPress={() => setStatusFilter("Onboarding Completado")}
                    >
                      Onboarding
                    </Button>
                    <Button
                      className={
                        statusFilter !== "Programación Inicial Pendiente"
                          ? "bg-gray-100"
                          : ""
                      }
                      color={
                        statusFilter === "Programación Inicial Pendiente"
                          ? "warning"
                          : "default"
                      }
                      size="sm"
                      variant={
                        statusFilter === "Programación Inicial Pendiente"
                          ? "solid"
                          : "flat"
                      }
                      onPress={() =>
                        setStatusFilter("Programación Inicial Pendiente")
                      }
                    >
                      Pendiente
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center border-t border-gray-100 pt-3">
                    <span className="text-sm text-gray-600 font-medium">
                      Orden check-in:
                    </span>
                    <Button
                      className={
                        checkInSortMode === "default"
                          ? "bg-black text-white hover:bg-slate-800"
                          : "bg-gray-100"
                      }
                      size="sm"
                      variant={checkInSortMode === "default" ? "solid" : "flat"}
                      onPress={() => setCheckInSortMode("default")}
                    >
                      Por defecto
                    </Button>
                    <Button
                      className={
                        checkInSortMode !== "pending_first" ? "bg-gray-100" : ""
                      }
                      color={
                        checkInSortMode === "pending_first"
                          ? "warning"
                          : "default"
                      }
                      size="sm"
                      variant={
                        checkInSortMode === "pending_first" ? "solid" : "flat"
                      }
                      onPress={() => setCheckInSortMode("pending_first")}
                    >
                      Pendientes primero
                    </Button>
                    <Button
                      className={
                        checkInSortMode !== "expired_first" ? "bg-gray-100" : ""
                      }
                      color={
                        checkInSortMode === "expired_first"
                          ? "danger"
                          : "default"
                      }
                      size="sm"
                      variant={
                        checkInSortMode === "expired_first" ? "solid" : "flat"
                      }
                      onPress={() => setCheckInSortMode("expired_first")}
                    >
                      Expirados primero
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Clients Table */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Spinner color="primary" size="lg" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="bg-gray-100 p-4 rounded-full mb-4">
                      <Icon
                        className="text-gray-400 text-5xl"
                        icon="solar:users-group-rounded-linear"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No hay clientes
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Añade tu primer cliente para empezar
                    </p>
                  </div>
                ) : (
                  <Table
                    aria-label="Tabla de clientes"
                    classNames={{
                      wrapper: "shadow-none",
                      th: "bg-gray-50 text-gray-700 font-semibold text-xs uppercase",
                      td: "py-4",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>CLIENTE</TableColumn>
                      <TableColumn>ÚLTIMO ACCESO</TableColumn>
                      <TableColumn>FECHA INICIO</TableColumn>
                      <TableColumn>CHECK-IN</TableColumn>
                      <TableColumn>ESTADO</TableColumn>
                      <TableColumn>ACCIONES</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => {
                        const checkInChip = client.checkIn
                          ? getCheckInChip(client.checkIn.status)
                          : null;

                        return (
                          <TableRow key={client.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar
                                  {...(client.profileImage
                                    ? { src: client.profileImage }
                                    : {})}
                                  showFallback
                                  color="primary"
                                  isBordered={false}
                                  name={client.name}
                                  radius="lg"
                                  size="md"
                                />
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {client.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {client.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">
                                {getLastLoginText(client.lastLogin)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">
                                {formatDate(client.joinedDate)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {client.checkIn && checkInChip ? (
                                <div className="flex max-w-[240px] flex-col gap-1.5">
                                  <p className="text-sm font-medium text-gray-900">
                                    {client.checkIn.customName}
                                  </p>
                                  <Chip
                                    color={checkInChip.color}
                                    size="sm"
                                    variant={checkInChip.variant}
                                  >
                                    {checkInChip.label}
                                  </Chip>
                                  <p className="text-xs leading-snug text-gray-500">
                                    {client.checkIn.scheduleDescription}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                color={getStatusColor(client.status)}
                                size="sm"
                                variant="solid"
                              >
                                {getStatusLabel(client.status)}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <Button
                                color="primary"
                                size="sm"
                                startContent={
                                  <Icon icon="solar:eye-bold" width={18} />
                                }
                                variant="solid"
                                onPress={() =>
                                  (window.location.href = `/trainer/dashboard/clients/${client.id}`)
                                }
                              >
                                Ver Perfil
                              </Button>
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

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // Refresh clients list after adding a new client
          fetchClients();
        }}
      />
    </div>
  );
}
