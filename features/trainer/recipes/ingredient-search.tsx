"use client";

import type { FoodSearchResult, ManualIngredientInput } from "./recipe-api";

import { Button, Card, CardBody, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { ManualIngredientForm } from "./manual-ingredient-form";
import { formatKcal } from "./recipe-format";
import { useFoodSearch } from "./use-recipe";

interface IngredientSearchProps {
  busy: boolean;
  onAdd: (food: FoodSearchResult, quantity: number) => void;
  onAddManual: (input: ManualIngredientInput) => void;
}

export function IngredientSearch({
  busy,
  onAdd,
  onAddManual,
}: IngredientSearchProps) {
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const { data, isFetching } = useFoodSearch(query);
  const results = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar alimento (mín. 2 caracteres)..."
        startContent={
          <Icon
            className="text-default-400"
            icon="solar:magnifer-linear"
            width={18}
          />
        }
        value={query}
        variant="bordered"
        onValueChange={setQuery}
      />

      {isFetching && (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      )}

      {!isFetching &&
        data !== undefined &&
        query.trim().length >= 2 &&
        results.length === 0 && (
          <p className="text-sm text-default-500">Sin resultados.</p>
        )}

      <div className="flex flex-col gap-2">
        {results.map((food) => (
          <FoodResultRow
            key={`${food.source}:${food.sourceRef ?? food.name}`}
            busy={busy}
            food={food}
            onAdd={onAdd}
          />
        ))}
      </div>

      <Button
        className="self-start"
        size="sm"
        startContent={
          <Icon
            icon={
              manualOpen
                ? "solar:minus-square-linear"
                : "solar:add-square-linear"
            }
            width={18}
          />
        }
        variant="flat"
        onPress={() => setManualOpen((open) => open === false)}
      >
        {manualOpen
          ? "Cerrar entrada manual"
          : "¿No lo encuentras? Agrégalo manualmente"}
      </Button>

      {manualOpen && (
        <ManualIngredientForm busy={busy} onSubmit={onAddManual} />
      )}
    </div>
  );
}

interface FoodResultRowProps {
  food: FoodSearchResult;
  busy: boolean;
  onAdd: (food: FoodSearchResult, quantity: number) => void;
}

function FoodResultRow({ food, busy, onAdd }: FoodResultRowProps) {
  const [quantity, setQuantity] = useState("100");

  const add = () => {
    const parsed = Number(quantity);

    if (Number.isFinite(parsed) && parsed > 0) {
      onAdd(food, parsed);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-none">
      <CardBody className="flex flex-row items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {food.name}
          </p>
          <p className="truncate text-xs text-default-500">
            {food.brand !== undefined ? `${food.brand} · ` : ""}
            {formatKcal(food.nutrientsPer100g.kcal)} / 100g
          </p>
        </div>

        <Input
          aria-label="Cantidad en gramos"
          className="w-20"
          endContent={<span className="text-xs text-default-400">g</span>}
          isDisabled={busy}
          size="sm"
          type="number"
          value={quantity}
          variant="bordered"
          onValueChange={setQuantity}
        />

        <Button
          color="primary"
          isDisabled={busy}
          size="sm"
          startContent={<Icon icon="solar:add-circle-linear" width={18} />}
          onPress={add}
        >
          Añadir
        </Button>
      </CardBody>
    </Card>
  );
}
