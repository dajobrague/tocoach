// Modal "Tu microciclo" — referencia visual del microciclo armado por
// el entrenador. Sin CTA "Comenzar" (decisión extra-1 §1 de la spec).
// Si el cliente no tiene microciclo, el padre oculta el enlace que lo
// abre, así que aquí solo manejamos el estado "tiene microciclo".

import type { MicrocycleSlotView } from "@/types/training";

import { ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ClientSheet, ClientSheetGrabber } from "../client-sheet";

import { SessionTypeTile } from "./session-card";
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
    <ClientSheet isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        {(close) => (
          <>
            <ClientSheetGrabber onClose={close} />
            <ModalHeader className="flex flex-col gap-1 pt-1">
              <span className="font-heading text-[22px] leading-tight text-foreground">
                Tu microciclo
              </span>
              <p className="text-sm font-normal text-default-500">
                Esta es la guía que armó tu entrenador.
              </p>
            </ModalHeader>
            <ModalBody className="pb-6">
              <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                {slots.map((slot) => {
                  const isSession = slot.type === "session";
                  const type = slot.session?.session_type ?? null;

                  return (
                    <li
                      key={slot.day_index}
                      className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                    >
                      {isSession ? (
                        <SessionTypeTile sessionType={type} />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-default-100 text-default-500"
                        >
                          <Icon icon="solar:leaf-linear" width={22} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-default-500">
                          Día {slot.day_index}
                        </span>
                        <span className="block truncate text-[15px] font-semibold text-foreground">
                          {isSession
                            ? (slot.session?.name ?? "Sesión")
                            : "Descanso"}
                        </span>
                      </span>
                      {isSession && type ? (
                        <span
                          className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${getSessionTypeStyle(type).chipClass}`}
                        >
                          {getSessionTypeStyle(type).label}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mx-1 mt-1 text-sm text-default-500">
                Microciclo de {durationDays}{" "}
                {durationDays === 1 ? "día" : "días"}.
              </p>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </ClientSheet>
  );
}
