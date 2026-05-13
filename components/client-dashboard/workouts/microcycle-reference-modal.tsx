// Modal "Tu microciclo" — referencia visual del microciclo armado por
// el entrenador. Sin CTA "Comenzar" (decisión extra-1 §1 de la spec).
// Si el cliente no tiene microciclo, el padre oculta el enlace que lo
// abre, así que aquí solo manejamos el estado "tiene microciclo".

import type { MicrocycleSlotView } from "@/types/training";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

import { getSessionTypeStyle } from "./session-type-style";

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
    <Modal isOpen={isOpen} placement="center" size="md" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon
              className="text-primary"
              icon="solar:calendar-bold"
              width={22}
            />
            <span className="text-lg font-heading font-bold text-foreground">
              Tu microciclo
            </span>
          </div>
          <p className="text-xs font-body text-foreground/60">
            Esta es la guía que armó tu entrenador.
          </p>
        </ModalHeader>
        <ModalBody className="pb-6">
          <ul className="flex flex-col gap-2">
            {slots.map((slot) => (
              <li
                key={slot.day_index}
                className="flex items-center gap-3 rounded-md border border-default-200 bg-content1 px-3 py-2"
              >
                <span className="w-12 shrink-0 text-sm font-semibold text-foreground/70">
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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-body font-medium ${s.chipClass}`}
                      >
                        {s.label}
                      </span>
                    );
                  })()
                ) : (
                  <span className="inline-flex items-center rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-body font-medium text-foreground/70 border border-default-200/60">
                    Descanso
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground/50 mt-2">
            Microciclo de {durationDays} {durationDays === 1 ? "día" : "días"}.
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
