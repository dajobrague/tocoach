"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface AddSupplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSupplementModal({
  isOpen,
  onClose,
  onSuccess,
}: AddSupplementModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name || !formData.unit || !formData.quantity) {
      alert("Por favor completa todos los campos requeridos");

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/supplements/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: parseFloat(formData.quantity),
          images: [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating supplement:", error);
      alert("Error al crear suplemento. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", description: "", quantity: "", unit: "" });
    onClose();
  };

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon className="text-blue-600 text-xl" icon="solar:box-linear" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Añadir Suplemento al Inventario
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Completa la información del producto
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-blue-600"
                  icon="solar:box-linear"
                  width={18}
                />
                Información del Producto
              </h4>
              <div className="space-y-4">
                <Input
                  isRequired
                  label="Nombre del Producto"
                  placeholder="Ej: Creatina Monohidrato"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:health-bold"
                      width={18}
                    />
                  }
                  value={formData.name}
                  onValueChange={(value) =>
                    setFormData({ ...formData, name: value })
                  }
                />
                <Textarea
                  label="Descripción"
                  minRows={3}
                  placeholder="Describe el producto, marca, beneficios..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:notes-linear"
                      width={18}
                    />
                  }
                  value={formData.description}
                  onValueChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Cantidad por Unidad"
                    placeholder="Ej: 100, 1.5, 500..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:scale-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={formData.quantity}
                    onValueChange={(value) =>
                      setFormData({ ...formData, quantity: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Unidad"
                    placeholder="Ej: cápsulas, kg, ml..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:ruler-angular-linear"
                        width={18}
                      />
                    }
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border border-blue-100">
              <CardBody className="p-4">
                <div className="flex items-start gap-2">
                  <Icon
                    className="text-blue-600 mt-0.5 flex-shrink-0"
                    icon="solar:info-circle-bold"
                    width={18}
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Consejo
                    </p>
                    <p className="text-sm text-blue-700">
                      Añade información detallada del producto para que sea más
                      fácil identificarlo al asignarlo a clientes.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={isSubmitting}
            variant="light"
            onPress={handleClose}
          >
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isLoading={isSubmitting}
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
            onPress={handleSubmit}
          >
            Añadir al Inventario
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
