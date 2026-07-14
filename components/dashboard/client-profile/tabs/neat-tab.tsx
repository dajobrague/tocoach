"use client";

import type { ClientNeatCard } from "@/types";

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ClientStepsSection } from "./neat/client-steps-section";

import { alertAfterPress, confirmAfterPress } from "@/lib/ui/native-dialog";

interface NeatTabProps {
  clientId: string;
}

// Helper to get weekday name in Spanish
const getWeekdayName = (day: number, short: boolean = false): string => {
  const names = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const shortNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return short ? shortNames[day] || "Día" : names[day] || "Día desconocido";
};

// Helper to format weekdays array into a readable string
const formatWeekdays = (weekdays: number[]): string => {
  if (!weekdays || weekdays.length === 0) return "Sin asignar";

  const sorted = [...weekdays].sort((a, b) => a - b);

  return sorted.map((day) => getWeekdayName(day, true)).join(", ");
};

export default function NeatTab({ clientId }: NeatTabProps) {
  const [cards, setCards] = useState<ClientNeatCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ClientNeatCard | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [cardForm, setCardForm] = useState({
    label: "",
    steps_goal: "",
    notes: "",
    weekdays: [] as number[],
  });

  // Fetch NEAT cards on mount
  useEffect(() => {
    fetchCards();
  }, [clientId]);

  const fetchCards = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${clientId}/neat`);
      const result = await response.json();

      if (result.success) {
        setCards(result.data || []);
      } else {
        setError(result.error || "Error al cargar tarjetas NEAT");
      }
    } catch (err) {
      console.error("[NeatTab] Error fetching cards:", err);
      setError("Error al cargar tarjetas NEAT");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle open add modal
  const handleOpenAddModal = () => {
    setCardForm({
      label: "",
      steps_goal: "",
      notes: "",
      weekdays: [],
    });
    setIsAddModalOpen(true);
  };

  // Handle close add modal
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setCardForm({
      label: "",
      steps_goal: "",
      notes: "",
      weekdays: [],
    });
  };

  // Handle save new card
  const handleSaveCard = async () => {
    if (!cardForm.label.trim()) {
      await alertAfterPress("El nombre del día es requerido");

      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        label: cardForm.label,
        steps_goal: cardForm.steps_goal ? parseInt(cardForm.steps_goal) : null,
        notes: cardForm.notes || null,
        weekdays: cardForm.weekdays.length > 0 ? cardForm.weekdays : [],
      };

      const response = await fetch(`/api/clients/${clientId}/neat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        await fetchCards();
        handleCloseAddModal();
      } else {
        await alertAfterPress(
          `Error al guardar: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[NeatTab] Error saving card:", err);
      await alertAfterPress("Error al guardar tarjeta NEAT");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle open edit modal
  const handleOpenEditModal = (card: ClientNeatCard) => {
    setEditingCard(card);
    setCardForm({
      label: card.label,
      steps_goal: card.steps_goal?.toString() || "",
      notes: card.notes || "",
      weekdays: card.weekdays || [],
    });
    setIsEditModalOpen(true);
  };

  // Handle close edit modal
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCard(null);
    setCardForm({
      label: "",
      steps_goal: "",
      notes: "",
      weekdays: [],
    });
  };

  // Handle update card
  const handleUpdateCard = async () => {
    if (!editingCard) return;

    if (!cardForm.label.trim()) {
      await alertAfterPress("El nombre del día es requerido");

      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        label: cardForm.label,
        steps_goal: cardForm.steps_goal ? parseInt(cardForm.steps_goal) : null,
        notes: cardForm.notes || null,
        weekdays: cardForm.weekdays.length > 0 ? cardForm.weekdays : [],
      };

      const response = await fetch(
        `/api/clients/${clientId}/neat/${editingCard.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (result.success) {
        await fetchCards();
        handleCloseEditModal();
      } else {
        await alertAfterPress(
          `Error al actualizar: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[NeatTab] Error updating card:", err);
      await alertAfterPress("Error al actualizar tarjeta NEAT");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete card
  const handleDeleteCard = async (card: ClientNeatCard) => {
    if (
      !(await confirmAfterPress(
        `¿Estás seguro de eliminar "${card.label}"? Esta acción no se puede deshacer.`
      ))
    )
      return;

    try {
      const response = await fetch(`/api/clients/${clientId}/neat/${card.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await fetchCards();
      } else {
        await alertAfterPress(
          `Error al eliminar: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[NeatTab] Error deleting card:", err);
      await alertAfterPress("Error al eliminar tarjeta NEAT");
    }
  };

  // Handle toggle weekday
  const handleToggleWeekday = (dayNum: number) => {
    setCardForm((prev) => {
      const currentWeekdays = prev.weekdays || [];

      if (currentWeekdays.includes(dayNum)) {
        return {
          ...prev,
          weekdays: currentWeekdays.filter((d) => d !== dayNum),
        };
      } else {
        return {
          ...prev,
          weekdays: [...currentWeekdays, dayNum].sort((a, b) => a - b),
        };
      }
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
          onPress={fetchCards}
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
            Configura objetivos de actividad diaria personalizados
          </p>
        </div>
        <Button
          className="text-white font-semibold"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          onPress={handleOpenAddModal}
        >
          Añadir Día NEAT
        </Button>
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
                formal. Configura objetivos de pasos personalizados para cada
                tipo de día.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Client steps activity (migrated from old Progress tab) */}
      <ClientStepsSection clientId={clientId} />

      {/* Cards Grid or Empty State */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Icon
            className="text-gray-300 mb-4"
            icon="solar:graph-up-linear"
            width={64}
          />
          <p className="text-gray-500 text-lg mb-4">
            No hay días NEAT configurados
          </p>
          <Button
            className="text-white font-semibold"
            color="primary"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={handleOpenAddModal}
          >
            Añadir Primer Día NEAT
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card key={card.id} className="border-2 border-gray-200">
              <CardBody className="p-4">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Icon
                        className="text-blue-600"
                        icon="solar:walking-bold"
                        width={20}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{card.label}</h3>
                      {card.weekdays && card.weekdays.length > 0 && (
                        <Badge
                          className="mt-1"
                          color="primary"
                          size="sm"
                          variant="flat"
                        >
                          {formatWeekdays(card.weekdays)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="space-y-3">
                  {/* Steps Goal */}
                  {card.steps_goal !== null && (
                    <div className="flex items-center gap-2">
                      <Icon
                        className="text-green-600 flex-shrink-0"
                        icon="solar:target-bold"
                        width={18}
                      />
                      <div className="flex-1">
                        <p className="text-xs text-gray-600">
                          Objetivo de Pasos
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {card.steps_goal.toLocaleString()} pasos
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {card.notes && (
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-700">{card.notes}</p>
                    </div>
                  )}

                  {/* Weekdays Display */}
                  {card.weekdays && card.weekdays.length > 0 && (
                    <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="flex items-center gap-1">
                        <Icon
                          className="text-purple-600"
                          icon="solar:calendar-bold"
                          width={14}
                        />
                        <p className="text-xs text-purple-700 font-medium">
                          {formatWeekdays(card.weekdays)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    <Button
                      className="flex-1"
                      size="sm"
                      startContent={<Icon icon="solar:pen-linear" width={16} />}
                      variant="flat"
                      onPress={() => handleOpenEditModal(card)}
                    >
                      Editar
                    </Button>
                    <Button
                      isIconOnly
                      color="danger"
                      size="sm"
                      variant="flat"
                      onPress={() => handleDeleteCard(card)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={16} />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddModalOpen}
        size="lg"
        onClose={handleCloseAddModal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
                  icon="solar:add-circle-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Añadir Día NEAT
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Define objetivos de actividad diaria
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                isRequired
                label="Nombre del Día"
                placeholder='Ej: "Día de entrenamiento", "Lunes", "Sesión de ciclismo"'
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:tag-linear"
                    width={18}
                  />
                }
                value={cardForm.label}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, label: value })
                }
              />

              <Input
                endContent={
                  <span className="text-xs text-gray-500">pasos</span>
                }
                label="Objetivo de Pasos (Opcional)"
                placeholder="10000"
                type="number"
                value={cardForm.steps_goal}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, steps_goal: value })
                }
              />

              <Textarea
                label="Notas (Opcional)"
                minRows={3}
                placeholder="Notas adicionales..."
                value={cardForm.notes}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, notes: value })
                }
              />

              {/* Weekdays Selection */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Días de la Semana (Opcional)
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Selecciona los días de la semana en que este objetivo aplica
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => (
                    <button
                      key={dayNum}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        cardForm.weekdays.includes(dayNum)
                          ? "bg-blue-500 border-blue-600 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                      }`}
                      type="button"
                      onClick={() => handleToggleWeekday(dayNum)}
                    >
                      <div className="text-xs font-bold">
                        {getWeekdayName(dayNum, true)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAddModal}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="primary"
              isDisabled={isSaving || !cardForm.label.trim()}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:add-circle-bold" width={18} />
              }
              onPress={handleSaveCard}
            >
              {isSaving ? "Guardando..." : "Añadir Día"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isEditModalOpen}
        size="lg"
        onClose={handleCloseEditModal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon className="text-blue-600 text-xl" icon="solar:pen-bold" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Editar Día NEAT
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Actualiza los objetivos de actividad
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                isRequired
                label="Nombre del Día"
                placeholder='Ej: "Día de entrenamiento", "Lunes", "Sesión de ciclismo"'
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:tag-linear"
                    width={18}
                  />
                }
                value={cardForm.label}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, label: value })
                }
              />

              <Input
                endContent={
                  <span className="text-xs text-gray-500">pasos</span>
                }
                label="Objetivo de Pasos (Opcional)"
                placeholder="10000"
                type="number"
                value={cardForm.steps_goal}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, steps_goal: value })
                }
              />

              <Textarea
                label="Notas (Opcional)"
                minRows={3}
                placeholder="Notas adicionales..."
                value={cardForm.notes}
                onValueChange={(value) =>
                  setCardForm({ ...cardForm, notes: value })
                }
              />

              {/* Weekdays Selection */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Días de la Semana (Opcional)
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Selecciona los días de la semana en que este objetivo aplica
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => (
                    <button
                      key={dayNum}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        cardForm.weekdays.includes(dayNum)
                          ? "bg-blue-500 border-blue-600 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                      }`}
                      type="button"
                      onClick={() => handleToggleWeekday(dayNum)}
                    >
                      <div className="text-xs font-bold">
                        {getWeekdayName(dayNum, true)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseEditModal}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="primary"
              isDisabled={isSaving || !cardForm.label.trim()}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:diskette-bold" width={18} />
              }
              onPress={handleUpdateCard}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
