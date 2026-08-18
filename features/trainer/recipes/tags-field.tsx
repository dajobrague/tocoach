"use client";

import { Chip, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface TagsFieldProps {
  disabled: boolean;
  /** Distinct tags already used across the library, offered as quick-adds. */
  suggestions: string[];
  value: string[];
  onChange: (tags: string[]) => void;
}

const MAX_SUGGESTIONS = 8;

/**
 * Free-form tag editor ("verano", "sin gluten", …). Typing filters the
 * library's existing tags so trainers reuse spellings instead of creating
 * near-duplicates; Enter or coma adds whatever was typed as a new tag.
 */
export function TagsField({
  disabled,
  suggestions,
  value,
  onChange,
}: TagsFieldProps) {
  const [text, setText] = useState("");

  const has = (tag: string) =>
    value.some((existing) => existing.toLowerCase() === tag.toLowerCase());

  const add = (raw: string) => {
    const trimmed = raw.trim();

    if (trimmed.length === 0 || has(trimmed)) {
      setText("");

      return;
    }

    // Reuse the library's exact casing when the tag already exists there.
    const canonical =
      suggestions.find((tag) => tag.toLowerCase() === trimmed.toLowerCase()) ??
      trimmed;

    onChange([...value, canonical]);
    setText("");
  };

  const needle = text.trim().toLowerCase();
  const matches = suggestions
    .filter((tag) => has(tag) === false)
    .filter((tag) => needle.length === 0 || tag.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Chip
              key={tag}
              isDisabled={disabled}
              size="sm"
              variant="flat"
              onClose={() => onChange(value.filter((item) => item !== tag))}
            >
              {tag}
            </Chip>
          ))}
        </div>
      )}

      <Input
        description="Enter o coma para añadir. Sirven para buscar y filtrar recetas."
        isDisabled={disabled}
        label="Etiquetas"
        placeholder="Ej. desayuno, sin gluten, verano..."
        startContent={
          <Icon
            className="text-default-400"
            icon="solar:tag-linear"
            width={16}
          />
        }
        value={text}
        variant="bordered"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(text);
          }
        }}
        onValueChange={setText}
      />

      {matches.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-default-400">Existentes:</span>
          {matches.map((tag) => (
            <Chip
              key={tag}
              className="cursor-pointer"
              isDisabled={disabled}
              size="sm"
              variant="bordered"
              onClick={() => add(tag)}
            >
              + {tag}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
