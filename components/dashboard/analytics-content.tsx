"use client";

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function AnalyticsContent() {
    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {/* Welcome Section */}
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-heading font-bold text-gray-900">Analytics</h2>
                <p className="text-gray-600 font-body text-base">
                    Supervisa el rendimiento de tu plataforma de coaching y el compromiso de tus clientes
                </p>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Clientes Activos</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">0</p>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-xl">
                                <Icon icon="solar:users-group-rounded-bold" className="text-blue-600 text-2xl" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1">
                            <Icon icon="solar:arrow-up-linear" className="text-green-600 text-sm" />
                            <span className="text-xs text-green-600 font-semibold">0%</span>
                            <span className="text-xs text-gray-500">este mes</span>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Ingresos Mensuales</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">€0</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-xl">
                                <Icon icon="solar:euro-bold" className="text-green-600 text-2xl" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1">
                            <Icon icon="solar:arrow-up-linear" className="text-green-600 text-sm" />
                            <span className="text-xs text-green-600 font-semibold">0%</span>
                            <span className="text-xs text-gray-500">este mes</span>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Sesiones Completadas</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">0</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-xl">
                                <Icon icon="solar:dumbbell-bold" className="text-purple-600 text-2xl" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1">
                            <Icon icon="solar:arrow-up-linear" className="text-green-600 text-sm" />
                            <span className="text-xs text-green-600 font-semibold">0</span>
                            <span className="text-xs text-gray-500">esta semana</span>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Tasa de Retención</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">0%</p>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-xl">
                                <Icon icon="solar:chart-2-bold" className="text-orange-600 text-2xl" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-xs text-gray-500">Promedio: 75%</span>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Revenue Chart */}
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-4 px-6 pt-6">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <h3 className="font-heading font-semibold text-gray-900 text-lg">Ingresos Mensuales</h3>
                                <p className="text-sm text-gray-500 mt-1">Últimos 6 meses</p>
                            </div>
                            <Button
                                size="sm"
                                variant="flat"
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                                endContent={<Icon icon="solar:download-linear" width={16} />}
                            >
                                Exportar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody className="px-6 pb-6">
                        <div className="flex items-center justify-center h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                            <div className="text-center">
                                <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                                    <Icon icon="solar:chart-2-bold" className="text-gray-400 text-3xl" />
                                </div>
                                <p className="text-gray-700 font-medium font-body">Datos de ingresos aparecerán aquí</p>
                                <p className="text-sm text-gray-500 mt-1">una vez que tengas clientes activos</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Client Activity */}
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-4 px-6 pt-6">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <h3 className="font-heading font-semibold text-gray-900 text-lg">Actividad de Clientes</h3>
                                <p className="text-sm text-gray-500 mt-1">Esta semana</p>
                            </div>
                            <Button
                                size="sm"
                                variant="flat"
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >
                                Ver todo
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody className="px-6 pb-6">
                        <div className="flex items-center justify-center h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                            <div className="text-center">
                                <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                                    <Icon icon="solar:users-group-rounded-bold" className="text-gray-400 text-3xl" />
                                </div>
                                <p className="text-gray-700 font-medium font-body">Actividad de clientes aparecerá aquí</p>
                                <p className="text-sm text-gray-500 mt-1">una vez que tengas clientes registrados</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 shadow-sm">
                <CardHeader className="px-6 pt-6 pb-4">
                    <h3 className="font-heading font-semibold text-gray-900 text-lg">Acciones Rápidas</h3>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Button
                            className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200"
                            variant="flat"
                            startContent={
                                <div className="bg-blue-50 p-2.5 rounded-lg">
                                    <Icon icon="solar:user-plus-bold" className="text-blue-600 text-xl" />
                                </div>
                            }
                        >
                            <div className="text-left flex-1">
                                <p className="font-semibold text-gray-900 text-sm">Añadir Cliente</p>
                                <p className="text-xs text-gray-500 mt-0.5">Registrar un nuevo cliente</p>
                            </div>
                        </Button>

                        <Button
                            className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200"
                            variant="flat"
                            startContent={
                                <div className="bg-purple-50 p-2.5 rounded-lg">
                                    <Icon icon="solar:calendar-add-bold" className="text-purple-600 text-xl" />
                                </div>
                            }
                        >
                            <div className="text-left flex-1">
                                <p className="font-semibold text-gray-900 text-sm">Programar Sesión</p>
                                <p className="text-xs text-gray-500 mt-0.5">Crear nueva sesión de entrenamiento</p>
                            </div>
                        </Button>

                        <Button
                            className="h-auto p-4 justify-start bg-white hover:bg-gray-50 border border-gray-200"
                            variant="flat"
                            startContent={
                                <div className="bg-green-50 p-2.5 rounded-lg">
                                    <Icon icon="solar:document-add-bold" className="text-green-600 text-xl" />
                                </div>
                            }
                        >
                            <div className="text-left flex-1">
                                <p className="font-semibold text-gray-900 text-sm">Crear Programa</p>
                                <p className="text-xs text-gray-500 mt-0.5">Diseñar nuevo programa de entrenamiento</p>
                            </div>
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="px-6 pt-6 pb-4">
                    <h3 className="font-heading font-semibold text-gray-900 text-lg">Actividad Reciente</h3>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                    <div className="flex items-center justify-center h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                        <div className="text-center">
                            <div className="bg-white p-3 rounded-full inline-flex mb-2 shadow-sm">
                                <Icon icon="solar:history-bold" className="text-gray-400 text-2xl" />
                            </div>
                            <p className="text-gray-700 font-medium font-body text-sm">No hay actividad reciente</p>
                            <p className="text-xs text-gray-500 mt-1">La actividad aparecerá aquí una vez que empieces a usar la plataforma</p>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
