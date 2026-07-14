"use client";

import type { NutritionGoals } from "./cycle-api";

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
import { useEffect, useState } from "react";

interface GoalsModalProps {
  isOpen: boolean;
  /** Current effective targets to prefill (saved goals, or app defaults). */
  initial: NutritionGoals;
  /** True when the client already has saved goals (vs. showing defaults). */
  isCustom: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (goals: NutritionGoals) => void;
}

const FIELDS: {
  key: keyof NutritionGoals;
  label: string;
  unit: string;
}[] = [
  { key: "kcal", label: "Calorías", unit: "kcal" },
  { key: "protein_g", label: "Proteína", unit: "g" },
  { key: "carbs_g", label: "Carbohidratos", unit: "g" },
  { key: "fat_g", label: "Grasa", unit: "g" },
];

export function GoalsModal({
  isOpen,
  initial,
  isCustom,
  saving,
  onClose,
  onSave,
}: GoalsModalProps) {
  const [draft, setDraft] = useState<Record<keyof NutritionGoals, string>>({
    kcal: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  });

  // Prefill from the current targets each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setDraft({
        kcal: String(initial.kcal),
        protein_g: String(initial.protein_g),
        carbs_g: String(initial.carbs_g),
        fat_g: String(initial.fat_g),
      });
    }
  }, [isOpen, initial]);

  const values = {
    kcal: Number(draft.kcal),
    protein_g: Number(draft.protein_g),
    carbs_g: Number(draft.carbs_g),
    fat_g: Number(draft.fat_g),
  };
  const valid =
    Number.isInteger(values.kcal) &&
    values.kcal > 0 &&
    (["protein_g", "carbs_g", "fat_g"] as const).every(
      (key) => Number.isInteger(values[key]) && values[key] >= 0
    );

  const submit = () => {
    if (valid === false || saving) return;
    onSave(values);
  };

  return (
    <Modal
      isDismissable={saving === false}
      isOpen={isOpen}
      placement="center"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon icon="solar:target-linear" width={20} />
          </span>
          Metas Nutricionales
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-600">
            Objetivos diarios de este cliente. Alimentan las barras de progreso
            del plan y el resumen del día.
            {isCustom === false && (
              <span className="text-default-400">
                {" "}
                (mostrando los valores por defecto)
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <Input
                key={field.key}
                endContent={
                  <span className="text-xs text-default-400">{field.unit}</span>
                }
                isDisabled={saving}
                label={field.label}
                min={0}
                type="number"
                value={draft[field.key]}
                variant="bordered"
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, [field.key]: value }))
                }
              />
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={saving} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={valid === false}
            isLoading={saving}
            startContent={
              saving ? null : <Icon icon="solar:diskette-linear" width={18} />
            }
            onPress={submit}
          >
            Guardar metas
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
