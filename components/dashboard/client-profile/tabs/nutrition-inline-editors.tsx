"use client";

// Editores inline del plan nutricional (v1), extraídos de nutrition-tab.tsx
// con su MISMO markup, con una diferencia clave: el valor en curso vive en
// estado LOCAL del editor. Antes cada tecla escribía un useState del
// componente padre de 5.600 líneas y re-renderizaba el árbol completo del
// plan; ahora una tecla re-renderiza solo este mini-componente. El padre
// conserva QUÉ editor está abierto (exclusividad intacta) y recibe el valor
// terminado en onSave.

import { Button, Input, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { memo, useState } from "react";

export interface MacroFormValues {
  protein: string;
  carbs: string;
  fats: string;
  calories: string;
}

export interface RecipeFormValues {
  instructions: string;
  prep_time_minutes: string;
  cooking_time_minutes: string;
  servings: string;
  recipe_notes: string;
}

export interface IngredientFormValues {
  name: string;
  quantity: string;
  unit: string;
}

/**
 * Editor inline de nombre (día / comida / opción). Los tres sitios tienen
 * markup ligeramente distinto (wrapper, label, botones con icono vs texto);
 * el variant reproduce cada uno tal cual era.
 */
export const InlineNameEditor = memo(function InlineNameEditor({
  initialValue,
  onCancel,
  onSave,
  variant,
}: {
  initialValue: string;
  variant: "day" | "meal" | "option";
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave(value);
    if (e.key === "Escape") onCancel();
  };

  if (variant === "option") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          label="Nombre"
          size="sm"
          value={value}
          onKeyDown={handleKeyDown}
          onValueChange={setValue}
        />
        <Button
          color="success"
          size="sm"
          variant="flat"
          onPress={() => onSave(value)}
        >
          Guardar
        </Button>
        <Button size="sm" variant="flat" onPress={onCancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={
        variant === "meal"
          ? "flex items-center gap-2 flex-1"
          : "flex items-center gap-2"
      }
      onClick={(e) =>
        variant === "meal" ? e.stopPropagation() : e.preventDefault()
      }
    >
      {}
      <Input
        autoFocus
        className="max-w-xs"
        size="sm"
        value={value}
        onKeyDown={handleKeyDown}
        onValueChange={setValue}
      />
      <Button
        isIconOnly
        color="success"
        size="sm"
        variant="flat"
        onPress={() => onSave(value)}
      >
        <Icon icon="solar:check-circle-bold" width={18} />
      </Button>
      <Button isIconOnly size="sm" variant="flat" onPress={onCancel}>
        <Icon icon="solar:close-circle-bold" width={18} />
      </Button>
    </div>
  );
});

/**
 * Editor inline de macros (día / comida / opción): 4 inputs numéricos +
 * Guardar/Cancelar. Wrapper y grid varían por sitio y llegan por props para
 * conservar el markup exacto de cada uno.
 */
export const InlineMacrosEditor = memo(function InlineMacrosEditor({
  gridClassName,
  initial,
  onCancel,
  onSave,
  wrapperClassName,
}: {
  initial: MacroFormValues;
  wrapperClassName: string;
  gridClassName: string;
  onSave: (values: MacroFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className={wrapperClassName}>
      <div className={gridClassName}>
        <Input
          label="Proteína (g)"
          size="sm"
          type="number"
          value={form.protein}
          onValueChange={(value) => setForm((f) => ({ ...f, protein: value }))}
        />
        <Input
          label="Carbohidratos (g)"
          size="sm"
          type="number"
          value={form.carbs}
          onValueChange={(value) => setForm((f) => ({ ...f, carbs: value }))}
        />
        <Input
          label="Grasas (g)"
          size="sm"
          type="number"
          value={form.fats}
          onValueChange={(value) => setForm((f) => ({ ...f, fats: value }))}
        />
        <Input
          label="Calorías"
          size="sm"
          type="number"
          value={form.calories}
          onValueChange={(value) => setForm((f) => ({ ...f, calories: value }))}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          className="bg-black text-white hover:bg-slate-800"
          size="sm"
          onPress={() => onSave(form)}
        >
          Guardar
        </Button>
        <Button size="sm" variant="flat" onPress={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
});

/** Formulario de receta de una opción (instrucciones, tiempos, porciones, nota). */
export const OptionRecipeEditor = memo(function OptionRecipeEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: RecipeFormValues;
  onSave: (values: RecipeFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        label="Instrucciones"
        minRows={4}
        placeholder="Ej: 1) Pica la cebolla. 2) Sofríe a fuego medio..."
        value={form.instructions}
        onValueChange={(value) =>
          setForm((prev) => ({ ...prev, instructions: value }))
        }
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          label="Preparación (min)"
          min={0}
          placeholder="0"
          size="sm"
          type="number"
          value={form.prep_time_minutes}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, prep_time_minutes: value }))
          }
        />
        <Input
          label="Cocción (min)"
          min={0}
          placeholder="0"
          size="sm"
          type="number"
          value={form.cooking_time_minutes}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, cooking_time_minutes: value }))
          }
        />
        <Input
          label="Porciones"
          min={1}
          placeholder="1"
          size="sm"
          type="number"
          value={form.servings}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, servings: value }))
          }
        />
      </div>
      <Textarea
        label="Nota (opcional)"
        minRows={2}
        placeholder="Ej: Sustituye la mantequilla por aceite de oliva si lo prefieres."
        value={form.recipe_notes}
        onValueChange={(value) =>
          setForm((prev) => ({ ...prev, recipe_notes: value }))
        }
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="flat" onPress={onCancel}>
          Cancelar
        </Button>
        <Button
          className="bg-black text-white hover:bg-slate-800"
          size="sm"
          onPress={() => onSave(form)}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
});

/** Fila inline para añadir un ingrediente nuevo a una opción. */
export const InlineNewIngredientRow = memo(function InlineNewIngredientRow({
  onCancel,
  onSave,
}: {
  onSave: (values: IngredientFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IngredientFormValues>({
    name: "",
    quantity: "",
    unit: "",
  });

  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-200 bg-slate-50 rounded px-2">
      <Input
        autoFocus
        className="flex-1"
        placeholder="Nombre del ingrediente"
        size="sm"
        value={form.name}
        onValueChange={(value) => setForm((f) => ({ ...f, name: value }))}
      />
      <Input
        className="w-24"
        placeholder="Cantidad"
        size="sm"
        value={form.quantity}
        onValueChange={(value) => setForm((f) => ({ ...f, quantity: value }))}
      />
      <Input
        className="w-24"
        placeholder="Unidad"
        size="sm"
        value={form.unit}
        onValueChange={(value) => setForm((f) => ({ ...f, unit: value }))}
      />
      <Button
        isIconOnly
        color="success"
        size="sm"
        variant="flat"
        onPress={() => onSave(form)}
      >
        <Icon icon="solar:check-circle-bold" width={18} />
      </Button>
      <Button isIconOnly size="sm" variant="flat" onPress={onCancel}>
        <Icon icon="solar:close-circle-bold" width={18} />
      </Button>
    </div>
  );
});
