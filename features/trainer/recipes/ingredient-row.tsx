"use client";

import type { RecipeIngredientItem } from "./recipe-api";
import type { RecipeUnit } from "@/lib/nutrition/recipes/unit-conversion";
import type { Selection } from "@heroui/react";

import { Input, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { DeleteConfirmButton } from "./delete-confirm-button";
import { enrichFoodServing } from "./recipe-api";
import { formatKcal } from "./recipe-format";

import {
  isRecipeUnit,
  RECIPE_UNIT_LABELS,
  RECIPE_UNITS,
  toGrams,
} from "@/lib/nutrition/recipes/unit-conversion";

/** Sensible default grams-per-piece when a line first switches to "u". */
const DEFAULT_GRAMS_PER_UNIT = 100;

export interface IngredientPatch {
  ingredientRowId: string;
  quantity?: number;
  unit?: string;
  gramsPerUnit?: number | null;
  /** Trainer-corrected per-100g macros (external APIs are imprecise). */
  nutrientsPer100g?: Record<string, number>;
}

/** The per-100g fields a trainer can correct inline. */
const MACRO_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "kcal", label: "Calorías", unit: "kcal" },
  { key: "protein_g", label: "Proteína", unit: "g" },
  { key: "carbs_g", label: "Carbos", unit: "g" },
  { key: "fat_g", label: "Grasa", unit: "g" },
];

interface IngredientRowProps {
  item: RecipeIngredientItem;
  busy: boolean;
  onRemove: (ingredientRowId: string) => void;
  onUpdate: (patch: IngredientPatch) => void;
  /** Drag-handle attributes/listeners from the sortable wrapper, if reorderable. */
  dragHandleProps?: Record<string, unknown>;
}

/** Read the single selected key from a HeroUI Selection set. */
function firstKey(keys: Selection): string {
  if (keys === "all") return "";

  return (Array.from(keys)[0] as string | undefined) ?? "";
}

