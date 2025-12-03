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
import { useState } from "react";

interface SaveNutritionTemplateModalProps {
  isOpen: boolean;
  planId: string;
  planName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SaveNutritionTemplateModal({
  isOpen,
  planId,
  planName,
  onClose,
  onSuccess,
}: SaveNutritionTemplateModalProps) {
  const [templateName, setTemplateName] = useState(`Plantilla: ${planName}`);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!templateName.trim()) {
      alert("Por favor ingresa un nombre para la plantilla");

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/nutrition/plans/${planId}/save-as-template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateName }),
        }
      );

      const result = await response.json();

      if (result.success) {
        alert("¡Plantilla nutricional creada exitosamente!");
        onSuccess();
        onClose();
      } else {
        console.error("Error saving as template:", result.error);
        alert("Error al guardar como plantilla");
      }
    } catch (error) {
      console.error("Error saving as template:", error);
      alert("Error al guardar como plantilla");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} size="lg" onClose={handleClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Guardar como Plantilla
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600 mb-4">
            Esta plantilla incluirá todos los días, comidas e ingredientes del
            plan nutricional actual. Podrás usarla para crear nuevos planes
            rápidamente.
          </p>

          <Input
            isRequired
            label="Nombre de la Plantilla"
            placeholder="Ej: Plan de Definición Básico"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            color="primary"
            isLoading={isSubmitting}
            onPress={handleSubmit}
          >
            Guardar Plantilla
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
