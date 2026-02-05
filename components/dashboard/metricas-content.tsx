"use client";

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AddClientModal from "@/components/dashboard/add-client-modal";
import AddExerciseLibraryModal from "@/components/dashboard/add-exercise-library-modal";
import AddSupplementModal from "@/components/dashboard/add-supplement-modal";

interface DashboardMetrics {
  activeClients: number;
  completedSessions: number;
  retentionRate: number;
}

export default function MetricasContent() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeClients: 0,
    completedSessions: 0,
    retentionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSupplementModalOpen, setIsSupplementModalOpen] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch("/api/metrics/dashboard");

        if (response.ok) {
          const data = await response.json();

          setMetrics(data);
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  const handleClientSuccess = () => {
    setIsClientModalOpen(false);
    // Refresh metrics after adding a client
    fetchMetrics();
  };

  const handleSupplementSuccess = () => {
    setIsSupplementModalOpen(false);
  };

  const handleExerciseSuccess = () => {
    setIsExerciseModalOpen(false);
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/metrics/dashboard");

      if (response.ok) {
        const data = await response.json();

        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

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
        onSuccess={handleSupplementSuccess}
      />
      <AddExerciseLibraryModal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onSuccess={handleExerciseSuccess}
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Welcome Section */}
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-heading font-bold text-gray-900">
            Métricas
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
                <div className="bg-purple-50 p-3 rounded-xl">
                  <Icon
                    className="text-purple-600 text-2xl"
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

        {/* Activity Overview */}
        <div className="grid grid-cols-1 gap-4">
          {/* Client Activity */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 px-6 pt-6">
              <div className="flex justify-between items-center w-full">
                <div>
                  <h3 className="font-heading font-semibold text-gray-900 text-lg">
                    Actividad de Clientes
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Esta semana</p>
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
                  Ver todo
                </Button>
              </div>
            </CardHeader>
            <CardBody className="px-6 pb-6">
              {metrics.activeClients > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-700 p-2 rounded-full">
                        <Icon
                          className="text-white text-lg"
                          icon="solar:users-group-rounded-bold"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {metrics.activeClients} Clientes Activos
                        </p>
                        <p className="text-xs text-gray-600">
                          Gestiona tus clientes actuales
                        </p>
                      </div>
                    </div>
                    <Icon
                      className="text-slate-700 text-xl"
                      icon="solar:arrow-right-linear"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100/50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500 p-2 rounded-full">
                        <Icon
                          className="text-white text-lg"
                          icon="solar:dumbbell-bold"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {metrics.completedSessions} Sesiones Completadas
                        </p>
                        <p className="text-xs text-gray-600">Esta semana</p>
                      </div>
                    </div>
                    <Icon
                      className="text-green-600 text-xl"
                      icon="solar:check-circle-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-500 p-2 rounded-full">
                        <Icon
                          className="text-white text-lg"
                          icon="solar:chart-2-bold"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {metrics.retentionRate}% Retención
                        </p>
                        <p className="text-xs text-gray-600">
                          Clientes a largo plazo
                        </p>
                      </div>
                    </div>
                    <Icon
                      className="text-purple-600 text-xl"
                      icon="solar:star-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                      <Icon
                        className="text-gray-400 text-3xl"
                        icon="solar:users-group-rounded-bold"
                      />
                    </div>
                    <p className="text-gray-700 font-medium font-body">
                      Añade tu primer cliente
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      La actividad aparecerá aquí una vez que tengas clientes
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
