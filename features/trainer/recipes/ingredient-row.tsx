"use client";

import type { RecipeIngredientItem } from "./recipe-api";

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface IngredientRowProps {
  item: RecipeIngredientItem;
  busy: boolean;
  onUpdateQuantity: (ingredientRowId: string, quantity: number) => void;
  onRemove: (ingredientRowId: string) => void;
}

export function IngredientRow({
  item,
  busy,
  onUpdateQuantity,
  onRemove,
}: IngredientRowProps) {
  const [quantity, setQuantity] = useState(String(item.quantity));

  // Keep the local field in sync when the row's quantity changes upstream.
  useEffect(() => {
    setQuantity(String(item.quantity));
  }, [item.quantity]);

  const commit = () => {
    const parsed = Number(quantity);

    if (Number.isFinite(parsed) && parsed !== item.quantity) {
      onUpdateQuantity(item.id, parsed);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
        {item.name_snapshot}
      </span>

      <Input
        aria-label={`Cantidad de ${item.name_snapshot}`}
        className="w-24"
        endContent={
          <span className="text-xs text-default-400">{item.unit}</span>
        }
        isDisabled={busy}
        size="sm"
        type="number"
        value={quantity}
        variant="bordered"
        onBlur={commit}
        onValueChange={setQuantity}
      />

      <Button
        isIconOnly
        aria-label="Eliminar ingrediente"
        color="danger"
        isDisabled={busy}
        size="sm"
        variant="light"
        onPress={() => onRemove(item.id)}
      >
        <Icon icon="solar:trash-bin-trash-linear" width={18} />
      </Button>
    </div>
  );
}
