"use client";

import type { ClientNeatGoal } from "@/types";

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface NeatTabProps {
  clientId: string;
}

// Helper to get weekday name in Spanish
const getWeekdayName = (day: number): string => {
  const names = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  return names[day];
};

// Helper to get weekday icon
const getWeekdayIcon = (day: number): string => {
  // All days use calendar icon
  return "solar:calendar-bold";
};

export default function NeatTab({ clientId }: NeatTabProps) {
  const [goals, setGoals] = useState<ClientNeatGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for editing a specific weekday
  const [goalForm, setGoalForm] = useState({
    day_type: "active" as "active" | "break",
    steps_goal: "",
    active_minutes_goal: "",
    distance_goal_km: "",
    notes: "",
  });

  // Fetch NEAT goals on mount
  useEffect(() => {
    fetchGoals();
  }, [clientId]);

  const fetchGoals = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${clientId}/neat`);
      const result = await response.json();

      if (result.success) {
        setGoals(result.data || []);
      } else {
        setError(result.error || "Error al cargar objetivos NEAT");
      }
    } catch (err) {
      console.error("[NeatTab] Error fetching goals:", err);
      setError("Error al cargar objetivos NEAT");
    } finally {
      setIsLoading(false);
    }
  };

  // Get goal for a specific weekday
  const getGoalForWeekday = (weekday: number): ClientNeatGoal | null => {
    return goals.find((g) => g.weekday === weekday) || null;
  };

  // Handle edit click
  const handleEditWeekday = (weekday: number) => {
    const existingGoal = getGoalForWeekday(weekday);

    if (existingGoal) {
      setGoalForm({
        day_type: existingGoal.day_type,
        steps_goal: existingGoal.steps_goal?.toString() || "",
        active_minutes_goal: existingGoal.active_minutes_goal?.toString() || "",
        distance_goal_km: existingGoal.distance_goal_km?.toString() || "",
        notes: existingGoal.notes || "",
      });
    } else {
      // Default values for new goal
      setGoalForm({
        day_type: "active",
        steps_goal: "",
        active_minutes_goal: "",
        distance_goal_km: "",
        notes: "",
      });
    }

    setEditingWeekday(weekday);
  };

  // Handle save
  const handleSave = async (weekday: number) => {
    setIsSaving(true);

    try {
      const payload = {
        weekday,
        day_type: goalForm.day_type,
        steps_goal: goalForm.steps_goal ? parseInt(goalForm.steps_goal) : null,
        active_minutes_goal: goalForm.active_minutes_goal
          ? parseInt(goalForm.active_minutes_goal)
          : null,
        distance_goal_km: goalForm.distance_goal_km
          ? parseFloat(goalForm.distance_goal_km)
          : null,
        notes: goalForm.notes || null,
      };

      const response = await fetch(`/api/clients/${clientId}/neat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh goals
        await fetchGoals();
        setEditingWeekday(null);
      } else {
        alert(`Error al guardar: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("[NeatTab] Error saving goal:", err);
      alert("Error al guardar objetivo NEAT");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (weekday: number) => {
    const goal = getGoalForWeekday(weekday);

    if (!goal) return;

    if (
      !confirm(
        `¿Estás seguro de eliminar los objetivos NEAT para ${getWeekdayName(weekday)}?`
      )
    )
      return;

    try {
      const response = await fetch(`/api/clients/${clientId}/neat/${goal.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await fetchGoals();
      } else {
        alert(`Error al eliminar: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("[NeatTab] Error deleting goal:", err);
      alert("Error al eliminar objetivo NEAT");
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditingWeekday(null);
    setGoalForm({
      day_type: "active",
      steps_goal: "",
      active_minutes_goal: "",
      distance_goal_km: "",
      notes: "",
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Icon
          className="text-red-500 mb-4"
          icon="solar:danger-circle-bold"
          width={48}
        />
        <p className="text-red-600 text-lg">{error}</p>
        <Button
          className="mt-4"
          color="primary"
          variant="flat"
          onPress={fetchGoals}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Objetivos NEAT</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configura objetivos de actividad diaria por día de la semana
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border border-blue-200">
        <CardBody className="p-4">
          <div className="flex items-start gap-3">
            <Icon
              className="text-blue-600 mt-0.5 flex-shrink-0"
              icon="solar:info-circle-bold"
              width={20}
            />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">¿Qué es NEAT?</p>
              <p className="text-blue-700">
                NEAT (Non-Exercise Activity Thermogenesis) se refiere a la
                energía gastada en actividades diarias que no son ejercicio
                formal. Configura objetivos de pasos, minutos activos y
                distancia para cada día de la semana.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Weekday Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
          const goal = getGoalForWeekday(weekday);
          const isEditing = editingWeekday === weekday;
          const isActive = goal?.day_type === "active";
          const isBreak = goal?.day_type === "break";

          return (
            <Card
              key={weekday}
              className={`border-2 ${
                isActive
                  ? "border-green-300 bg-green-50"
                  : isBreak
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white"
              }`}
            >
              <CardBody className="p-4">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? "bg-green-100"
                          : isBreak
                            ? "bg-orange-100"
                            : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`${
                          isActive
                            ? "text-green-600"
                            : isBreak
                              ? "text-orange-600"
                              : "text-gray-600"
                        }`}
                        icon={getWeekdayIcon(weekday)}
                        width={20}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {getWeekdayName(weekday)}
                      </h3>
                      {goal && (
                        <Badge
                          className="mt-1"
                          color={isActive ? "success" : "warning"}
                          size="sm"
                          variant="flat"
                        >
                          {isActive ? "Día Activo" : "Día de Descanso"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <Select
                      label="Tipo de Día"
                      selectedKeys={[goalForm.day_type]}
                      size="sm"
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0] as "active" | "break";

                        setGoalForm({ ...goalForm, day_type: value });
                      }}
                    >
                      <SelectItem key="active">Día Activo</SelectItem>
                      <SelectItem key="break">Día de Descanso</SelectItem>
                    </Select>

                    <Input
                      endContent={
                        <span className="text-xs text-gray-500">pasos</span>
                      }
                      label="Objetivo de Pasos"
                      placeholder="10000"
                      size="sm"
                      type="number"
                      value={goalForm.steps_goal}
                      onValueChange={(value) =>
                        setGoalForm({ ...goalForm, steps_goal: value })
                      }
                    />

                    <Input
                      endContent={
                        <span className="text-xs text-gray-500">min</span>
                      }
                      label="Minutos Activos"
                      placeholder="30"
                      size="sm"
                      type="number"
                      value={goalForm.active_minutes_goal}
                      onValueChange={(value) =>
                        setGoalForm({
                          ...goalForm,
                          active_minutes_goal: value,
                        })
                      }
                    />

                    <Input
                      endContent={
                        <span className="text-xs text-gray-500">km</span>
                      }
                      label="Distancia"
                      placeholder="5.0"
                      size="sm"
                      step="0.1"
                      type="number"
                      value={goalForm.distance_goal_km}
                      onValueChange={(value) =>
                        setGoalForm({ ...goalForm, distance_goal_km: value })
                      }
                    />

                    <Textarea
                      label="Notas"
                      minRows={2}
                      placeholder="Notas adicionales..."
                      size="sm"
                      value={goalForm.notes}
                      onValueChange={(value) =>
                        setGoalForm({ ...goalForm, notes: value })
                      }
                    />

                    <div className="flex gap-2 mt-4">
                      <Button
                        className="flex-1 text-white font-semibold"
                        color="primary"
                        isDisabled={isSaving}
                        isLoading={isSaving}
                        size="sm"
                        onPress={() => handleSave(weekday)}
                      >
                        Guardar
                      </Button>
                      <Button
                        className="flex-1"
                        isDisabled={isSaving}
                        size="sm"
                        variant="flat"
                        onPress={handleCancel}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    {goal ? (
                      <div className="space-y-3">
                        {/* Goals Display */}
                        {goal.steps_goal !== null && (
                          <div className="flex items-center gap-2">
                            <Icon
                              className="text-blue-600 flex-shrink-0"
                              icon="solar:walking-bold"
                              width={18}
                            />
                            <div className="flex-1">
                              <p className="text-xs text-gray-600">Pasos</p>
                              <p className="text-sm font-bold text-gray-900">
                                {goal.steps_goal.toLocaleString()} pasos
                              </p>
                            </div>
                          </div>
                        )}

                        {goal.active_minutes_goal !== null && (
                          <div className="flex items-center gap-2">
                            <Icon
                              className="text-purple-600 flex-shrink-0"
                              icon="solar:clock-circle-bold"
                              width={18}
                            />
                            <div className="flex-1">
                              <p className="text-xs text-gray-600">
                                Minutos Activos
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {goal.active_minutes_goal} min
                              </p>
                            </div>
                          </div>
                        )}

                        {goal.distance_goal_km !== null && (
                          <div className="flex items-center gap-2">
                            <Icon
                              className="text-green-600 flex-shrink-0"
                              icon="solar:route-bold"
                              width={18}
                            />
                            <div className="flex-1">
                              <p className="text-xs text-gray-600">Distancia</p>
                              <p className="text-sm font-bold text-gray-900">
                                {goal.distance_goal_km} km
                              </p>
                            </div>
                          </div>
                        )}

                        {goal.notes && (
                          <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 mt-2">
                            <p className="text-xs text-blue-700">
                              {goal.notes}
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4">
                          <Button
                            className="flex-1"
                            size="sm"
                            startContent={
                              <Icon icon="solar:pen-linear" width={16} />
                            }
                            variant="flat"
                            onPress={() => handleEditWeekday(weekday)}
                          >
                            Editar
                          </Button>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="flat"
                            onPress={() => handleDelete(weekday)}
                          >
                            <Icon
                              icon="solar:trash-bin-trash-linear"
                              width={16}
                            />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="text-center py-6">
                        <Icon
                          className="text-gray-300 mx-auto mb-2"
                          icon="solar:graph-up-linear"
                          width={32}
                        />
                        <p className="text-sm text-gray-500 mb-3">
                          Sin objetivos configurados
                        </p>
                        <Button
                          className="text-white font-semibold"
                          color="primary"
                          size="sm"
                          startContent={
                            <Icon icon="solar:add-circle-bold" width={16} />
                          }
                          variant="flat"
                          onPress={() => handleEditWeekday(weekday)}
                        >
                          Configurar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
