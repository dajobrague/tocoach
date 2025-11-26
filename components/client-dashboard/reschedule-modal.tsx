"use client";

import {
  Button,
  DatePicker,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { parseDate } from "@internationalized/date";
import { useEffect, useState } from "react";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionName: string;
  currentDate: string;
  scheduledSessionId: string;
  clientId: string;
  onSuccess: () => void;
}

export function RescheduleModal({
  isOpen,
  onClose,
  sessionName,
  currentDate,
  scheduledSessionId,
  clientId,
  onSuccess,
}: RescheduleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    // Only parse if we have a valid date, otherwise use today
    if (currentDate && currentDate !== "") {
      try {
        return parseDate(currentDate);
      } catch (e) {
        // Fallback to today if parsing fails
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        return parseDate(`${year}-${month}-${day}`);
      }
    }
    // Default to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return parseDate(`${year}-${month}-${day}`);
  });

  const handleReschedule = async () => {
    const newDateStr = newDate.toString();

    if (!newDateStr || !currentDate || newDateStr === currentDate) {
      alert("Por favor selecciona una nueva fecha");

      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/scheduled-sessions/${scheduledSessionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledDate: newDateStr,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        alert("Error al reprogramar: " + (data.error || "Error desconocido"));
      }
    } catch (err) {
      console.error("[RescheduleModal] Error rescheduling:", err);
      alert("Error al reprogramar sesión");
    } finally {
      setIsSaving(false);
    }
  };

  // Update date when modal opens with new data
  useEffect(() => {
    if (isOpen && currentDate && currentDate !== "") {
      try {
        setNewDate(parseDate(currentDate));
      } catch (e) {
        console.error("[RescheduleModal] Error parsing date:", e);
      }
    }
  }, [isOpen, currentDate]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || dateStr === "") return "Fecha no disponible";
    try {
      const date = new Date(dateStr + "T00:00:00");

      return date.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return "Fecha no disponible";
    }
  };

  return (
    <Modal isOpen={isOpen} placement="center" size="lg" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-3">
            <Icon
              className="text-default-400"
              icon="solar:calendar-mark-bold"
              width={24}
            />
            <div>
              <h3 className="text-lg font-semibold">Reprogramar Sesión</h3>
              <p className="text-sm text-default-500">{sessionName}</p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody className="gap-4">
          {/* Current Date Display */}
          <div className="text-sm">
            <p className="text-default-500 mb-1">Fecha actual:</p>
            <p className="font-medium">{formatDisplayDate(currentDate)}</p>
          </div>

          {/* New Date Picker */}
          <DatePicker
            isRequired
            showMonthAndYearPickers
            calendarProps={{
              color: "foreground",
            }}
            className="w-full"
            description="Selecciona cualquier fecha sin restricciones"
            label="Nueva Fecha"
            value={newDate}
            variant="flat"
            onChange={(value) => value && setNewDate(value)}
          />

          {/* Info Alert */}
          {newDate && currentDate && newDate.toString() !== currentDate && (
            <div className="text-sm text-default-500">
              <p className="font-medium mb-1">Nueva fecha:</p>
              <p>{formatDisplayDate(newDate.toString())}</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={isSaving} variant="flat" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={
              isSaving || (!!currentDate && newDate.toString() === currentDate)
            }
            isLoading={isSaving}
            onPress={handleReschedule}
          >
            Reprogramar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
