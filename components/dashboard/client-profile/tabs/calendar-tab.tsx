"use client";

import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface CalendarTabProps {
  clientId: string;
}

export default function CalendarTab({ clientId }: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock data - En producción vendría de Supabase
  const calendarData: Record<
    string,
    {
      workout?: { name: string; completed: boolean };
      cardio?: { type: string; duration: number };
      meals?: { count: number };
      checkIn?: { weight: number; notes: string };
      photos?: { count: number };
    }
  > = {
    "2025-10-15": {
      workout: { name: "Full Body A", completed: true },
      cardio: { type: "Running", duration: 30 },
      meals: { count: 5 },
      checkIn: { weight: 82.5, notes: "Muy buena semana" },
      photos: { count: 3 },
    },
    "2025-10-16": {
      workout: { name: "Full Body B", completed: false },
      meals: { count: 4 },
    },
    "2025-10-14": {
      cardio: { type: "Cycling", duration: 45 },
      meals: { count: 5 },
    },
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const changeMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);

      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }

      return newDate;
    });
  };

  const handleDayClick = (dateString: string) => {
    setSelectedDate(dateString);
    setIsModalOpen(true);
  };

  const hasDataForDate = (dateString: string) => {
    return !!calendarData[dateString];
  };

  const getDataForDate = (dateString: string) => {
    return calendarData[dateString] || null;
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = `${currentDate.toLocaleDateString("es-ES", { month: "long" })} ${currentDate.getFullYear()}`;
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const selectedDateData = selectedDate ? getDataForDate(selectedDate) : null;
  const selectedDateFormatted = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Calendario</h2>
        <p className="text-sm text-gray-600 mt-1">
          Vista general de actividades, nutrición y progreso diario
        </p>
      </div>

      {/* Calendar */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 capitalize">
              {monthName}
            </h3>
            <div className="flex gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => changeMonth("prev")}
              >
                <Icon icon="solar:alt-arrow-left-linear" width={20} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => changeMonth("next")}
              >
                <Icon icon="solar:alt-arrow-right-linear" width={20} />
              </Button>
            </div>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dayDate = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                dayNumber
              );
              const dateString = dayDate.toISOString().split("T")[0]!;
              const isToday =
                dayDate.toDateString() === new Date().toDateString();
              const hasData = hasDataForDate(dateString);
              const data = getDataForDate(dateString);

              return (
                <div key={i} className="aspect-square relative">
                  <Card
                    isPressable
                    className={`w-full h-full ${
                      hasData
                        ? isToday
                          ? "border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100"
                          : "border-2 border-green-400 bg-gradient-to-br from-green-50 to-green-100"
                        : isToday
                          ? "border-2 border-blue-400 bg-blue-50"
                          : "border border-gray-200 bg-white hover:bg-gray-50"
                    } shadow-sm hover:shadow-lg transition-all`}
                    onPress={() => handleDayClick(dateString)}
                  >
                    <CardBody className="p-2 flex flex-col items-start justify-start h-full">
                      {/* Day number */}
                      <span
                        className={`text-sm font-bold mb-1 ${
                          hasData
                            ? isToday
                              ? "text-blue-700"
                              : "text-green-700"
                            : isToday
                              ? "text-blue-700"
                              : "text-gray-600"
                        }`}
                      >
                        {dayNumber}
                      </span>

                      {/* Activity indicators */}
                      {hasData && data && (
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {data.workout && (
                            <div
                              className="bg-blue-100 p-1 rounded"
                              title="Entrenamiento"
                            >
                              <Icon
                                className="text-blue-600"
                                icon="solar:dumbbell-bold"
                                width={18}
                              />
                            </div>
                          )}
                          {data.cardio && (
                            <div
                              className="bg-red-100 p-1 rounded"
                              title="Cardio"
                            >
                              <Icon
                                className="text-red-600"
                                icon="solar:heart-pulse-bold"
                                width={18}
                              />
                            </div>
                          )}
                          {data.meals && (
                            <div
                              className="bg-orange-100 p-1 rounded"
                              title="Nutrición"
                            >
                              <Icon
                                className="text-orange-600"
                                icon="solar:leaf-bold"
                                width={18}
                              />
                            </div>
                          )}
                          {data.checkIn && (
                            <div
                              className="bg-purple-100 p-1 rounded"
                              title="Check-in"
                            >
                              <Icon
                                className="text-purple-600"
                                icon="solar:clipboard-list-bold"
                                width={18}
                              />
                            </div>
                          )}
                          {data.photos && (
                            <div
                              className="bg-pink-100 p-1 rounded"
                              title="Fotos"
                            >
                              <Icon
                                className="text-pink-600"
                                icon="solar:camera-bold"
                                width={18}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-3">Leyenda:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1 rounded">
                  <Icon
                    className="text-blue-600"
                    icon="solar:dumbbell-bold"
                    width={16}
                  />
                </div>
                <span className="text-xs text-gray-600">Entrenamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-red-100 p-1 rounded">
                  <Icon
                    className="text-red-600"
                    icon="solar:heart-pulse-bold"
                    width={16}
                  />
                </div>
                <span className="text-xs text-gray-600">Cardio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-orange-100 p-1 rounded">
                  <Icon
                    className="text-orange-600"
                    icon="solar:leaf-bold"
                    width={16}
                  />
                </div>
                <span className="text-xs text-gray-600">Nutrición</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1 rounded">
                  <Icon
                    className="text-purple-600"
                    icon="solar:clipboard-list-bold"
                    width={16}
                  />
                </div>
                <span className="text-xs text-gray-600">Check-in</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-pink-100 p-1 rounded">
                  <Icon
                    className="text-pink-600"
                    icon="solar:camera-bold"
                    width={16}
                  />
                </div>
                <span className="text-xs text-gray-600">Fotos</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Day Detail Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          body: "py-6",
        }}
        isOpen={isModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={() => setIsModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
                  icon="solar:calendar-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 capitalize">
                  {selectedDateFormatted}
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Resumen del día
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedDateData ? (
              <div className="space-y-4">
                {/* Entrenamiento */}
                {selectedDateData.workout && (
                  <Card className="bg-white border border-blue-200">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg">
                          <Icon
                            className="text-blue-600"
                            icon="solar:dumbbell-bold"
                            width={24}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">
                            Entrenamiento
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedDateData.workout.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Estado:{" "}
                            {selectedDateData.workout.completed
                              ? "✓ Completado"
                              : "Pendiente"}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Cardio */}
                {selectedDateData.cardio && (
                  <Card className="bg-white border border-red-200">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-red-50 p-2 rounded-lg">
                          <Icon
                            className="text-red-600"
                            icon="solar:heart-pulse-bold"
                            width={24}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">
                            Cardio
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedDateData.cardio.type}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Duración: {selectedDateData.cardio.duration} minutos
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Nutrición */}
                {selectedDateData.meals && (
                  <Card className="bg-white border border-orange-200">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-orange-50 p-2 rounded-lg">
                          <Icon
                            className="text-orange-600"
                            icon="solar:leaf-bold"
                            width={24}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">
                            Nutrición
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedDateData.meals.count} comidas registradas
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Check-in */}
                {selectedDateData.checkIn && (
                  <Card className="bg-white border border-purple-200">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-purple-50 p-2 rounded-lg">
                          <Icon
                            className="text-purple-600"
                            icon="solar:clipboard-list-bold"
                            width={24}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">
                            Check-in Diario
                          </h4>
                          <p className="text-sm text-gray-600">
                            Peso: {selectedDateData.checkIn.weight} kg
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedDateData.checkIn.notes}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Fotos */}
                {selectedDateData.photos && (
                  <Card className="bg-white border border-pink-200">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-pink-50 p-2 rounded-lg">
                          <Icon
                            className="text-pink-600"
                            icon="solar:camera-bold"
                            width={24}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">
                            Fotos de Progreso
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedDateData.photos.count} foto(s) subida(s)
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="text-center py-12">
                <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Icon
                    className="text-gray-400 text-3xl"
                    icon="solar:calendar-linear"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Sin actividad registrada
                </h3>
                <p className="text-sm text-gray-500">
                  No hay datos registrados para este día
                </p>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
