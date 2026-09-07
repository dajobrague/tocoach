"use client";

import { Select, SelectItem, type Selection } from "@heroui/react";
import { Icon } from "@iconify/react";

interface TagFilterSelectProps {
  /** Distinct tags across the library to offer as filter options. */
  options: string[];
  /** Selected tags; an item must carry all of them. */
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
  size?: "sm" | "md";
}

/** Every selected key of a HeroUI Selection set ("all" = no filter). */
function allKeys(keys: Selection): string[] {
  return keys === "all" ? [] : Array.from(keys).map(String);
}

/** Multi-select tag filter (AND). Renders nothing while there are no tags
 *  to offer, so pages without tags keep their layout. */
export function TagFilterSelect({
  options,
  value,
  onChange,
  className = "sm:max-w-[240px]",
  size = "md",
}: TagFilterSelectProps) {
  if (options.length === 0) return null;

  return (
    <Select
      aria-label="Filtrar por etiquetas"
      className={className}
      placeholder="Todas las etiquetas"
      selectedKeys={value}
      selectionMode="multiple"
      size={size}
      startContent={
        <Icon className="text-default-400" icon="solar:tag-linear" width={16} />
      }
      variant="bordered"
      onSelectionChange={(keys) => onChange(allKeys(keys))}
    >
      {options.map((option) => (
        <SelectItem key={option}>{option}</SelectItem>
      ))}
    </Select>
  );
}
