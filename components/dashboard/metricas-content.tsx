"use client";

import { Button, Card, CardBody, CardHeader, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState, useCallback } from "react";

import AddClientModal from "@/components/dashboard/add-client-modal";
import AddExerciseLibraryModal from "@/components/dashboard/add-exercise-library-modal";
import AddSupplementModal from "@/components/dashboard/add-supplement-modal";

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
  // Top-level KPIs
  activeClients: number;
  completedSessions: number;
  retentionRate: number;
  // Engagement
  scheduledSessionsThisWeek: number;
  missedSessionsThisWeek: number;
  checkinsThisWeek: number;
  clientsActiveToday: number;
  unreadMessages: number;
  // Activity feed
  recentActivity: ActivityEvent[];
  // Attention
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

// Relative time helper
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays}d`;

  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Color maps for activity events
const defaultColor = {
  bg: "bg-slate-100",
  text: "text-slate-700",
  ring: "ring-slate-200",
} as const;

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    ring: "ring-green-200",
  },
  red: { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
  slate: defaultColor,
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    ring: "ring-amber-200",
  },
};

export default function MetricasContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
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

  const handleClientSuccess = () => {
    setIsClientModalOpen(false);
    fetchMetrics();
  };

  const sessionCompletionRate =
    metrics.scheduledSessionsThisWeek > 0
      ? Math.round(
          (metrics.completedSessions / metrics.scheduledSessionsThisWeek) * 100
        )
      : 0;

  return (
    <>
      {/* Modals */}
      <AddClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={handleClientSuccess}
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

      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Welcome Section */}
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-heading font-bold text-gray-900">
            Metricas
          </h2>
          <p className="text-gray-600 font-body text-base">
            Supervisa el rendimiento de tu plataforma de coaching y el
            compromiso de tus clientes
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Clientes Activos
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {isLoading ? "..." : metrics.activeClients}
                  </p>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl">
                  <Icon
                    className="text-slate-700 text-2xl"
                    icon="solar:users-group-rounded-bold"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-gray-500">
                  Total de clientes activos
                </span>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Sesiones Completadas
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {isLoading ? "..." : metrics.completedSessions}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-xl">
                  <Icon
                    className="text-green-600 text-2xl"
                    icon="solar:dumbbell-bold"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-gray-500">esta semana</span>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    Tasa de Retención
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {isLoading ? "..." : `${metrics.retentionRate}%`}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-xl">
                  <Icon
                    className="text-orange-600 text-2xl"
                    icon="solar:chart-2-bold"
                  />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xs text-gray-500">
                  Clientes a largo plazo
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Clients Needing Attention Alert */}
        {!isLoading && metrics.clientsNeedingAttention > 0 && (
          <Card className="bg-amber-50 border border-amber-200 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2.5 rounded-xl">
                  <Icon
                    className="text-amber-600 text-xl"
                    icon="solar:danger-triangle-bold"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 text-sm">
                    {metrics.clientsNeedingAttention} cliente
                    {metrics.clientsNeedingAttention !== 1 ? "s" : ""} sin
                    actividad reciente
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    No han iniciado sesión en los últimos 7 días
                  </p>
                </div>
                <Button
                  className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none"
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    if (typeof window !== "undefined") {
                      localStorage.setItem("activeSection", "clients");
                      window.location.href = "/trainer/dashboard";
                    }
                  }}
                >
                  Ver clientes
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Engagement Summary + Activity Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Engagement Summary (left column — 4 mini-cards) */}
          <div className="xl:col-span-1 grid grid-cols-2 gap-3">
            {/* Sessions this week */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-green-50 p-1.5 rounded-lg">
                    <Icon
                      className="text-green-600"
                      icon="solar:dumbbell-bold"
                      width={16}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Sesiones
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? (
                    "..."
                  ) : (
                    <>
                      {metrics.completedSessions}
                      <span className="text-sm font-normal text-gray-400">
                        /{metrics.scheduledSessionsThisWeek}
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-2">
                  {!isLoading && metrics.scheduledSessionsThisWeek > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(sessionCompletionRate, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">esta semana</p>
                </div>
              </CardBody>
            </Card>

            {/* Check-ins received */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-blue-50 p-1.5 rounded-lg">
                    <Icon
                      className="text-blue-600"
                      icon="solar:document-text-bold"
                      width={16}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Check-ins
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : metrics.checkinsThisWeek}
                </p>
                <p className="text-xs text-gray-500 mt-1">esta semana</p>
              </CardBody>
            </Card>

            {/* Clients active today */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-slate-100 p-1.5 rounded-lg">
                    <Icon
                      className="text-slate-700"
                      icon="solar:user-check-rounded-bold"
                      width={16}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Activos hoy
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : metrics.clientsActiveToday}
                </p>
                <p className="text-xs text-gray-500 mt-1">conectados hoy</p>
              </CardBody>
            </Card>

            {/* Unread messages */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-purple-50 p-1.5 rounded-lg">
                    <Icon
                      className="text-purple-600"
                      icon="solar:chat-round-dots-bold"
                      width={16}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Mensajes
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : metrics.unreadMessages}
                </p>
                <p className="text-xs text-gray-500 mt-1">sin leer</p>
              </CardBody>
            </Card>
          </div>

          {/* Activity Feed (right column) */}
          <Card className="xl:col-span-2 bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 px-6 pt-5">
              <div className="flex justify-between items-center w-full">
                <div>
                  <h3 className="font-heading font-semibold text-gray-900 text-lg">
                    Actividad Reciente
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Últimos 7 días</p>
                </div>
                <Button
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    if (typeof window !== "undefined") {
                      localStorage.setItem("activeSection", "clients");
                      window.location.href = "/trainer/dashboard";
                    }
                  }}
                >
                  Ver clientes
                </Button>
              </div>
            </CardHeader>
            <CardBody className="px-6 pb-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : metrics.recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {metrics.recentActivity.map((event, idx) => {
                    const colors = colorMap[event.color] ?? defaultColor;

                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {/* Icon */}
                        <div
                          className={`${colors.bg} p-2 rounded-full flex-shrink-0`}
                        >
                          <Icon
                            className={`${colors.text}`}
                            icon={event.icon}
                            width={18}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold">
                              {event.clientName}
                            </span>{" "}
                            <span className="text-gray-600">
                              {event.description}
                            </span>
                          </p>
                        </div>

                        {/* Timestamp */}
                        <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                      <Icon
                        className="text-gray-400 text-3xl"
                        icon="solar:history-bold"
                      />
                    </div>
                    <p className="text-gray-700 font-medium">
                      Sin actividad reciente
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      La actividad de tus clientes aparecerá aquí
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 shadow-sm">
          <CardHeader className="px-6 pt-6 pb-4">
            <h3 className="font-heading font-semibold text-gray-900 text-lg">
              Acciones Rápidas
            </h3>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200 cursor-pointer"
                startContent={
                  <div className="bg-slate-100 p-2.5 rounded-lg">
                    <Icon
                      className="text-slate-700 text-xl"
                      icon="solar:user-plus-bold"
                    />
                  </div>
                }
                variant="flat"
                onPress={() => setIsClientModalOpen(true)}
              >
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">
                    Añadir Cliente
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Registrar un nuevo cliente
                  </p>
                </div>
              </Button>

              <Button
                className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200 cursor-pointer"
                startContent={
                  <div className="bg-purple-50 p-2.5 rounded-lg">
                    <Icon
                      className="text-purple-600 text-xl"
                      icon="solar:box-linear"
                    />
                  </div>
                }
                variant="flat"
                onPress={() => setIsSupplementModalOpen(true)}
              >
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">
                    Añadir Suplemento
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Agregar al inventario
                  </p>
                </div>
              </Button>

              <Button
                className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200 cursor-pointer"
                startContent={
                  <div className="bg-green-50 p-2.5 rounded-lg">
                    <Icon
                      className="text-green-600 text-xl"
                      icon="solar:dumbbell-bold"
                    />
                  </div>
                }
                variant="flat"
                onPress={() => setIsExerciseModalOpen(true)}
              >
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">
                    Añadir Ejercicio
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Agregar a biblioteca
                  </p>
                </div>
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
