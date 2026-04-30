/**
 * Two-step confirmation modal for the "Apply to all clients" action.
 *
 * Step 1: explains the action ("This will reset every client to the
 *         template; per-client customizations will be lost"). User must
 *         tick a checkbox + click confirm.
 * Step 2: irreversible toast — fires the mutation and closes.
 *
 * The mutation deletes all override rows in the trainer's tenant; clients
 * fall back to the template.
 */

"use client";

import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useApplyToAll } from "@/lib/charts/hooks";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ApplyToAllConfirm({ isOpen, onClose }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<{ affected: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mut = useApplyToAll();

  const handleConfirm = async () => {
    setError(null);
    try {
      const r = await mut.mutateAsync();

      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClose = () => {
    setAcknowledged(false);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} placement="center" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Aplicar plantilla a todos los clientes</ModalHeader>
        <ModalBody>
          {result ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Icon
                className="text-emerald-500"
                icon="solar:check-circle-bold"
                width={40}
              />
              <p className="text-sm text-foreground/80">
                {result.affected === 0
                  ? "Ningún cliente tenía personalización; nada que resetear."
                  : `Se eliminaron ${result.affected} personalizaciones. Todos tus clientes ahora ven la plantilla actual.`}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 border border-warning-200">
                <Icon
                  className="text-warning-600 mt-0.5"
                  icon="solar:danger-triangle-bold"
                  width={18}
                />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Esta acción{" "}
                  <strong>elimina las gráficas personalizadas</strong> de cada
                  cliente que las tuviera. Después, todos los clientes verán la
                  plantilla actual y los próximos cambios que hagas aquí se les
                  aplicarán automáticamente.
                </p>
              </div>
              <Checkbox
                className="mt-3"
                isSelected={acknowledged}
                size="sm"
                onValueChange={setAcknowledged}
              >
                <span className="text-xs">
                  Entiendo que se perderán las personalizaciones individuales
                </span>
              </Checkbox>
              {error ? (
                <p className="text-xs text-danger mt-2">Error: {error}</p>
              ) : null}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          {result ? (
            <Button color="primary" onPress={handleClose}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="light" onPress={handleClose}>
                Cancelar
              </Button>
              <Button
                color="warning"
                isDisabled={!acknowledged || mut.isPending}
                isLoading={mut.isPending}
                onPress={handleConfirm}
              >
                Aplicar a todos
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
