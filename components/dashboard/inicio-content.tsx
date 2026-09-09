"use client";

import { Button, Card, CardBody, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import AddClientModal from "@/components/dashboard/add-client-modal";
import AddExerciseLibraryModal from "@/components/dashboard/add-exercise-library-modal";
import AddSupplementModal from "@/components/dashboard/add-supplement-modal";
import { CenteredState } from "@/components/shared/centered-state";
import { IconTile } from "@/components/shared/icon-tile";
import { StatTile } from "@/components/shared/stat-tile";
import { NutritionUpdateBanner } from "@/features/trainer/nutrition-update/nutrition-update-banner";
import { PendingReviewsCard } from "@/features/trainer/training/videos/pending-reviews-card";

type Tone = "default" | "primary" | "success" | "warning" | "danger";

interface ActivityEvent {
  id: string;
  type: string;
  clientName: string;
  clientId: number;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

interface DashboardMetrics {
  activeClients: number;
  completedSessions: number;
  retentionRate: number;
  scheduledSessionsThisWeek: number;
  missedSessionsThisWeek: number;
  checkinsThisWeek: number;
  clientsActiveToday: number;
  unreadMessages: number;
  recentActivity: ActivityEvent[];
  clientsNeedingAttention: number;
}

const DEFAULT_METRICS: DashboardMetrics = {
  activeClients: 0,
  completedSessions: 0,
  retentionRate: 0,
  scheduledSessionsThisWeek: 0,
  missedSessionsThisWeek: 0,
  checkinsThisWeek: 0,
  clientsActiveToday: 0,
  unreadMessages: 0,
  recentActivity: [],
  clientsNeedingAttention: 0,
};

/** El feed llega con un color de paleta cruda desde la API; se traduce a un
 *  tono semántico para que el tema del tenant lo tiña. */
const EVENT_TONES: Record<string, Tone> = {
  green: "success",
  red: "danger",
  blue: "primary",
  amber: "warning",
  slate: "default",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;

  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Los números entran por skeleton, no por "…": el ancho de tres puntos no es
 *  el del número y la tarjeta salta al resolver. */
function StatValue({
  loading,
  children,
}: {
  children: React.ReactNode;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="mt-1 h-7 w-16 rounded-md" />;

  return <>{children}</>;
}

export default function InicioContent() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(true);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSupplementModalOpen, setIsSupplementModalOpen] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/metrics/dashboard");

      if (response.ok) {
        const data = await response.json();

        setMetrics({ ...DEFAULT_METRICS, ...data });
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const goToClients = () => router.push("/trainer/dashboard/clients");

  const sessionCompletionRate =
    metrics.scheduledSessionsThisWeek > 0
      ? Math.round(
          (metrics.completedSessions / metrics.scheduledSessionsThisWeek) * 100
        )
      : 0;

  const quickActions = [
    {
      caption: "Registrar un nuevo cliente",
      icon: "solar:user-plus-bold",
      label: "Añadir cliente",
      onPress: () => setIsClientModalOpen(true),
      tone: "primary" as const,
    },
    {
      caption: "Agregar al inventario",
      icon: "solar:box-bold",
      label: "Añadir suplemento",
      onPress: () => setIsSupplementModalOpen(true),
      tone: "success" as const,
    },
    {
      caption: "Agregar a la biblioteca",
      icon: "solar:dumbbell-bold",
      label: "Añadir ejercicio",
      onPress: () => setIsExerciseModalOpen(true),
      tone: "warning" as const,
    },
  ];

  return (
    <>
      <AddClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={() => {
          setIsClientModalOpen(false);
          fetchMetrics();
        }}
      />
      <AddSupplementModal
        isOpen={isSupplementModalOpen}
        onClose={() => setIsSupplementModalOpen(false)}
        onSuccess={() => setIsSupplementModalOpen(false)}
      />
      <AddExerciseLibraryModal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onSuccess={() => setIsExerciseModalOpen(false)}
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Inicio
          </h1>
          <p className="text-sm text-default-500">
            El pulso de tu plataforma: actividad de clientes, sesiones y
            mensajes de los últimos siete días.
          </p>
        </div>

        <NutritionUpdateBanner />

        {/* KPIs principales */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-large border border-default-200 bg-default-200 sm:grid-cols-3">
          <StatTile
            caption="Total en tu cartera"
            icon="solar:users-group-rounded-bold"
            label="Clientes activos"
            tone="primary"
            value={
              <StatValue loading={isLoading}>{metrics.activeClients}</StatValue>
            }
          />
          <StatTile
            caption="Esta semana"
            icon="solar:dumbbell-bold"
            label="Sesiones completadas"
            tone="success"
            value={
              <StatValue loading={isLoading}>
                {metrics.completedSessions}
              </StatValue>
            }
          />
          <StatTile
            caption="Clientes a largo plazo"
            icon="solar:chart-2-bold"
            label="Tasa de retención"
            tone="warning"
            value={
              <StatValue loading={isLoading}>
                {metrics.retentionRate}%
              </StatValue>
            }
          />
        </div>

        {/* Aviso de clientes sin actividad */}
        {!isLoading && metrics.clientsNeedingAttention > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-large border border-warning/20 bg-warning/5 p-4">
            <IconTile
              icon="solar:danger-triangle-bold"
              size="sm"
              tone="warning"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {metrics.clientsNeedingAttention}{" "}
                {metrics.clientsNeedingAttention === 1
                  ? "cliente sin actividad reciente"
                  : "clientes sin actividad reciente"}
              </p>
              <p className="mt-0.5 text-xs text-default-500">
                No han iniciado sesión en los últimos 7 días.
              </p>
            </div>
            <Button
              className="font-medium"
              size="sm"
              variant="flat"
              onPress={goToClients}
            >
              Ver clientes
            </Button>
          </div>
        )}

        <PendingReviewsCard />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Engagement */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-default-200 bg-default-200 xl:col-span-1">
            <StatTile
              caption="Esta semana"
              icon="solar:dumbbell-bold"
              label="Sesiones"
              tone="success"
              value={
                <StatValue loading={isLoading}>
                  {metrics.completedSessions}
                  <span className="text-sm font-normal text-default-400">
                    /{metrics.scheduledSessionsThisWeek}
                  </span>
                </StatValue>
              }
            >
              {!isLoading && metrics.scheduledSessionsThisWeek > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default-100">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{
                      width: `${Math.min(sessionCompletionRate, 100)}%`,
                    }}
                  />
                </div>
              )}
            </StatTile>

            <StatTile
              caption="Esta semana"
              icon="solar:document-text-bold"
              label="Check-ins"
              tone="primary"
              value={
                <StatValue loading={isLoading}>
                  {metrics.checkinsThisWeek}
                </StatValue>
              }
            />
            <StatTile
              caption="Conectados hoy"
              icon="solar:user-check-rounded-bold"
              label="Activos hoy"
              tone="default"
              value={
                <StatValue loading={isLoading}>
                  {metrics.clientsActiveToday}
                </StatValue>
              }
            />
            <StatTile
              caption="Sin leer"
              icon="solar:chat-round-dots-bold"
              label="Mensajes"
              tone="warning"
              value={
                <StatValue loading={isLoading}>
                  {metrics.unreadMessages}
                </StatValue>
              }
            />
          </div>

          {/* Actividad reciente */}
          <Card
            className="border border-default-200 bg-content1 shadow-sm xl:col-span-2"
            shadow="none"
          >
            <CardBody className="gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      aria-hidden
                      className="text-primary"
                      icon="solar:history-linear"
                      width={18}
                    />
                    <h2 className="font-heading text-sm font-semibold text-foreground">
                      Actividad reciente
                    </h2>
                  </div>
                  <p className="text-xs text-default-500">
                    Lo que han hecho tus clientes en los últimos 7 días.
                  </p>
                </div>

                <Button
                  className="shrink-0 font-medium"
                  size="sm"
                  variant="flat"
                  onPress={goToClients}
                >
                  Ver clientes
                </Button>
              </div>

              {isLoading ? (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                      <Skeleton className="h-3.5 flex-1 rounded-sm" />
                      <Skeleton className="h-3 w-12 shrink-0 rounded-sm" />
                    </div>
                  ))}
                </div>
              ) : metrics.recentActivity.length === 0 ? (
                <CenteredState
                  icon="solar:history-linear"
                  subtitle="Cuando tus clientes entrenen, registren o escriban, lo verás aquí."
                  title="Sin actividad reciente"
                />
              ) : (
                <ul className="flex flex-col">
                  {metrics.recentActivity.map((event) => (
                    <li key={event.id}>
                      <button
                        className="flex w-full items-center gap-3 rounded-medium p-2 text-left transition-colors hover:bg-content2"
                        type="button"
                        onClick={() =>
                          router.push(
                            `/trainer/dashboard/clients/${event.clientId}`
                          )
                        }
                      >
                        <IconTile
                          icon={event.icon}
                          size="sm"
                          tone={EVENT_TONES[event.color] ?? "default"}
                        />
                        <p className="min-w-0 flex-1 truncate text-sm text-default-600">
                          <span className="font-semibold text-foreground">
                            {event.clientName}
                          </span>{" "}
                          {event.description}
                        </p>
                        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-default-400">
                          {timeAgo(event.timestamp)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Acciones rápidas */}
        <Card
          className="border border-default-200 bg-content1 shadow-sm"
          shadow="none"
        >
          <CardBody className="gap-4 p-5">
            <div className="flex items-center gap-2">
              <Icon
                aria-hidden
                className="text-primary"
                icon="solar:bolt-linear"
                width={18}
              />
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Acciones rápidas
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="flex items-center gap-3 rounded-large border border-default-200 bg-content1 p-4 text-left transition-colors hover:border-default-300 hover:bg-content2"
                  type="button"
                  onClick={action.onPress}
                >
                  <IconTile icon={action.icon} tone={action.tone} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {action.label}
                    </p>
                    <p className="truncate text-xs text-default-500">
                      {action.caption}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
