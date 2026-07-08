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

export type DayCopyMode = "duplicate" | "copyFrom";

interface DayCopyModalProps {
  /** Open when non-null; `duplicate` picks a target, `copyFrom` picks a source. */
  mode: DayCopyMode | null;
  days: DayGroup[];
  currentDayIndex: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (sourceDayIndex: number, targetDayIndex: number) => void;
}

function mealCount(day: DayGroup): number {
  return day.slots.filter((slot) => slot.options.length > 0).length;
}

export function DayCopyModal({
  mode,
  days,
  currentDayIndex,
  pending,
  onClose,
  onConfirm,
}: DayCopyModalProps) {
  const [picked, setPicked] = useState<number | null>(null);

  // Reset the picked day whenever the modal (re)opens.
  useEffect(() => {
    if (mode !== null) setPicked(null);
  }, [mode]);

  const isDuplicate = mode === "duplicate";
  const choices = days.filter((day) => day.dayIndex !== currentDayIndex);

  // Resolve source/target from the mode. The picked day is the *other* end.
  const source = isDuplicate ? currentDayIndex : picked;
  const target = isDuplicate ? picked : currentDayIndex;

  // The target day is the one that gets replaced — warn if it has meals.
  const replacedDay =
    target !== null ? days.find((day) => day.dayIndex === target) : undefined;
  const replacedMeals = replacedDay !== undefined ? mealCount(replacedDay) : 0;

  const title = isDuplicate ? "Duplicar día" : "Copiar desde otro día";
  const subtitle = isDuplicate
    ? `Copia las comidas del Día ${currentDayIndex + 1} a otro día.`
    : `Reemplaza el Día ${currentDayIndex + 1} con las comidas de otro día.`;
  const pickerLabel = isDuplicate
    ? "¿A qué día quieres copiarlas?"
    : "¿Desde qué día quieres copiar?";

  const confirm = () => {
    if (source === null || target === null || pending) return;
    onConfirm(source, target);
  };

  return (
    <Modal
      isOpen={mode !== null}
      placement="center"
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Icon
              icon={isDuplicate ? "solar:copy-linear" : "solar:import-linear"}
              width={20}
            />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold text-gray-900">
              {title}
            </span>
            <span className="text-xs font-normal text-default-500">
              {subtitle}
            </span>
          </span>
        </ModalHeader>
        <ModalBody className="gap-3">
          <span className="text-xs font-medium text-default-600">
            {pickerLabel}
          </span>

          {choices.length === 0 ? (
            <p className="rounded-large bg-gray-50 p-3 text-sm text-default-500">
              Este plan solo tiene un día.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {choices.map((day) => {
                const meals = mealCount(day);
                const selected = picked === day.dayIndex;

                return (
                  <button
                    key={day.dayIndex}
                    className={`flex items-center justify-between rounded-large border p-3 text-left transition-all ${
                      selected
                        ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    type="button"
                    onClick={() => setPicked(day.dayIndex)}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      Día {day.dayIndex + 1}
                    </span>
                    <span className="text-xs text-default-500">
                      {meals === 0
                        ? "Sin comidas"
                        : `${meals} ${meals === 1 ? "comida" : "comidas"}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {picked !== null && replacedMeals > 0 && (
            <div className="flex gap-2 rounded-large bg-amber-50 p-3 text-xs text-amber-800">
              <Icon
                className="mt-0.5 shrink-0 text-amber-500"
                icon="solar:danger-triangle-linear"
                width={16}
              />
              <p>
                Se reemplazarán las{" "}
                <span className="font-semibold">
                  {replacedMeals} {replacedMeals === 1 ? "comida" : "comidas"}
                </span>{" "}
                del Día {(target ?? 0) + 1}. Esta acción no se puede deshacer.
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={pending} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-blue-600 text-white"
            color="primary"
            isDisabled={picked === null}
            isLoading={pending}
            onPress={confirm}
          >
            {isDuplicate ? "Duplicar" : "Copiar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
