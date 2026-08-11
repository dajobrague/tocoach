"use client";

// Chooser de programa activo. Se muestra al entrar a Entrenamiento cuando
// el cliente tiene MÁS de un programa activo (data heredada de cuando el
// sistema permitía varios activos a la vez). El cliente elige cuál seguir;
// el resto se pausa (accesible desde Programas → Pausados). No se puede
// cerrar sin elegir: con varios activos el plan del día es ambiguo.

import type { WorkoutProgram } from "@/types/training";

import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useActivateProgram } from "@/lib/hooks/use-client-queries";

interface ProgramChooserModalProps {
  /** Programas con status "active" (length > 1 para que esto se muestre). */
  activePrograms: WorkoutProgram[];
}

export function ProgramChooserModal({
  activePrograms,
}: ProgramChooserModalProps) {
  const activateProgram = useActivateProgram();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleChoose = (clientProgramId: string) => {
    setPendingId(clientProgramId);
    activateProgram.mutate(clientProgramId, {
      onSuccess: () => {
        addToast({
          title: "Programa activado",
          description:
            "Los demás programas quedaron en pausa. Puedes cambiar cuando quieras desde Programas.",
          color: "success",
        });
      },
      onError: (error) => {
        setPendingId(null);
        addToast({
          title: "No se pudo activar",
          description: error.message,
          color: "danger",
        });
      },
    });
  };

  return (
    <Modal
      hideCloseButton
      isKeyboardDismissDisabled
      isOpen
      isDismissable={false}
      placement="center"
      size="md"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="font-heading">¿Qué programa quieres seguir?</span>
          <span className="text-sm font-normal text-default-500 font-body">
            Tienes varios programas activos. Elige uno — los demás quedan en
            pausa y puedes retomarlos cuando quieras.
          </span>
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="space-y-2">
            {activePrograms.map((program) => (
              <Button
                key={program.clientProgramId}
                fullWidth
                className="h-auto justify-between py-3"
                isDisabled={pendingId !== null}
                isLoading={pendingId === program.clientProgramId}
                variant="bordered"
                onPress={() => handleChoose(program.clientProgramId)}
              >
                <span className="min-w-0 text-left">
                  <span className="block truncate font-semibold">
                    {program.name}
                  </span>
                  <span className="block text-xs text-default-500">
                    {program.sessions?.length ?? 0} sesiones
                  </span>
                </span>
                <Icon
                  className="shrink-0 text-default-400"
                  icon="solar:alt-arrow-right-linear"
                />
              </Button>
            ))}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
