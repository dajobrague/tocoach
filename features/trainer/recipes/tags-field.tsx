"use client";

import { Autocomplete, AutocompleteItem, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { tagSuggestions } from "./recipe-query";

interface TagsFieldProps {
  disabled: boolean;
  /** Distinct tags already used across the library, offered as quick-adds. */
  suggestions: string[];
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Synthetic dropdown row that creates whatever was typed. */
const CREATE_KEY = "__create__";

/**
 * Predictive tag editor (Sep 2 call, JC: "like email-marketing tags").
 * Typing opens a dropdown with every existing tag containing the text so
 * trainers reuse spellings instead of creating near-duplicates; when no
 * existing tag equals the text, the last row creates it. Enter or coma add
 * the typed text as well.
 */
export function TagsField({
  disabled,
  suggestions,
  value,
  onChange,
}: TagsFieldProps) {
  // Both `inputValue` and `selectedKey` are controlled: letting React Aria
  // sync the text from a selection while `items` change loops forever.
  const [text, setText] = useState("");
  // Enter on a highlighted row: React Aria commits it, then our onKeyDown
  // runs in the same event — this flag keeps it from also adding the typed
  // text. Cleared on the microtask so mouse picks don't leave it set.
  const pickedRef = useRef(false);

  const add = (raw: string) => {
    const trimmed = raw.trim();
    const already = value.some(
      (tag) => tag.toLowerCase() === trimmed.toLowerCase()
    );

    if (trimmed.length > 0 && already === false) {
      // Reuse the exact casing of the matching suggestion (a recipe's tag or
      // a folder's name); picking a dropdown row passes that string as-is.
      const canonical =
        suggestions.find(
          (tag) => tag.toLowerCase() === trimmed.toLowerCase()
        ) ?? trimmed;

      onChange([...value, canonical]);
    }
    setText("");
  };

  const { matches, create } = tagSuggestions(suggestions, value, text);
  const items = [
    ...matches.map((tag) => ({ key: tag, label: tag, isCreate: false })),
    ...(create === null
      ? []
      : [
          {
            key: CREATE_KEY,
            label: `Crear etiqueta «${create}»`,
            isCreate: true,
          },
        ]),
  ];

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

      <Autocomplete
        allowsCustomValue
        description="Escribe para buscar entre tus etiquetas o crear una nueva. Sirven para buscar y filtrar recetas."
        inputValue={text}
        isDisabled={disabled}
        items={items}
        label="Etiquetas"
        placeholder="Ej. desayuno, sin gluten, verano..."
        selectedKey={null}
        startContent={
          <Icon
            className="text-default-400"
            icon="solar:tag-linear"
            width={16}
          />
        }
        variant="bordered"
        onInputChange={setText}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            if (pickedRef.current === false) add(text);
          }
        }}
        onSelectionChange={(key) => {
          if (key === null) return;
          pickedRef.current = true;
          queueMicrotask(() => {
            pickedRef.current = false;
          });
          add(key === CREATE_KEY ? text : String(key));
        }}
      >
        {(item) => (
          <AutocompleteItem
            key={item.key}
            startContent={
              <Icon
                className={item.isCreate ? "text-primary" : "text-default-400"}
                icon={
                  item.isCreate ? "solar:add-circle-linear" : "solar:tag-linear"
                }
                width={15}
              />
            }
            textValue={item.label}
          >
            {item.label}
          </AutocompleteItem>
        )}
      </Autocomplete>
    </div>
  );
}
