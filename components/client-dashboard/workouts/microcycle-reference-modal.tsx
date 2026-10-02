// Modal "Tu microciclo" — referencia visual del microciclo armado por
// el entrenador. Sin CTA "Comenzar" (decisión extra-1 §1 de la spec).
// Si el cliente no tiene microciclo, el padre oculta el enlace que lo
// abre, así que aquí solo manejamos el estado "tiene microciclo".

import type { MicrocycleSlotView } from "@/types/training";

import { ModalBody, ModalContent, ModalHeader } from "@heroui/react";

import { ClientSheet } from "../client-sheet";

import { getSessionTypeStyle } from "./session-type-style";

import { IconTile } from "@/components/shared/icon-tile";

interface Props {
  isOpen: boolean;
  durationDays: number;
  slots: MicrocycleSlotView[];
  onClose: () => void;
}

export function MicrocycleReferenceModal({
  isOpen,
  durationDays,
  slots,
  onClose,
}: Props) {
  return (
    <ClientSheet isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <IconTile icon="solar:calendar-linear" size="sm" />
            <span className="text-lg font-heading font-bold text-foreground">
              Tu microciclo
            </span>
          </div>
          <p className="text-xs text-default-500">
            Esta es la guía que armó tu entrenador.
          </p>
        </ModalHeader>
        <ModalBody className="pb-6">
          <ul className="flex flex-col divide-y divide-default-100">
            {slots.map((slot) => (
              <li
                key={slot.day_index}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="w-12 shrink-0 text-sm font-semibold text-default-600">
                  Día {slot.day_index}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">
                  {slot.type === "session"
                    ? (slot.session?.name ?? "Sesión")
                    : "Descanso"}
                </span>
                {slot.type === "session" && slot.session?.session_type ? (
                  (() => {
                    const s = getSessionTypeStyle(slot.session.session_type);

                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.chipClass}`}
                      >
                        {s.label}
                      </span>
                    );
                  })()
                ) : (
                  <span className="inline-flex items-center rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-600">
                    Descanso
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-default-500">
            Microciclo de {durationDays} {durationDays === 1 ? "día" : "días"}.
          </p>
        </ModalBody>
      </ModalContent>
    </ClientSheet>
  );
}
