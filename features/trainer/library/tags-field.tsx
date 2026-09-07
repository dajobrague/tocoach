"use client";

import type { LibraryTagKind } from "./use-library-tags";

import { Autocomplete, AutocompleteItem, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { tagSuggestions } from "./tags";
import { useLibraryTagMutations, useLibraryTagNames } from "./use-library-tags";

import { MAX_TAG_LENGTH } from "@/lib/library/parse-tags";

interface TagsFieldProps {
  /** Which registry to suggest from and create into. */
  kind: LibraryTagKind;
  disabled: boolean;
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  description?: string;
}

/**
 * Tag editor over the tenant's registry (Sep 2 call, JC: "like
 * email-marketing tags"; Sep 7, David: tags and folders are different
 * things). Typing opens the registry's tags containing the text so trainers
 * reuse spellings; a name that does not exist yet + Enter (or a comma)
 * creates it in the registry and adds it — one action, no "create" row.
 * Folders never appear here. Shared by recipes, exercises and templates.
 */
export function TagsField({
  kind,
  disabled,
  value,
  onChange,
  label = "Etiquetas",
  placeholder = "Escribe una etiqueta...",
  description = "Escribe y pulsa Enter para añadir. Si no existe, se crea.",
}: TagsFieldProps) {
  const names = useLibraryTagNames(kind);
  const { createM } = useLibraryTagMutations(kind);
  // Both `inputValue` and `selectedKey` are controlled: letting React Aria
  // sync the text from a selection while `items` change loops forever.
  const [text, setText] = useState("");
  // Enter on a highlighted row: React Aria commits it, then our onKeyDown
  // runs in the same event — this flag keeps it from also adding the typed
  // text. Cleared on the microtask so mouse picks don't leave it set.
  const pickedRef = useRef(false);

  const add = (raw: string) => {
    const trimmed = raw.trim();

    setText("");

    if (trimmed.length === 0 || trimmed.length > MAX_TAG_LENGTH) return;
    if (value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    // Reuse the registry's spelling; otherwise register the new name (the
    // chip lands at once, the registry catches up on the response).
    const canonical = names.find(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );

    if (canonical === undefined) createM.mutate(trimmed);
    onChange([...value, canonical ?? trimmed]);
  };

  const { matches } = tagSuggestions(names, value, text);

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
        description={description}
        inputValue={text}
        isDisabled={disabled}
        items={matches.map((tag) => ({ key: tag, label: tag }))}
        label={label}
        placeholder={placeholder}
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
          add(String(key));
        }}
      >
        {(item) => (
          <AutocompleteItem
            key={item.key}
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:tag-linear"
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
