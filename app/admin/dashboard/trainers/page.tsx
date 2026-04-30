"use client";

import { Icon } from "@iconify/react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import React from "react";

import AddTrainerModal from "@/components/admin/add-trainer-modal";
import DeleteTrainerModal from "@/components/admin/delete-trainer-modal";

interface Trainer {
  id: string;
  email: string;
  full_name: string;
  tenant_host: string;
  tenant_slug: string;
  subscription_status: "active" | "paused" | "cancelled";
  status: "active" | "inactive";
  password_set_at: string | null;
  invited_at: string;
  last_login_at: string | null;
  created_at: string;
  clientCount: number;
}

export default function TrainersManagementPage() {
  const [trainers, setTrainers] = React.useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [updatingTrainerId, setUpdatingTrainerId] = React.useState<
    string | null
  >(null);
  const [trainerToDelete, setTrainerToDelete] = React.useState<Trainer | null>(
    null
  );
  const [impersonatingTrainerId, setImpersonatingTrainerId] = React.useState<
    string | null
  >(null);

  const fetchTrainers = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();

      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/admin/trainers?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error fetching trainers");
      }

      const data = await response.json();

      setTrainers(data.trainers || []);
    } catch (error) {
      console.error("Error fetching trainers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm]);

  React.useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const handleUpdateSubscription = async (
    trainerId: string,
    newStatus: string
  ) => {
    setUpdatingTrainerId(trainerId);

    try {
      const response = await fetch(`/api/admin/trainers/${trainerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ subscriptionStatus: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Error updating subscription");
      }

      // Refresh trainers list
      await fetchTrainers();
    } catch (error) {
      console.error("Error updating subscription:", error);
    } finally {
      setUpdatingTrainerId(null);
    }
  };

  const handleImpersonate = async (trainerId: string) => {
    setImpersonatingTrainerId(trainerId);

    try {
      const response = await fetch(
        `/api/admin/trainers/${trainerId}/impersonate`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Error al generar enlace");
      }

      const data = await response.json();

      // Open in new tab - session will be set on trainer's path, not admin path
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error impersonating trainer:", error);
      alert("Error al acceder a la cuenta del entrenador");
    } finally {
      setImpersonatingTrainerId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "paused":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";

    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-slate-900">
            Gestión de Entrenadores
          </h1>
          <p className="text-slate-500 font-body mt-1">
            Administra todos los entrenadores y sus suscripciones
          </p>
        </div>
        <Button
          className="bg-black text-white font-body"
          color="primary"
          size="lg"
          startContent={<Icon icon="solar:user-plus-bold" />}
          onPress={() => setIsAddModalOpen(true)}
        >
          Agregar Entrenador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Total</p>
                <p className="text-2xl font-bold font-heading text-slate-900">
                  {trainers.length}
                </p>
              </div>
              <div className="bg-black p-3 rounded-xl">
                <Icon
                  className="text-2xl text-white"
                  icon="solar:users-group-two-rounded-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Activos</p>
                <p className="text-2xl font-bold font-heading text-green-600">
                  {
                    trainers.filter((t) => t.subscription_status === "active")
                      .length
                  }
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <Icon
                  className="text-2xl text-green-600"
                  icon="solar:check-circle-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Pausados</p>
                <p className="text-2xl font-bold font-heading text-yellow-600">
                  {
                    trainers.filter((t) => t.subscription_status === "paused")
                      .length
                  }
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Icon
                  className="text-2xl text-yellow-600"
                  icon="solar:pause-circle-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Cancelados</p>
                <p className="text-2xl font-bold font-heading text-red-600">
                  {
                    trainers.filter(
                      (t) => t.subscription_status === "cancelled"
                    ).length
                  }
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-xl">
                <Icon
                  className="text-2xl text-red-600"
                  icon="solar:close-circle-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardBody>
          <div className="flex gap-4">
            <Input
              className="flex-1"
              placeholder="Buscar por nombre, email o subdominio..."
              startContent={<Icon icon="solar:magnifer-linear" />}
              value={searchTerm}
              variant="bordered"
              onValueChange={setSearchTerm}
            />
            <Dropdown>
              <DropdownTrigger>
                <Button
                  startContent={<Icon icon="solar:filter-bold" />}
                  variant="bordered"
                >
                  Estado: {statusFilter === "all" ? "Todos" : statusFilter}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Filter by status"
                onAction={(key) => setStatusFilter(key as string)}
              >
                <DropdownItem key="all">Todos</DropdownItem>
                <DropdownItem key="active">Activos</DropdownItem>
                <DropdownItem key="paused">Pausados</DropdownItem>
                <DropdownItem key="cancelled">Cancelados</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </CardBody>
      </Card>

      {/* Trainers Table */}
      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table aria-label="Trainers table">
              <TableHeader>
                <TableColumn>ENTRENADOR</TableColumn>
                <TableColumn>SUBDOMINIO</TableColumn>
                <TableColumn>CLIENTES</TableColumn>
                <TableColumn>SUSCRIPCIÓN</TableColumn>
                <TableColumn>PASSWORD</TableColumn>
                <TableColumn>ÚLTIMO ACCESO</TableColumn>
                <TableColumn>ACCIONES</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hay entrenadores">
                {trainers.map((trainer) => (
                  <TableRow key={trainer.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold font-body">
                          {trainer.full_name}
                        </p>
                        <p className="text-sm text-slate-500 font-body">
                          {trainer.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        className="group inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                        href={`/${trainer.tenant_slug}`}
                        rel="noopener noreferrer"
                        target="_blank"
                        title="Ver portal del cliente"
                      >
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded group-hover:bg-slate-200 transition-colors">
                          /{trainer.tenant_slug}
                        </code>
                        <Icon
                          className="text-slate-400 group-hover:text-slate-600 transition-colors text-sm"
                          icon="solar:link-minimalistic-2-bold"
                        />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat">
                        {trainer.clientCount}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getStatusColor(trainer.subscription_status)}
                        size="sm"
                        variant="flat"
                      >
                        {trainer.subscription_status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {trainer.password_set_at ? (
                        <Chip color="success" size="sm" variant="flat">
                          Configurado
                        </Chip>
                      ) : (
                        <Chip color="warning" size="sm" variant="flat">
                          Pendiente
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500 font-body">
                        {formatDate(trainer.last_login_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isIconOnly
                            isLoading={updatingTrainerId === trainer.id}
                            size="sm"
                            variant="light"
                          >
                            <Icon icon="solar:menu-dots-bold" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Actions">
                          <DropdownItem
                            key="details"
                            startContent={<Icon icon="solar:eye-bold" />}
                            onPress={() => {
                              window.location.href = `/admin/dashboard/trainers/${trainer.id}`;
                            }}
                          >
                            Ver detalles y clientes
                          </DropdownItem>
                          <DropdownItem
                            key="impersonate"
                            className="text-primary"
                            startContent={<Icon icon="solar:login-3-bold" />}
                            onPress={() => handleImpersonate(trainer.id)}
                          >
                            Acceder como Entrenador
                          </DropdownItem>
                          {trainer.subscription_status !== "active" ? (
                            <DropdownItem
                              key="activate"
                              startContent={
                                <Icon icon="solar:check-circle-bold" />
                              }
                              onPress={() =>
                                handleUpdateSubscription(trainer.id, "active")
                              }
                            >
                              Activar
                            </DropdownItem>
                          ) : null}
                          {trainer.subscription_status !== "paused" ? (
                            <DropdownItem
                              key="pause"
                              startContent={
                                <Icon icon="solar:pause-circle-bold" />
                              }
                              onPress={() =>
                                handleUpdateSubscription(trainer.id, "paused")
                              }
                            >
                              Pausar
                            </DropdownItem>
                          ) : null}
                          {trainer.subscription_status !== "cancelled" ? (
                            <DropdownItem
                              key="cancel"
                              className="text-warning"
                              color="warning"
                              startContent={
                                <Icon icon="solar:close-circle-bold" />
                              }
                              onPress={() =>
                                handleUpdateSubscription(
                                  trainer.id,
                                  "cancelled"
                                )
                              }
                            >
                              Cancelar
                            </DropdownItem>
                          ) : null}
                          <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            startContent={
                              <Icon icon="solar:trash-bin-trash-bold" />
                            }
                            onPress={() => setTrainerToDelete(trainer)}
                          >
                            Eliminar Permanentemente
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Add Trainer Modal */}
      <AddTrainerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchTrainers();
        }}
      />

      {/* Delete Trainer Modal */}
      {trainerToDelete && (
        <DeleteTrainerModal
          isOpen={!!trainerToDelete}
          trainerId={trainerToDelete.id}
          trainerName={trainerToDelete.full_name}
          onClose={() => setTrainerToDelete(null)}
          onSuccess={() => {
            setTrainerToDelete(null);
            fetchTrainers();
          }}
        />
      )}
    </div>
  );
}
