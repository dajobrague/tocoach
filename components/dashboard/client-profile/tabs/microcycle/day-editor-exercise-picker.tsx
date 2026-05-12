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
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/exercises?limit=100`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        const json = await res.json();

        if (json.success) {
          setResults(json.exercises ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  // Debounced server-side search when the user types. Aborta el fetch
  // anterior en cada keystroke para que una respuesta vieja no pueda
  // pisar los resultados de una búsqueda más reciente (race típico de
  // "primero llega lo viejo después").
  useEffect(() => {
    const term = search.trim();

    if (!term) return;

    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term, limit: "50" });
        const res = await fetch(`/api/exercises?${params}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        const json = await res.json();

        if (json.success) setResults(json.exercises ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
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
