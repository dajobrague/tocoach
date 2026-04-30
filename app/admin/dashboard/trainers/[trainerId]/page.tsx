"use client";

import { Icon } from "@iconify/react";
import {
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
import { useParams } from "next/navigation";
import React from "react";

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

interface Client {
  id: number;
  email: string;
  name: string | null;
  last_name: string | null;
  status: string | null;
  last_login_at: string | null;
  sign_up_date: string | null;
  hasPassword: boolean;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Nunca";

  return new Date(dateString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getClientStatusColor(
  status: string | null
): "success" | "warning" | "danger" | "default" {
  if (!status) return "default";
  if (status === "Activo" || status === "Onboarding Completado")
    return "success";
  if (status.toLowerCase().includes("inactiv")) return "danger";

  return "warning";
}

export default function TrainerDetailPage() {
  const params = useParams();
  const trainerId = params.trainerId as string;

  const [trainer, setTrainer] = React.useState<Trainer | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [impersonatingTrainer, setImpersonatingTrainer] = React.useState(false);
  const [impersonatingClientId, setImpersonatingClientId] = React.useState<
    number | null
  >(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [trainerRes, clientsRes] = await Promise.all([
        fetch(`/api/admin/trainers/${trainerId}`, { credentials: "include" }),
        fetch(`/api/admin/trainers/${trainerId}/clients`, {
          credentials: "include",
        }),
      ]);

      if (!trainerRes.ok) {
        const data = await trainerRes.json().catch(() => ({}));

        throw new Error(data.error || "Error al cargar entrenador");
      }
      if (!clientsRes.ok) {
        const data = await clientsRes.json().catch(() => ({}));

        throw new Error(data.error || "Error al cargar clientes");
      }

      const trainerData = await trainerRes.json();
      const clientsData = await clientsRes.json();

      setTrainer(trainerData.trainer);
      setClients(clientsData.clients || []);
    } catch (err) {
      console.error("[TrainerDetail] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, [trainerId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImpersonateTrainer = async () => {
    setImpersonatingTrainer(true);

    try {
      const response = await fetch(
        `/api/admin/trainers/${trainerId}/impersonate`,
        { method: "POST", credentials: "include" }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Error al generar enlace");
      }

      const data = await response.json();

      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Error impersonating trainer:", err);
      alert("Error al acceder a la cuenta del entrenador");
    } finally {
      setImpersonatingTrainer(false);
    }
  };

  const handleImpersonateClient = async (clientId: number) => {
    setImpersonatingClientId(clientId);

    try {
      const response = await fetch(
        `/api/admin/trainers/${trainerId}/clients/${clientId}/impersonate`,
        { method: "POST", credentials: "include" }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Error al generar enlace");
      }

      const data = await response.json();

      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Error impersonating client:", err);
      alert("Error al acceder a la cuenta del cliente");
    } finally {
      setImpersonatingClientId(null);
    }
  };

  const filteredClients = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return clients;

    return clients.filter((c) => {
      const fullName = `${c.name ?? ""} ${c.last_name ?? ""}`.toLowerCase();

      return (
        fullName.includes(term) || (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !trainer) {
    return (
      <div className="space-y-4">
        <a
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          href="/admin/dashboard/trainers"
        >
          <Icon icon="solar:arrow-left-linear" />
          Volver a entrenadores
        </a>
        <Card>
          <CardBody className="p-6">
            <p className="text-danger font-body">
              {error || "Entrenador no encontrado"}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <a
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        href="/admin/dashboard/trainers"
      >
        <Icon icon="solar:arrow-left-linear" />
        Volver a entrenadores
      </a>

      {/* Trainer summary */}
      <Card>
        <CardBody className="p-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-heading">
                {trainer.full_name}
              </h1>
              <p className="text-slate-500 font-body">{trainer.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
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
                <Chip
                  color={
                    trainer.subscription_status === "active"
                      ? "success"
                      : trainer.subscription_status === "paused"
                        ? "warning"
                        : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  {trainer.subscription_status}
                </Chip>
                <Chip
                  color={trainer.status === "active" ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {trainer.status}
                </Chip>
                <Chip size="sm" variant="flat">
                  {trainer.clientCount} clientes
                </Chip>
              </div>
            </div>

            <Button
              color="primary"
              isLoading={impersonatingTrainer}
              startContent={<Icon icon="solar:login-3-bold" />}
              onPress={handleImpersonateTrainer}
            >
              Acceder como Entrenador
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Clients section */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold font-heading">
              Clientes del entrenador
            </h2>
            <Input
              className="max-w-xs"
              placeholder="Buscar por nombre o email..."
              size="sm"
              startContent={<Icon icon="solar:magnifer-linear" />}
              value={searchTerm}
              variant="bordered"
              onValueChange={setSearchTerm}
            />
          </div>

          <Table aria-label="Clients table">
            <TableHeader>
              <TableColumn>CLIENTE</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn>PASSWORD</TableColumn>
              <TableColumn>ÚLTIMO ACCESO</TableColumn>
              <TableColumn>ALTA</TableColumn>
              <TableColumn>ACCIONES</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin clientes">
              {filteredClients.map((client) => {
                const fullName =
                  `${client.name ?? ""} ${client.last_name ?? ""}`.trim() ||
                  client.email;

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold font-body">{fullName}</p>
                        <p className="text-sm text-slate-500 font-body">
                          {client.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getClientStatusColor(client.status)}
                        size="sm"
                        variant="flat"
                      >
                        {client.status || "—"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {client.hasPassword ? (
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
                        {formatDate(client.last_login_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500 font-body">
                        {formatDate(client.sign_up_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        color="primary"
                        isLoading={impersonatingClientId === client.id}
                        size="sm"
                        startContent={<Icon icon="solar:login-3-bold" />}
                        variant="flat"
                        onPress={() => handleImpersonateClient(client.id)}
                      >
                        Acceder como Cliente
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
