"use client";

import type { DayGroup } from "./cycle-api";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface AddDayModalProps {
  isOpen: boolean;
  /** Existing days, offered as copy sources. */
  days: DayGroup[];
  pending: boolean;
  onClose: () => void;
  /** `copyFromDayIndex` omitted for a blank day. */
  onConfirm: (copyFromDayIndex?: number) => void;
}

type Mode = "blank" | "copy";

export function AddDayModal({
  isOpen,
  days,
  pending,
  onClose,
  onConfirm,
}: AddDayModalProps) {
  const [mode, setMode] = useState<Mode>("blank");
  const [source, setSource] = useState<number | null>(null);

  // Reset the choice each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setMode("blank");
      setSource(null);
    }
  }, [isOpen]);

  const canSubmit = mode === "blank" || source !== null;

  const submit = () => {
    if (canSubmit === false || pending) return;
    onConfirm(mode === "copy" && source !== null ? source : undefined);
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
          Agregar día
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-500">
            El nuevo día se agrega al final del plan.
          </p>

          <div className="flex gap-2">
            <Button
              className={mode === "blank" ? "bg-black text-white" : ""}
              size="sm"
              variant={mode === "blank" ? "solid" : "bordered"}
              onPress={() => setMode("blank")}
            >
              En blanco
            </Button>
            <Button
              className={mode === "copy" ? "bg-black text-white" : ""}
              size="sm"
              variant={mode === "copy" ? "solid" : "bordered"}
              onPress={() => setMode("copy")}
            >
              Copiar desde otro día
            </Button>
          </div>

          {mode === "copy" ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-default-600">
                ¿Qué día copiar?
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {days.map((day) => {
                  const selected = source === day.dayIndex;
                  const count = day.slots.length;

                  return (
                    <button
                      key={day.dayIndex}
                      className={`flex flex-col rounded-medium border px-3 py-2 text-left transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      type="button"
                      onClick={() => setSource(day.dayIndex)}
                    >
                      <span className="text-sm font-semibold text-gray-900">
                        Día {day.dayIndex + 1}
                      </span>
                      <span className="text-xs text-default-500">
                        {count === 0
                          ? "Sin comidas"
                          : `${count} ${count === 1 ? "comida" : "comidas"}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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
                <Icon icon="solar:add-circle-linear" width={18} />
              )
            }
            onPress={submit}
          >
            Agregar día
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
