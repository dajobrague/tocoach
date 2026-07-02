"use client";

import type { SlotOption } from "./cycle-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useState } from "react";

import {
  RECIPE_UNIT_LABELS,
  normalizeUnit,
} from "@/lib/nutrition/recipes/unit-conversion";

interface EditPortionsModalProps {
  /** The option being re-portioned, or null when the modal is closed. */
  option: SlotOption | null;
  busy: boolean;
  onClose: () => void;
  onSave: (quantities: number[]) => void;
}

/**
 * Edit an assigned option's per-client portions. Reads the option's own frozen
 * snapshot (never the recipe library) and sends a new amount per ingredient, in
 * that ingredient's own unit (pieces for "u", grams for "g", …); the unit and
 * grams-per-piece are fixed by the recipe and not editable here. The server
 * re-applies the amounts and recomputes the totals (unit-aware).
 */
export function EditPortionsModal({
  option,
  busy,
  onClose,
  onSave,
}: EditPortionsModalProps) {
  return (
    <Modal isOpen={option !== null} size="sm" onClose={onClose}>
      <ModalContent>
        {option !== null ? (
          <PortionsForm
            key={option.id}
            busy={busy}
            option={option}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function PortionsForm({
  option,
  busy,
  onClose,
  onSave,
}: {
  option: SlotOption;
  busy: boolean;
  onClose: () => void;
  onSave: (quantities: number[]) => void;
}) {
  const ingredients = option.item_snapshot.ingredients;
  // Prefill from the snapshot's current amounts (fresh per option via `key`).
  const [amounts, setAmounts] = useState<string[]>(() =>
    ingredients.map((ing) => String(ing.quantity))
  );

  const save = () => {
    if (busy) return;
    onSave(ingredients.map((_, idx) => Number(amounts[idx]) || 0));
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{option.item_snapshot.name}</span>
        <span className="text-xs font-normal text-default-500">
          Cantidades para este cliente
        </span>
      </ModalHeader>
      <ModalBody className="gap-2">
        {ingredients.map((ing, idx) => {
          const unit = normalizeUnit(ing.unit);
          const perPiece =
            unit === "u" &&
            ing.gramsPerUnit !== null &&
            Number.isFinite(ing.gramsPerUnit)
              ? `× ${ing.gramsPerUnit} g`
              : null;

          return (
            <div key={`${idx}-${ing.name}`} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                {ing.name}
              </span>
              {perPiece !== null && (
                <span className="text-[10px] text-default-400 tabular-nums">
                  {perPiece}
                </span>
              )}
              <Input
                aria-label={`Cantidad de ${ing.name}`}
                className="w-24"
                endContent={
                  <span className="text-xs text-default-400">
                    {RECIPE_UNIT_LABELS[unit]}
                  </span>
                }
                isDisabled={busy}
                size="sm"
                type="number"
                value={amounts[idx] ?? ""}
                onValueChange={(value) =>
                  setAmounts((prev) => {
                    const next = [...prev];

                    next[idx] = value;

                    return next;
                  })
                }
              />
            </div>
          );
        })}
      </ModalBody>
      <ModalFooter>
        <Button isDisabled={busy} variant="light" onPress={onClose}>
          Cancelar
        </Button>
        <Button color="primary" isLoading={busy} onPress={save}>
          Guardar
        </Button>
      </ModalFooter>
    </>
  );
}
