"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { IconTile } from "@/components/shared/icon-tile";

interface DeleteClientModalProps {
  isOpen: boolean;
  clientName: string;
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteClientModal({
  isOpen,
  clientName,
  clientId,
  onClose,
  onSuccess,
}: DeleteClientModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isConfirmValid = confirmText === "ELIMINAR";

  const handleDelete = async () => {
    if (!isConfirmValid) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar cliente");
      }

      // Success
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Error deleting client:", err);
      setError("Error al eliminar el cliente. Por favor intente de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setConfirmText("");
      setError("");
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} size="md" onClose={handleClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <IconTile icon="solar:trash-bin-trash-bold" tone="danger" />
            <h3 className="font-heading text-xl font-bold text-foreground">
              Eliminar Cliente
            </h3>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {/* Warning Message */}
            <div className="rounded-large border border-danger/20 bg-danger/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
                <Icon
                  aria-hidden
                  className="shrink-0"
                  icon="solar:danger-triangle-bold"
                  width={18}
                />
                Esta acción no se puede deshacer
              </p>
              <p className="mb-3 text-sm text-default-600">
                Estás a punto de eliminar a{" "}
                <span className="font-semibold">{clientName}</span>. Los
                siguientes datos serán eliminados permanentemente:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs text-default-500">
                <li>Perfil del cliente y datos personales</li>
                <li>Formularios de check-ins y hábitos diarios</li>
                <li>Asignaciones de suplementos</li>
                <li>Planes de nutrición completos</li>
                <li>Tarjetas NEAT y objetivos de pasos</li>
                <li>Programas de entrenamiento y sesiones</li>
                <li>Registros de ejercicios y mediciones</li>
                <li>Mensajes y notificaciones</li>
              </ul>
            </div>

            {/* Confirmation Input */}
            <div>
              <p className="mb-2 text-sm text-default-600">
                Para confirmar, escribe{" "}
                <span className="font-semibold tracking-wide text-danger">
                  ELIMINAR
                </span>{" "}
                en el campo de abajo:
              </p>
              <Input
                autoFocus
                placeholder="Escribe ELIMINAR"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-large border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            color="danger"
            isDisabled={!isConfirmValid}
            isLoading={isLoading}
            onPress={handleDelete}
          >
            Eliminar Cliente
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
