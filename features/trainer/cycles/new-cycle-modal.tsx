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

interface NewCycleModalProps {
  isOpen: boolean;
  pending: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    durationDays: number;
    startDate?: string;
  }) => void;
}

const DURATIONS = [7, 14, 30];

export function NewCycleModal({
  isOpen,
  pending,
  onClose,
  onCreate,
}: NewCycleModalProps) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("7");
  const [startDate, setStartDate] = useState("");

  const durationDays = Number(duration);
  const canSubmit =
    name.trim().length > 0 &&
    Number.isInteger(durationDays) &&
    durationDays > 0;

  const submit = () => {
    if (canSubmit === false || pending) return;
    onCreate({
      name: name.trim(),
      durationDays,
      ...(startDate.length > 0 ? { startDate } : {}),
    });
  };

  return (
    <Modal
      isDismissable={pending === false}
      isOpen={isOpen}
      placement="center"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-gray-700"
            icon="solar:calendar-add-linear"
            width={20}
          />
          Nuevo plan
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-500">
            Un plan agrupa varios días con sus comidas, opciones y porciones.
          </p>

          <Input
            autoFocus
            isRequired
            isDisabled={pending}
            label="Nombre del plan"
            placeholder="Ej. Definición — Fase 1"
            value={name}
            variant="bordered"
            onValueChange={setName}
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-default-600">
              Duración
            </span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((days) => (
                <Button
                  key={days}
                  className={
                    duration === String(days) ? "bg-black text-white" : ""
                  }
                  size="sm"
                  variant={duration === String(days) ? "solid" : "bordered"}
                  onPress={() => setDuration(String(days))}
                >
                  {days} días
                </Button>
              ))}
              <Input
                aria-label="Duración personalizada (días)"
                className="max-w-[7rem]"
                endContent={
                  <span className="text-xs text-default-400">días</span>
                }
                isDisabled={pending}
                min={1}
                size="sm"
                type="number"
                value={duration}
                variant="bordered"
                onValueChange={setDuration}
              />
            </div>
          </div>

          <Input
            isDisabled={pending}
            label="Fecha de inicio (opcional)"
            type="date"
            value={startDate}
            variant="bordered"
            onValueChange={setStartDate}
          />
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={pending} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={canSubmit === false}
            isLoading={pending}
            startContent={
              pending ? null : (
                <Icon icon="solar:arrow-right-linear" width={18} />
              )
            }
            onPress={submit}
          >
            Crear plan
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
