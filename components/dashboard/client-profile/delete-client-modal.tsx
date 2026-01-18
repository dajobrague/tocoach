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
            <div className="bg-red-50 p-2 rounded-lg">
              <Icon
                className="text-red-600 text-xl"
                icon="solar:trash-bin-trash-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Eliminar Cliente
              </h3>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {/* Warning Message */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium mb-2">
                ⚠️ Esta acción no se puede deshacer
              </p>
              <p className="text-sm text-red-700 mb-3">
                Estás a punto de eliminar a{" "}
                <span className="font-semibold">{clientName}</span>. Los
                siguientes datos serán eliminados permanentemente:
              </p>
              <ul className="text-xs text-red-600 space-y-1 ml-4 list-disc">
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
              <p className="text-sm text-gray-700 mb-2">
                Para confirmar, escribe{" "}
                <span className="font-mono font-bold text-red-600">
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
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
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
            className={
              isConfirmValid
                ? "bg-red-600 text-white"
                : "bg-gray-200 text-gray-400"
            }
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
