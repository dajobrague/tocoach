"use client";

import type { FoodHit, OptionIngredientEdit, SlotOption } from "./cycle-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { MultiplierField } from "./multiplier-field";
import { useFoodSearch } from "./use-cycles";

import {
  RECIPE_UNIT_LABELS,
  normalizeUnit,
} from "@/lib/nutrition/recipes/unit-conversion";

interface EditPortionsModalProps {
  /** The option being edited, or null when the modal is closed. */
  option: SlotOption | null;
  busy: boolean;
  onClose: () => void;
  onSave: (edits: OptionIngredientEdit[], trainerComment: string) => void;
}

/**
 * Per-client edit of an assigned option: re-portion the frozen snapshot's
 * lines, REMOVE lines, and ADD raw foods — all specific to this client, never
 * touching the recipe library. Reads only the option's own snapshot; the save
 * sends an explicit keep/add line list and the server freezes each added food
 * and recomputes the totals (unit-aware).
 */
export function EditPortionsModal({
  option,
  busy,
  onClose,
  onSave,
}: EditPortionsModalProps) {
  return (
    <Modal isOpen={option !== null} size="lg" onClose={onClose}>
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

/** A row of the editor: an existing snapshot line, or a food being added. */
type EditLine =
  | {
      kind: "keep";
      /** Index of the line in the option's CURRENT snapshot. */
      index: number;
      name: string;
      brand: string | null;
      unit: string;
      gramsPerUnit: number | null;
      /** The amount the modal opened with — the ×1 multiplier reference. */
      base: number;
      amount: string;
    }
  | { kind: "add"; foodId: string; name: string; amount: string };

function PortionsForm({
  option,
  busy,
  onClose,
  onSave,
}: {
  option: SlotOption;
  busy: boolean;
  onClose: () => void;
  onSave: (edits: OptionIngredientEdit[], trainerComment: string) => void;
}) {
  // Prefill from the snapshot's current lines (fresh per option via `key`).
  const [lines, setLines] = useState<EditLine[]>(() =>
    option.item_snapshot.ingredients.map((ing, index) => ({
      kind: "keep",
      index,
      name: ing.name,
      brand: ing.brand ?? null,
      unit: ing.unit,
      gramsPerUnit: ing.gramsPerUnit,
      base: Number(ing.quantity),
      amount: String(ing.quantity),
    }))
  );
  const [comment, setComment] = useState(
    () => option.item_snapshot.trainerComment ?? ""
  );
  const [foodQuery, setFoodQuery] = useState("");
  const foodsQuery = useFoodSearch(foodQuery);

  const setAmount = (row: number, value: string) =>
    setLines((prev) =>
      prev.map((line, idx) => (idx === row ? { ...line, amount: value } : line))
    );
  const removeLine = (row: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== row));
  const addFood = (hit: FoodHit) => {
    if (hit.id === undefined) return;
    const foodId = hit.id;

    setLines((prev) => [
      ...prev,
      { kind: "add", foodId, name: hit.name, amount: "100" },
    ]);
    setFoodQuery("");
  };

  // An added food with no positive amount is never a deliberate line.
  const hasInvalidAdd = lines.some(
    (line) => line.kind === "add" && Number(line.amount) > 0 === false
  );
  const canSave = busy === false && lines.length > 0 && hasInvalidAdd === false;

  const save = () => {
    if (canSave === false) return;
    onSave(
      lines.map(
        (line): OptionIngredientEdit =>
          line.kind === "keep"
            ? {
                kind: "keep",
                index: line.index,
                quantity: Number(line.amount) || 0,
              }
            : {
                kind: "add",
                ingredientId: line.foodId,
                quantity: Number(line.amount) || 0,
              }
      ),
      comment.trim()
    );
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{option.item_snapshot.name}</span>
        <span className="text-xs font-normal text-default-500">
          Alimentos y cantidades para este cliente
        </span>
      </ModalHeader>
      <ModalBody className="gap-2">
        {lines.length === 0 ? (
          <p className="rounded-large bg-warning-50 px-3 py-2 text-xs text-gray-700">
            La opción debe tener al menos un alimento. Añade uno abajo o
            cancela.
          </p>
        ) : null}

        {lines.map((line, row) => {
          const unit = line.kind === "keep" ? normalizeUnit(line.unit) : "g";
          const perPiece =
            line.kind === "keep" &&
            unit === "u" &&
            line.gramsPerUnit !== null &&
            Number.isFinite(line.gramsPerUnit)
              ? `× ${line.gramsPerUnit} g`
              : null;
          // ×1 reference is the amount the modal opened with; the multiplier
          // and the amount input stay linked both ways from there.
          const rowMultiplier =
            line.kind === "keep" && line.base > 0
              ? Math.round(((Number(line.amount) || 0) / line.base) * 100) / 100
              : null;

          return (
            <div
              key={line.kind === "keep" ? `keep-${line.index}` : `add-${row}`}
              className="flex items-center gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-900">
                  {line.name}
                  {line.kind === "add" ? (
                    <span className="ml-1.5 rounded bg-success-50 px-1 py-0.5 text-[10px] font-medium text-success-700">
                      nuevo
                    </span>
                  ) : null}
                </span>
                {line.kind === "keep" &&
                typeof line.brand === "string" &&
                line.brand.length > 0 ? (
                  <span className="block truncate text-[10px] text-default-400">
                    {line.brand}
                  </span>
                ) : null}
              </span>
              {perPiece !== null && (
                <span className="text-[10px] text-default-400 tabular-nums">
                  {perPiece}
                </span>
              )}
              {rowMultiplier !== null && line.kind === "keep" && (
                <MultiplierField
                  ariaLabel={`Multiplicador de ${line.name}`}
                  disabled={busy}
                  value={rowMultiplier}
                  onCommit={(value) =>
                    setAmount(
                      row,
                      String(Math.round(line.base * value * 100) / 100)
                    )
                  }
                />
              )}
              <Input
                aria-label={`Cantidad de ${line.name}`}
                className="w-24"
                endContent={
                  <span className="text-xs text-default-400">
                    {RECIPE_UNIT_LABELS[unit]}
                  </span>
                }
                isDisabled={busy}
                size="sm"
                type="number"
                value={line.amount}
                onValueChange={(value) => setAmount(row, value)}
              />
              <Button
                isIconOnly
                aria-label={`Quitar ${line.name}`}
                isDisabled={busy}
                size="sm"
                variant="light"
                onPress={() => removeLine(row)}
              >
                <Icon
                  className="text-default-400"
                  icon="solar:trash-bin-trash-linear"
                  width={16}
                />
              </Button>
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
          <span className="text-xs font-medium text-default-600">
            Añadir alimento
          </span>
          <Input
            isClearable
            isDisabled={busy}
            placeholder="Buscar un alimento..."
            size="sm"
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:magnifer-linear"
                width={14}
              />
            }
            value={foodQuery}
            variant="bordered"
            onClear={() => setFoodQuery("")}
            onValueChange={setFoodQuery}
          />
          {foodQuery.trim().length > 0 ? (
            foodsQuery.isLoading ? (
              <div className="flex justify-center py-3">
                <Spinner size="sm" />
              </div>
            ) : (foodsQuery.data ?? []).length === 0 ? (
              <p className="py-1 text-xs text-default-400">
                Sin resultados para esa búsqueda.
              </p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {(foodsQuery.data ?? [])
                  .filter((hit) => hit.id !== undefined)
                  .slice(0, 8)
                  .map((hit, idx) => (
                    <button
                      key={`${hit.id}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-medium border border-gray-200 px-2.5 py-1.5 text-left hover:border-gray-300 hover:bg-gray-50"
                      type="button"
                      onClick={() => addFood(hit)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">
                          {hit.name}
                        </span>
                        {hit.brand !== undefined && hit.brand.length > 0 ? (
                          <span className="block truncate text-[10px] text-default-400">
                            {hit.brand}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-default-500 tabular-nums">
                        {Math.round(Number(hit.nutrientsPer100g.kcal) || 0)}{" "}
                        kcal/100g
                      </span>
                    </button>
                  ))}
              </div>
            )
          ) : null}
        </div>

        <Textarea
          isDisabled={busy}
          label="Comentario para este cliente (opcional)"
          maxLength={2000}
          minRows={2}
          placeholder="Nota que el cliente verá junto a esta receta."
          value={comment}
          variant="bordered"
          onValueChange={setComment}
        />
      </ModalBody>
      <ModalFooter>
        <Button isDisabled={busy} variant="light" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          color="primary"
          isDisabled={canSave === false}
          isLoading={busy}
          onPress={save}
        >
          Guardar
        </Button>
      </ModalFooter>
    </>
  );
}
