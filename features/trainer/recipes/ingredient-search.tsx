"use client";

import type { FoodSearchResult, ManualIngredientInput } from "./recipe-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { ManualIngredientForm } from "./manual-ingredient-form";
import { formatKcal } from "./recipe-format";
import { useFoodSearch } from "./use-recipe";

import { largerImageUrl } from "@/lib/nutrition/food-source/image-url";

interface IngredientSearchProps {
  busy: boolean;
  onAdd: (food: FoodSearchResult) => void;
  onAddManual: (input: ManualIngredientInput) => void;
}

export function IngredientSearch({
  busy,
  onAdd,
  onAddManual,
}: IngredientSearchProps) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [preview, setPreview] = useState<FoodSearchResult | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useFoodSearch(query, brand);
  const results = data ?? [];
  const hasQuery = query.trim().length >= 2;
  const showDropdown = open && hasQuery;

  // Close the floating results when clicking/tapping outside the search area.
  useEffect(() => {
    if (open === false) return;

    const handle = (event: MouseEvent) => {
      if (
        wrapperRef.current !== null &&
        wrapperRef.current.contains(event.target as Node) === false
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handle);

    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={wrapperRef} className="relative">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="flex-1"
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
            onFocus={() => setOpen(true)}
            onValueChange={(value) => {
              setQuery(value);
              setOpen(true);
            }}
          />

          <Input
            isClearable
            className="sm:max-w-[200px]"
            placeholder="Marca (opcional)"
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:tag-linear"
                width={16}
              />
            }
            value={brand}
            variant="bordered"
            onClear={() => setBrand("")}
            onFocus={() => setOpen(true)}
            onValueChange={setBrand}
          />
        </div>

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-large border border-gray-200 bg-white p-1 shadow-lg">
            {isFetching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-default-500">
                <Spinner size="sm" />
                Buscando...
              </div>
            )}

            {isFetching === false &&
              data !== undefined &&
              results.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-default-500">
                  Sin resultados. Prueba con otro término o agrégalo
                  manualmente.
                </div>
              )}

            {results.map((food) => (
              <FoodResultRow
                key={`${food.source}:${food.sourceRef ?? food.name}`}
                busy={busy}
                food={food}
                onAdd={(value) => {
                  onAdd(value);
                  setOpen(false);
                }}
                onExpand={() => setPreview(food)}
              />
            ))}
          </div>
        )}
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
        onPress={() => setManualOpen((value) => value === false)}
      >
        {manualOpen
          ? "Cerrar entrada manual"
          : "¿No lo encuentras? Agrégalo manualmente"}
      </Button>

      {manualOpen && (
        <ManualIngredientForm busy={busy} onSubmit={onAddManual} />
      )}

      <Modal
        isOpen={preview !== null}
        size="sm"
        onClose={() => setPreview(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{preview?.name}</span>
            {preview?.brand !== undefined && (
              <span className="text-xs font-normal text-default-500">
                {preview.brand}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="items-center pb-6">
            {preview?.imageUrl !== undefined && (
              // Plain <img> (not next/image): external OFF host, not allowlisted.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={preview.name}
                className="max-h-80 w-auto rounded-lg object-contain"
                src={largerImageUrl(preview.imageUrl)}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}

interface FoodResultRowProps {
  food: FoodSearchResult;
  busy: boolean;
  onAdd: (food: FoodSearchResult) => void;
  onExpand: () => void;
}

function FoodResultRow({ food, busy, onAdd, onExpand }: FoodResultRowProps) {
  // Two SIBLING buttons (thumbnail expands, the rest adds) — nesting an
  // interactive control inside the row button is invalid and unreachable by
  // keyboard.
  return (
    <div className="group flex w-full items-center gap-3 rounded-medium px-2 py-2 transition-colors hover:bg-gray-50">
      {food.imageUrl !== undefined ? (
        // Click to expand into a larger lightbox. Plain <img> (not next/image)
        // so we don't need to allowlist the OFF image host in next.config.
        <button
          aria-label="Ampliar imagen"
          className="relative h-9 w-9 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-gray-200 disabled:opacity-50"
          disabled={busy}
          type="button"
          onClick={onExpand}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            src={food.imageUrl}
          />
        </button>
      ) : (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
          <Icon
            className="text-default-300"
            icon="solar:cup-hot-linear"
            width={16}
          />
        </span>
      )}

      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
        disabled={busy}
        type="button"
        onClick={() => onAdd(food)}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {food.name}
          </span>
          <span className="block truncate text-xs text-default-500">
            {food.brand !== undefined ? `${food.brand} · ` : ""}
            {formatKcal(food.nutrientsPer100g.kcal)} / 100g
          </span>
        </span>

        <Icon
          className="flex-shrink-0 text-default-400 transition-colors group-hover:text-gray-900"
          icon="material-symbols:add"
          width={20}
        />
      </button>
    </div>
  );
}
