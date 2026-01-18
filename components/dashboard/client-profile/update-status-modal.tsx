"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface UpdateStatusModalProps {
  isOpen: boolean;
  clientName: string;
  clientId: string;
  currentStatus: string;
  onClose: () => void;
  onSuccess: () => void;
}

const statusOptions = [
  { value: "Activo", label: "Activo" },
  { value: "Onboarding Completado", label: "Onboarding Completado" },
  {
    value: "Programación Inicial Pendiente",
    label: "Programación Inicial Pendiente",
  },
  { value: "Inactivo", label: "Inactivo" },
];

export default function UpdateStatusModal({
  isOpen,
  clientName,
  clientId,
  currentStatus,
  onClose,
  onSuccess,
}: UpdateStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Update selected status when current status changes
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
    }
  }, [isOpen, currentStatus]);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      handleClose();

      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // First, fetch the current client data
      const getResponse = await fetch(`/api/clients/${clientId}/profile`);

      if (!getResponse.ok) {
        throw new Error("Error al obtener datos del cliente");
      }
      const clientData = await getResponse.json();

      // Now update with all the data plus the new status
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          nickName: clientData.nickName || "",
          email: clientData.email,
          phone: clientData.phone || "",
          occupation: clientData.occupation || "",
          dob: clientData.dob || "",
          city: clientData.location?.city || "",
          state: clientData.location?.state || "",
          country: clientData.location?.country || "",
          zip: clientData.location?.zip || "",
          nationalId: clientData.nationalId || "",
          status: selectedStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar estado");
      }

      // Success
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Error al actualizar el estado. Por favor intente de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError("");
      setSelectedStatus(currentStatus);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} size="md" onClose={handleClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon
                className="text-blue-600 text-xl"
                icon="solar:refresh-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Actualizar Estado
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Cliente: {clientName}
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Select
              label="Estado del Cliente"
              placeholder="Seleccionar estado"
              selectedKeys={selectedStatus ? [selectedStatus] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;

                setSelectedStatus(value || currentStatus);
              }}
            >
              {statusOptions.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>

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
            className="bg-blue-600 text-white"
            isLoading={isLoading}
            onPress={handleUpdate}
          >
            Actualizar Estado
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
