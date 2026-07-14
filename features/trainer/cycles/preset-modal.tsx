"use client";

import type { GoalPreset, NutritionGoals } from "./cycle-api";

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

interface PresetModalProps {
  isOpen: boolean;
  /** Preset being edited, or null when creating a new one. */
  preset: GoalPreset | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: { name: string } & NutritionGoals) => void;
}

const MACRO_FIELDS: {
  key: keyof NutritionGoals;
  label: string;
  unit: string;
}[] = [
  { key: "kcal", label: "Calorías", unit: "kcal" },
  { key: "protein_g", label: "Proteína", unit: "g" },
  { key: "carbs_g", label: "Carbohidratos", unit: "g" },
  { key: "fat_g", label: "Grasa", unit: "g" },
];

const EMPTY = { name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "" };

/** Create/edit a named objective ("Día de entrenamiento", …) for a client. */
export function PresetModal({
  isOpen,
  preset,
  saving,
  error,
  onClose,
  onSave,
}: PresetModalProps) {
  const [draft, setDraft] = useState<Record<string, string>>(EMPTY);

  useEffect(() => {
    if (isOpen) {
      setDraft(
        preset === null
          ? EMPTY
          : {
              name: preset.name,
              kcal: String(preset.kcal),
              protein_g: String(preset.protein_g),
              carbs_g: String(preset.carbs_g),
              fat_g: String(preset.fat_g),
            }
      );
    }
  }, [isOpen, preset]);

  const values: NutritionGoals = {
    kcal: Number(draft.kcal),
    protein_g: Number(draft.protein_g),
    carbs_g: Number(draft.carbs_g),
    fat_g: Number(draft.fat_g),
  };
  const name = (draft.name ?? "").trim();
  const valid =
    name.length > 0 &&
    Number.isInteger(values.kcal) &&
    values.kcal > 0 &&
    (["protein_g", "carbs_g", "fat_g"] as const).every(
      (key) => Number.isInteger(values[key]) && values[key] >= 0
    );

  const submit = () => {
    if (valid === false || saving) return;
    onSave({ name, ...values });
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
          {preset === null ? "Nuevo objetivo" : "Editar objetivo"}
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-600">
            Un objetivo con nombre (p. ej. “Día de entrenamiento”) que luego
            asignas a los días del plan.
          </p>

          <Input
            isRequired
            isDisabled={saving}
            label="Nombre del objetivo"
            placeholder="Ej. Día de entrenamiento"
            value={draft.name ?? ""}
            variant="bordered"
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, name: value }))
            }
          />

          <div className="grid grid-cols-2 gap-3">
            {MACRO_FIELDS.map((field) => (
              <Input
                key={field.key}
                endContent={
                  <span className="text-xs text-default-400">{field.unit}</span>
                }
                isDisabled={saving}
                label={field.label}
                min={0}
                type="number"
                value={draft[field.key] ?? ""}
                variant="bordered"
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, [field.key]: value }))
                }
              />
            ))}
          </div>

          {error !== null && <p className="text-sm text-danger">{error}</p>}
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
            Guardar objetivo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
