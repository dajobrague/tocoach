"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import {
  CLIENT_STATUS_OPTIONS,
  ClientStatusTone,
  clientStatusTone,
} from "@/lib/constants/client-status";

const DOT: Record<ClientStatusTone, string> = {
  success: "bg-success",
  default: "bg-default-400",
};

interface ClientStatusDropdownProps {
  clientId: string | number;
  status: string;
  /** Se llama solo cuando el servidor ya ha guardado el nuevo estado. */
  onChange: (status: string) => void;
}

/** El tag de estado ES el control: un chip con chevron que despliega los
 *  estados y guarda al elegir. Antes el cambio vivía tras «⋯ › Cambiar
 *  estado» dentro de la ficha plegada y los entrenadores no lo encontraban. */
export function ClientStatusDropdown({
  clientId,
  status,
  onChange,
}: ClientStatusDropdownProps) {
  const [saving, setSaving] = useState(false);
  // Pasar a Inactivo pide confirmación (JC, 15 sep): el cliente deja de
  // poder iniciar sesión y un clic por error en el chip no avisaba.
  const [confirmInactive, setConfirmInactive] = useState(false);

  const change = async (next: string) => {
    if (next === status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChange(next);
      addToast({
        title: "Estado actualizado",
        description: next,
        color: "success",
      });
    } catch (err) {
      console.error("[ClientStatusDropdown] PATCH failed:", err);
      addToast({
        title: "No se pudo cambiar el estado",
        description: "Inténtalo de nuevo.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dropdown placement="bottom-start">
        <DropdownTrigger>
          {/* Tamaño de Chip sm (24px, mínimo WCAG 2.5.8). globals.css impone
            44px a todo <button> sin capa, así que sólo el `!` lo rebaja. */}
          <Button
            aria-label={`Estado: ${status}. Cambiar estado`}
            className="h-6 min-h-0! min-w-0! shrink-0 gap-1 px-2 text-tiny font-medium"
            color={clientStatusTone(status)}
            endContent={
              <Icon aria-hidden icon="solar:alt-arrow-down-linear" width={12} />
            }
            isLoading={saving}
            radius="full"
            size="sm"
            spinner={
              <Icon
                aria-hidden
                className="animate-spin"
                icon="solar:refresh-linear"
                width={12}
              />
            }
            variant="flat"
          >
            {status}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          aria-label="Cambiar estado del cliente"
          selectedKeys={[status]}
          selectionMode="single"
          onAction={(key) => {
            const next = String(key);

            if (next === "Inactivo" && status !== "Inactivo") {
              setConfirmInactive(true);
            } else {
              void change(next);
            }
          }}
        >
          {CLIENT_STATUS_OPTIONS.map((option) => (
            <DropdownItem
              key={option}
              startContent={
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${DOT[clientStatusTone(option)]}`}
                />
              }
            >
              {option}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
      <Modal
        isOpen={confirmInactive}
        placement="center"
        size="sm"
        onClose={() => setConfirmInactive(false)}
      >
        <ModalContent>
          <ModalHeader>¿Marcar como inactivo?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              El cliente no podrá iniciar sesión en la app hasta que lo vuelvas
              a marcar como activo. Sus datos no se borran.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setConfirmInactive(false)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              onPress={() => {
                setConfirmInactive(false);
                void change("Inactivo");
              }}
            >
              Marcar inactivo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
