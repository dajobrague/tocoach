"use client";

/**
 * Editor de opciones para preguntas de tipo `choice` / `multi_choice`.
 *
 * Gestiona un array de `ChoiceOption` con:
 * - Añadir opción (hasta 10; por debajo de 2 se marca visualmente como insuficiente).
 * - Editar `label` e `icon` (el `icon` es opcional y se elige con `IconPicker`).
 * - Eliminar opción.
 *
 * IMPORTANTE — inmutabilidad del `id`:
 * El `id` se genera al crear la opción con `generateChoiceId(label, existingIds)`
 * y NO se regenera cuando el trainer renombra el `label`. Ese `id` es la clave
 * que se guarda en `form_responses.answers` y se usa en matches condicionales;
 * cambiarlo invalidaría respuestas históricas.
 */

import type { ChoiceOption } from "@/lib/forms/types";

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { IconPicker } from "@/components/ui/icon-picker";
import { generateChoiceId } from "@/lib/forms/choice-id";

interface ChoicesEditorProps {
  choices: ChoiceOption[];
  onChange: (next: ChoiceOption[]) => void;
  /**
   * Solo se usa para copy de ejemplo en el placeholder del input.
   * La diferencia funcional entre choice/multi_choice vive fuera.
   */
  multi?: boolean;
  /** Máximo de opciones permitidas. Default 10. */
  max?: number;
}

const DEFAULT_MAX = 10;

export function ChoicesEditor({
  choices,
  onChange,
  multi = false,
  max = DEFAULT_MAX,
}: ChoicesEditorProps) {
  const existingIds = useMemo(() => choices.map((c) => c.id), [choices]);
  const canAdd = choices.length < max;
  const insufficient = choices.length < 2;

  const addChoice = () => {
    if (!canAdd) return;

    const id = generateChoiceId("", existingIds);
    const next: ChoiceOption = { id, label: "" };

    onChange([...choices, next]);
  };

  const updateLabel = (index: number, label: string) => {
    onChange(
      choices.map((c, i) => {
        if (i !== index) return c;

        // id es inmutable — si el id actual es el genérico "option" o
        // "option_N" (porque se creó vacío), intentamos promocionar a uno
        // basado en el label mientras sea único.
        const isGenericId = /^option(_\d+)?$/.test(c.id);

        if (isGenericId && label.trim()) {
          const otherIds = choices
            .filter((_, j) => j !== index)
            .map((x) => x.id);

          return {
            ...c,
            id: generateChoiceId(label, otherIds),
            label,
          };
        }

        return { ...c, label };
      })
    );
  };

  const updateIcon = (index: number, icon: string) => {
    onChange(
      choices.map((c, i) => {
        if (i !== index) return c;

        // exactOptionalPropertyTypes: we can't assign `undefined` to `icon`,
        // so we strip the key when icon is empty.
        if (!icon) {
          const next: ChoiceOption = { id: c.id, label: c.label };

          return next;
        }

        return { ...c, icon };
      })
    );
  };

  const removeChoice = (index: number) => {
    onChange(choices.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-500">
          Opciones ({choices.length}/{max})
        </p>
        {insufficient && (
          <span className="text-[11px] font-semibold text-amber-600">
            Mínimo 2 opciones
          </span>
        )}
      </div>

      <div className="space-y-2">
        {choices.map((choice, index) => (
          <div
            key={choice.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
          >
            <IconPicker
              size="sm"
              value={choice.icon || "solar:circle-bold"}
              onChange={(icon) => updateIcon(index, icon)}
            />
            <Input
              classNames={{
                inputWrapper:
                  "h-9 min-h-0 bg-transparent shadow-none border-0 data-[hover=true]:bg-gray-50",
              }}
              placeholder={multi ? "Ej: Correr" : "Ej: Muy bueno"}
              size="sm"
              value={choice.label}
              variant="flat"
              onValueChange={(v) => updateLabel(index, v)}
            />
            <button
              aria-label="Eliminar opción"
              className="text-gray-300 hover:text-red-500 transition-colors p-1"
              type="button"
              onClick={() => removeChoice(index)}
            >
              <Icon icon="solar:trash-bin-2-linear" width={16} />
            </button>
          </div>
        ))}
      </div>

      <Button
        className="font-semibold w-full"
        isDisabled={!canAdd}
        size="sm"
        startContent={<Icon icon="solar:add-circle-bold" width={16} />}
        variant="flat"
        onPress={addChoice}
      >
        {canAdd ? "Agregar opción" : `Máximo ${max} opciones`}
      </Button>
    </div>
  );
}
