"use client";

import type { ManualIngredientInput } from "./recipe-api";

import { Button, Input } from "@heroui/react";
import { useState } from "react";

interface NutrientField {
  key: string;
  label: string;
}

const NUTRIENT_FIELDS: NutrientField[] = [
  { key: "kcal", label: "Calorías" },
  { key: "protein_g", label: "Proteína (g)" },
  { key: "carbs_g", label: "Carbohidratos (g)" },
  { key: "fat_g", label: "Grasa (g)" },
  { key: "sugar_g", label: "Azúcar (g)" },
  { key: "fiber_g", label: "Fibra (g)" },
  { key: "sat_fat_g", label: "Grasa saturada (g)" },
  { key: "sodium_mg", label: "Sodio (mg)" },
];

function emptyNutrients(): Record<string, string> {
  const out: Record<string, string> = {};

  for (const field of NUTRIENT_FIELDS) {
    out[field.key] = "";
  }

  return out;
}

interface ManualIngredientFormProps {
  busy: boolean;
  onSubmit: (input: ManualIngredientInput) => void;
}

export function ManualIngredientForm({
  busy,
  onSubmit,
}: ManualIngredientFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [nutrients, setNutrients] =
    useState<Record<string, string>>(emptyNutrients());

  const parsedQuantity = Number(quantity);
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0;

  const reset = () => {
    setName("");
    setQuantity("100");
    setNutrients(emptyNutrients());
  };

  const submit = () => {
    if (canSubmit === false) return;

    // Per-100g values are coerced (and defaulted to 0) by buildAddManualPayload.
    onSubmit({ name, quantity: parsedQuantity, nutrients });
    reset();
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-medium border border-gray-200 p-3"
      data-testid="manual-ingredient-form"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          isRequired
          className="sm:flex-1"
          isDisabled={busy}
          label="Nombre"
          size="sm"
          value={name}
          variant="bordered"
          onValueChange={setName}
        />
        <Input
          isRequired
          className="sm:max-w-[140px]"
          endContent={<span className="text-xs text-default-400">g</span>}
          isDisabled={busy}
          label="Cantidad"
          size="sm"
          type="number"
          value={quantity}
          variant="bordered"
          onValueChange={setQuantity}
        />
      </div>

      <p className="text-xs text-default-500">
        Valores por 100 g (opcionales, por defecto 0).
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NUTRIENT_FIELDS.map((field) => (
          <Input
            key={field.key}
            isDisabled={busy}
            label={field.label}
            size="sm"
            type="number"
            value={nutrients[field.key] ?? ""}
            variant="bordered"
            onValueChange={(value) =>
              setNutrients((prev) => ({ ...prev, [field.key]: value }))
            }
          />
        ))}
      </div>

      <Button
        className="self-start"
        color="primary"
        isDisabled={canSubmit === false || busy}
        size="sm"
        onPress={submit}
      >
        Añadir ingrediente manual
      </Button>
    </div>
  );
}
