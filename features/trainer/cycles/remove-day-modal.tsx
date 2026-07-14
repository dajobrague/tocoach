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

interface RemoveDayModalProps {
  isOpen: boolean;
  /** 1-based day number shown to the trainer. */
  dayNumber: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveDayModal({
  isOpen,
  dayNumber,
  pending,
  onClose,
  onConfirm,
}: RemoveDayModalProps) {
  return (
    <Modal
      isDismissable={pending === false}
      isOpen={isOpen}
      placement="center"
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger">
            <Icon icon="solar:close-circle-linear" width={20} />
          </span>
          Quitar día
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            ¿Seguro que quieres quitar el{" "}
            <span className="font-semibold text-gray-900">Día {dayNumber}</span>
            ? La data de este día se perderá.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={pending} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            color="danger"
            isLoading={pending}
            startContent={
              pending ? null : (
                <Icon icon="solar:close-circle-linear" width={18} />
              )
            }
            onPress={onConfirm}
          >
            Quitar día
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
