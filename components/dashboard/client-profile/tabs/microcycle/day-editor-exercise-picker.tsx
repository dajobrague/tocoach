"use client";

import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface LibraryExercise {
  id: string;
  name: string;
  category: string;
}

interface Props {
  onPick: (exercise: LibraryExercise) => void;
  disabled?: boolean;
}

export function DayEditorExercisePicker({ onPick, disabled = false }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial browse list (capped) so the dropdown opens with content.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/exercises?limit=100`);
        const json = await res.json();

        if (!cancelled && json.success) {
          setResults(json.exercises ?? []);
        }
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced server-side search when the user types.
  useEffect(() => {
    const term = search.trim();

    if (!term) return;

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term, limit: "50" });
        const res = await fetch(`/api/exercises?${params}`);
        const json = await res.json();

        if (json.success) setResults(json.exercises ?? []);
      } catch {
        /* leave previous results */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [search]);

  return (
    <Autocomplete
      aria-label="Añadir ejercicio"
      className="w-full"
      defaultItems={results}
      inputValue={search}
      isDisabled={disabled}
      isLoading={loading}
      placeholder="Añadir ejercicio…"
      size="sm"
      startContent={<Icon icon="solar:add-circle-linear" width={16} />}
      onInputChange={setSearch}
      onSelectionChange={(key) => {
        if (typeof key !== "string") return;
        const ex = results.find((e) => e.id === key);

        if (ex) {
          onPick(ex);
          setSearch("");
        }
      }}
    >
      {(item) => (
        <AutocompleteItem key={item.id} textValue={item.name}>
          {item.name}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