/** Parse a numeric input string; empty/garbage → null (caller decides). */
function parseNum(value: string): number | null {
  if (value.trim().length === 0) return null;
  const n = Number(value);

  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function IngredientRow({
  item,
  busy,
  onRemove,
  onUpdate,
  dragHandleProps,
}: IngredientRowProps) {
  const unit: RecipeUnit = isRecipeUnit(item.unit) ? item.unit : "g";
  const isPiece = unit === "u";

  // Local, editable copies so typing stays smooth; committed on blur / change.
  const [qty, setQty] = useState(String(item.quantity));
  const [gpu, setGpu] = useState(
    item.grams_per_unit !== null ? String(item.grams_per_unit) : ""
  );
  // Live draft mirror so async callbacks never act on a stale value.
  const gpuRef = useRef(gpu);

  gpuRef.current = gpu;
  // Per-100g macro corrections: expanded editor with its own draft values.
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [macroDraft, setMacroDraft] = useState<Record<string, string>>({});

  // Re-seed when the server row changes (after a mutation settles).
  useEffect(() => {
    setQty(String(item.quantity));
    setGpu(item.grams_per_unit !== null ? String(item.grams_per_unit) : "");
  }, [item.quantity, item.grams_per_unit]);

  const openMacros = () => {
    const draft: Record<string, string> = {};

    for (const field of MACRO_FIELDS) {
      draft[field.key] = String(item.nutrient_snapshot?.[field.key] ?? 0);
    }
    setMacroDraft(draft);
    setMacrosOpen(true);
  };

  const commitMacro = (key: string) => {
    const parsed = parseNum(macroDraft[key] ?? "");
    const current = item.nutrient_snapshot?.[key] ?? 0;

    if (parsed === null) {
      setMacroDraft((prev) => ({ ...prev, [key]: String(current) }));

      return;
    }
    if (parsed !== current) {
      // Rebuild the four editable macros from the DRAFT (two quick edits in a
      // row would otherwise lose the first via a stale props snapshot), and
      // keep the non-editable keys (fibra, azúcar…) from the frozen snapshot.
      const edited: Record<string, number> = {};

      for (const field of MACRO_FIELDS) {
        const value =
          field.key === key ? parsed : parseNum(macroDraft[field.key] ?? "");

        edited[field.key] = value ?? item.nutrient_snapshot?.[field.key] ?? 0;
      }

      onUpdate({
        ingredientRowId: item.id,
        nutrientsPer100g: { ...item.nutrient_snapshot, ...edited },
      });
    }
  };

  const brand =
    item.brand !== null && item.brand.length > 0 ? item.brand : null;
  const kcalPer100 = item.nutrient_snapshot?.kcal;
  // Use the normalized unit so the kcal math matches the unit shown in the UI.
  const grams = toGrams(item.quantity, unit, item.grams_per_unit);
  const lineKcal =
    kcalPer100 !== undefined ? (kcalPer100 * grams) / 100 : undefined;

  const commitQty = () => {
    const parsed = parseNum(qty);

    if (parsed === null) {
      setQty(String(item.quantity)); // revert invalid input

      return;
    }
    if (parsed !== item.quantity) {
      onUpdate({ ingredientRowId: item.id, quantity: parsed });
    }
  };

  const commitGpu = () => {
    const parsed = parseNum(gpu);

    if (parsed === null) {
      setGpu(item.grams_per_unit !== null ? String(item.grams_per_unit) : "");

      return;
    }
    if (parsed !== item.grams_per_unit) {
      onUpdate({ ingredientRowId: item.id, gramsPerUnit: parsed });
    }
  };

  const changeUnit = (next: string) => {
    if (isRecipeUnit(next) === false || next === unit) return;
    // Switching to pieces seeds a grams-per-piece; leaving it clears the value.
    const patch: IngredientPatch = { ingredientRowId: item.id, unit: next };

    if (next === "u") {
      patch.gramsPerUnit = item.grams_per_unit ?? DEFAULT_GRAMS_PER_UNIT;
    } else if (item.grams_per_unit !== null) {
      patch.gramsPerUnit = null;
    }
    onUpdate(patch);

    // The product's real serving weight beats the generic 100 g seed. It's
    // hydrated lazily from OFF (cached server-side); the follow-up patch only
    // lands while the seeded default is still untouched, so a trainer edit in
    // between always wins.
    if (
      next === "u" &&
      item.grams_per_unit === null &&
      item.ingredient_id !== null
    ) {
      enrichFoodServing(item.ingredient_id)
        .then((serving) => {
          const weight = serving.servingQuantity;
          // Only land while the seeded default is still untouched (the ref
          // reads the live draft, not this closure's stale copy).
          const untouched =
            gpuRef.current === "" ||
            gpuRef.current === String(DEFAULT_GRAMS_PER_UNIT);

          if (
            weight === undefined ||
            weight <= 0 ||
            weight === DEFAULT_GRAMS_PER_UNIT ||
            untouched === false
          ) {
            return;
          }

          setGpu(String(weight));
          onUpdate({ ingredientRowId: item.id, gramsPerUnit: weight });
        })
        .catch(() => {
          // Best-effort: the 100 g seed stays if OFF has nothing.
        });
    }
  };

  return (
    <div className="flex flex-col rounded-medium px-2 py-2 transition-colors hover:bg-gray-50">
      <div className="flex items-center gap-3">
        {dragHandleProps !== undefined && (
          <button
            aria-label="Reordenar ingrediente"
            className="flex-shrink-0 cursor-grab touch-none text-default-300 hover:text-default-500 active:cursor-grabbing"
            type="button"
            {...dragHandleProps}
          >
            <Icon icon="solar:hamburger-menu-linear" width={18} />
          </button>
        )}

        {item.image_url !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-10 w-10 flex-shrink-0 rounded-medium border border-gray-200 object-cover"
            loading="lazy"
            src={item.image_url}
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
            <Icon
              className="text-default-300"
              icon="solar:cup-hot-linear"
              width={18}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {item.name_snapshot}
          </p>
          <p className="truncate text-xs text-default-500">
            {[
              brand,
              kcalPer100 !== undefined
                ? `${formatKcal(kcalPer100)} / 100g`
                : null,
              lineKcal !== undefined ? `≈ ${formatKcal(lineKcal)}` : null,
            ]
              .filter((part): part is string => part !== null)
              .join(" · ")}
          </p>
        </div>

        <Input
          aria-label="Cantidad"
          className="w-20 flex-shrink-0"
          classNames={{
            inputWrapper: "!h-9 !min-h-9",
            input: "text-right tabular-nums",
          }}
          inputMode="decimal"
          isDisabled={busy}
          size="sm"
          type="text"
          value={qty}
          variant="bordered"
          onBlur={commitQty}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onValueChange={setQty}
        />

        <Select
          disallowEmptySelection
          aria-label="Unidad"
          className="w-[68px] flex-shrink-0"
          classNames={{ trigger: "!h-9 !min-h-9" }}
          isDisabled={busy}
          selectedKeys={[unit]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => changeUnit(firstKey(keys))}
        >
          {RECIPE_UNITS.map((u) => (
            <SelectItem key={u}>{RECIPE_UNIT_LABELS[u]}</SelectItem>
          ))}
        </Select>

        {isPiece && (
          <Input
            aria-label="Gramos por pieza"
            className="w-[92px] flex-shrink-0"
            classNames={{
              inputWrapper: "h-9 min-h-9",
              input: "text-right tabular-nums",
            }}
            endContent={<span className="text-xs text-default-400">g/u</span>}
            inputMode="decimal"
            isDisabled={busy}
            size="sm"
            type="text"
            value={gpu}
            variant="bordered"
            onBlur={commitGpu}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onValueChange={setGpu}
          />
        )}

        <button
          aria-label={`Corregir macros de ${item.name_snapshot}`}
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-medium transition-colors ${
            macrosOpen
              ? "bg-emerald-50 text-emerald-600"
              : "text-default-400 hover:bg-gray-100 hover:text-default-600"
          }`}
          title="Corregir macros (por 100 g)"
          type="button"
          onClick={() => (macrosOpen ? setMacrosOpen(false) : openMacros())}
        >
          <Icon icon="solar:tuning-2-linear" width={16} />
        </button>

        <DeleteConfirmButton
          ariaLabel="Eliminar ingrediente"
          className="flex-shrink-0"
          isDisabled={busy}
          message={`¿Eliminar "${item.name_snapshot}" de la receta?`}
          onConfirm={() => onRemove(item.id)}
        />
      </div>

      {macrosOpen && (
        <div className="ml-11 mt-2 flex flex-col gap-2 rounded-medium border border-gray-200 bg-gray-50/60 p-3">
          <p className="text-xs text-default-500">
            Valores por <span className="font-medium">100 g</span>. Vienen de
            una base externa y pueden no ser exactos — corrígelos si es
            necesario (la cantidad no cambia).
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MACRO_FIELDS.map((field) => (
              <Input
                key={field.key}
                aria-label={`${field.label} por 100 g`}
                classNames={{
                  inputWrapper: "!h-9 !min-h-9 bg-white",
                  input: "text-right tabular-nums",
                }}
                endContent={
                  <span className="text-[10px] text-default-400">
                    {field.unit}
                  </span>
                }
                inputMode="decimal"
                isDisabled={busy}
                label={field.label}
                labelPlacement="outside"
                size="sm"
                type="text"
                value={macroDraft[field.key] ?? ""}
                variant="bordered"
                onBlur={() => commitMacro(field.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                onValueChange={(value) =>
                  setMacroDraft((prev) => ({ ...prev, [field.key]: value }))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
