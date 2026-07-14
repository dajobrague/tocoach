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

interface UnsavedChangesModalProps {
  isOpen: boolean;
  /** Stay on the editor. */
  onCancel: () => void;
  /** Leave, discarding unsaved edits. */
  onDiscard: () => void;
}

/** Guards navigation away from the editor when there are unsaved edits. */
export function UnsavedChangesModal({
  isOpen,
  onCancel,
  onDiscard,
}: UnsavedChangesModalProps) {
  return (
    <Modal isOpen={isOpen} placement="center" size="sm" onClose={onCancel}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <Icon icon="solar:diskette-linear" width={20} />
          </span>
          Cambios sin guardar
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            Tienes cambios sin guardar en esta receta. Si sales ahora, se
            perderán.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            Seguir editando
          </Button>
          <Button
            className="bg-danger text-white"
            color="danger"
            onPress={onDiscard}
          >
            Salir sin guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
