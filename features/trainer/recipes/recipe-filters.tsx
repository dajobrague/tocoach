"use client";

import type { RecipeStatus } from "./recipe-query";

import { Input, Select, SelectItem, type Selection } from "@heroui/react";
import { Icon } from "@iconify/react";

import { TagFilterSelect } from "../library/tag-filter-select";

import { statusLabel } from "./recipe-format";

const STATUS_OPTIONS: RecipeStatus[] = ["active", "draft", "archived"];

interface RecipeFiltersProps {
  query: string;
  status: string;
  /** Selected tags; a recipe must carry all of them. */
  tags: string[];
  /** Hide the status select (the folder view organizes by folder instead). */
  showStatus?: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
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
  tags,
  showStatus = true,
  onQueryChange,
  onStatusChange,
  onTagsChange,
}: RecipeFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        isClearable
        className="sm:max-w-sm"
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
        onClear={() => onQueryChange("")}
        onValueChange={onQueryChange}
      />

      {showStatus && (
        <Select
          aria-label="Filtrar por estado"
          className="sm:max-w-[200px]"
          placeholder="Todos los estados"
          selectedKeys={status.length > 0 ? [status] : []}
          startContent={
            <Icon
              className="text-default-400"
              icon="solar:filter-linear"
              width={16}
            />
          }
          variant="bordered"
          onSelectionChange={(keys) => onStatusChange(firstKey(keys))}
        >
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option}>{statusLabel(option)}</SelectItem>
          ))}
        </Select>
      )}

      <TagFilterSelect kind="recipe" value={tags} onChange={onTagsChange} />
    </div>
  );
}
