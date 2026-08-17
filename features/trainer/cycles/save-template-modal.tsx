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
import { useEffect, useState } from "react";

interface SaveTemplateModalProps {
  isOpen: boolean;
  /** Cycle name, prefilled as the template's default name. */
  initialName: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => void;
}

/** Name-and-confirm step for freezing the current plan as a template. */
export function SaveTemplateModal({
  isOpen,
  initialName,
  saving,
  error,
  onClose,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  const trimmed = name.trim();

  return (
    <Modal
      isDismissable={saving === false}
      isOpen={isOpen}
      placement="center"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <Icon icon="solar:copy-linear" width={20} />
          </span>
          Guardar como plantilla
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-600">
            Guarda este plan (días, comidas, opciones y porciones) para
            reutilizarlo con otros clientes desde &quot;Nuevo plan&quot;. Los
            objetivos por día no se incluyen: son propios de cada cliente.
          </p>

          <Input
            autoFocus
            isRequired
            isDisabled={saving}
            label="Nombre de la plantilla"
            placeholder="Ej. Definición 2200 kcal"
            value={name}
            variant="bordered"
            onValueChange={setName}
          />

          {error !== null && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={saving} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={trimmed.length === 0}
            isLoading={saving}
            startContent={
              saving ? null : <Icon icon="solar:diskette-linear" width={18} />
            }
            onPress={() => {
              if (trimmed.length > 0 && saving === false) onSave(trimmed);
            }}
          >
            Guardar plantilla
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
