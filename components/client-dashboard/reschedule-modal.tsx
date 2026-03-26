"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionName: string;
  currentDate: string;
  /** UUID from scheduled_sessions when a row exists; empty when template-only */
  scheduledSessionId: string;
  /** Program session ID (sessions table) - needed when creating a new scheduled_session */
  sessionId: string;
  clientId: string;
  onSuccess: () => void;
}

function getTodayStr(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function RescheduleModal({
  isOpen,
  onClose,
  sessionName,
  currentDate,
  scheduledSessionId,
  sessionId,
  clientId,
  onSuccess,
}: RescheduleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newDate, setNewDate] = useState<string>(currentDate || getTodayStr());

  const handleReschedule = async () => {
    if (!newDate || !currentDate || newDate === currentDate) {
      alert("Por favor selecciona una nueva fecha");

      return;
    }

    setIsSaving(true);
    try {
      let response: Response;
      let data: { success?: boolean; error?: string };

      if (scheduledSessionId) {
        // Update existing scheduled_session
        response = await fetch(
          `/api/clients/${clientId}/scheduled-sessions/${scheduledSessionId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledDate: newDate }),
          }
        );
        data = await response.json();
      } else if (sessionId) {
        // Create new scheduled_session for the new date
        response = await fetch(`/api/clients/${clientId}/scheduled-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            scheduledDate: newDate,
            originalPlanDate: currentDate,
            status: "scheduled",
          }),
        });
        data = await response.json();
      } else {
        alert("Error: no se puede reprogramar esta sesión");
        setIsSaving(false);

        return;
      }

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
      setNewDate(currentDate);
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

          {/* New Date Picker — native input avoids HeroUI DatePicker bug where
              day numbers like 21 or 30 cannot be typed due to premature
              segment validation against the current real-world month */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-foreground/70 font-medium">
              Nueva Fecha
            </label>
            <input
              className="w-full rounded-xl border border-default-200 bg-default-100 px-3 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          {/* Preview of selected date */}
          {newDate && currentDate && newDate !== currentDate && (
            <div className="text-sm text-default-500">
              <p className="font-medium mb-1">Nueva fecha:</p>
              <p>{formatDisplayDate(newDate)}</p>
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
              isSaving || (!!currentDate && newDate === currentDate) || !newDate
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
