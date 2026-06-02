"use client";

import type { RecipeStatus } from "./recipe-query";

import { Input, Select, SelectItem, type Selection } from "@heroui/react";
import { Icon } from "@iconify/react";

import { statusLabel } from "./recipe-format";

const STATUS_OPTIONS: RecipeStatus[] = ["active", "draft", "archived"];

interface RecipeFiltersProps {
  query: string;
  status: string;
  mealType: string;
  mealTypeOptions: string[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onMealTypeChange: (value: string) => void;
}

/** Read the single selected key from a HeroUI Selection set (or ""). */
function firstKey(keys: Selection): string {
  if (keys === "all") return "";
  const first = Array.from(keys)[0];

  return first === undefined ? "" : String(first);
}

export function RecipeFilters({
  query,
  status,
  mealType,
  mealTypeOptions,
  onQueryChange,
  onStatusChange,
  onMealTypeChange,
}: RecipeFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        className="sm:max-w-xs"
        placeholder="Buscar recetas por nombre..."
        startContent={
          <Icon
            className="text-default-400"
            icon="solar:magnifer-linear"
            width={18}
          />
        }
        value={query}
        variant="bordered"
        onValueChange={onQueryChange}
      />

      <Select
        aria-label="Filtrar por estado"
        className="sm:max-w-[180px]"
        placeholder="Todos los estados"
        selectedKeys={status.length > 0 ? [status] : []}
        variant="bordered"
        onSelectionChange={(keys) => onStatusChange(firstKey(keys))}
      >
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option}>{statusLabel(option)}</SelectItem>
        ))}
      </Select>

      <Select
        aria-label="Filtrar por tipo de comida"
        className="sm:max-w-[180px]"
        isDisabled={mealTypeOptions.length === 0}
        placeholder="Todas las comidas"
        selectedKeys={mealType.length > 0 ? [mealType] : []}
        variant="bordered"
        onSelectionChange={(keys) => onMealTypeChange(firstKey(keys))}
      >
        {mealTypeOptions.map((option) => (
          <SelectItem key={option}>{option}</SelectItem>
        ))}
      </Select>
    </div>
  );
}
