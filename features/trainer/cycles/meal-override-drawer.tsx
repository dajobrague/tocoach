"use client";

import type { OptionSelection } from "./cycle-api";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { PickerDrawer } from "./picker-drawer";

/** A recipe ingredient line the trainer can re-portion (native-unit amount). */
export interface CartIngredient {
  name: string;
  /** Frozen product brand for display; null/absent for unbranded lines. */
  brand?: string | null;
  unit: string;
  quantity: number;
}

/** One item in the meal-override cart: what to save + how to show it. */
export interface MealCartItem {
  selection: OptionSelection;
  name: string;
  /** Product brand for food items ("Hacendado"); null/absent for recipes. */
  brand?: string | null;
  image: string | null;
  /** Recipe ingredient lines — present for recipes, edited per-ingredient. */
  ingredients?: CartIngredient[];
}

/** Internal, editable form — foods edit grams, recipes edit each ingredient. */
interface EditItem {
  name: string;
  brand: string | null;
  image: string | null;
  kind: "recipe" | "food";
  refId: string;
  ingredients: {
    name: string;
    brand: string | null;
    unit: string;
    quantity: string;
  }[];
  grams: string;
}

function toEditItem(item: MealCartItem): EditItem {
  if (item.selection.kind === "recipe") {
    return {
      name: item.name,
      brand: null,
      image: item.image,
      kind: "recipe",
      refId: item.selection.recipeId,
      ingredients: (item.ingredients ?? []).map((line) => ({
        name: line.name,
        brand: line.brand ?? null,
        unit: line.unit,
        quantity: String(line.quantity),
      })),
      grams: "0",
    };
  }

  return {
    name: item.name,
    brand: item.brand ?? null,
    image: item.image,
    kind: "food",
    refId: item.selection.ingredientId,
    ingredients: [],
    grams: String(item.selection.quantity),
  };
}

function toSelection(item: EditItem): OptionSelection {
  if (item.kind === "recipe") {
    return {
      kind: "recipe",
      recipeId: item.refId,
      quantities: item.ingredients.map((line) => Number(line.quantity) || 0),
    };
  }

  return {
    kind: "food",
    ingredientId: item.refId,
    quantity: Number(item.grams) || 0,
  };
}

interface MealOverrideDrawerProps {
  isOpen: boolean;
  mealLabel: string;
  /** Preloaded items — empty for "Intercambiar", the meal's current items for
   *  "Ajustar cantidad". */
  initialItems: MealCartItem[];
  busy: boolean;
  onClose: () => void;
  onSave: (selections: OptionSelection[]) => void;
}

/**
 * Build the meal for one date: a cart of one or more items added via the shared
 * picker. A food shows a single grams field; a recipe expands into its
 * ingredients, each re-portionable. Saving replaces the meal on that date (a
 * multi-item swap override).
 */
export function MealOverrideDrawer({
  isOpen,
  mealLabel,
  initialItems,
  busy,
  onClose,
  onSave,
}: MealOverrideDrawerProps) {
  const [items, setItems] = useState<EditItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset the cart to the preloaded items each time the drawer opens.
  useEffect(() => {
    if (isOpen) setItems(initialItems.map(toEditItem));
  }, [isOpen, initialItems]);

  const removeAt = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const setIngredientQty = (index: number, ingIndex: number, value: string) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              ingredients: item.ingredients.map((line, j) =>
                j === ingIndex ? { ...line, quantity: value } : line
              ),
            }
          : item
      )
    );

  const setGrams = (index: number, value: string) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, grams: value } : item))
    );

  const validAmount = (value: string): boolean => {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0;
  };

  const canSave =
    busy === false &&
    items.length > 0 &&
    items.every((item) =>
      item.kind === "food"
        ? Number.isFinite(Number(item.grams)) && Number(item.grams) > 0
        : item.ingredients.length > 0 &&
          item.ingredients.every((line) => validAmount(line.quantity))
    );

  return (
    <>
      <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-0.5">
            <span className="text-base font-bold text-gray-900">
              Editar comida
            </span>
            <span className="text-xs font-normal text-default-500">
              {mealLabel} · solo esta fecha
            </span>
          </DrawerHeader>
          <DrawerBody className="gap-3">
            {items.length === 0 ? (
              <div className="rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center text-sm text-default-500">
                Aún no hay elementos. Agrega una receta o alimento para armar la
                comida de esta fecha.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <li
                    key={`${item.refId}-${index}`}
                    className="flex flex-col gap-2 rounded-large border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {item.image !== null ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={item.name}
                          className="h-10 w-10 shrink-0 rounded-medium border border-gray-200 object-cover"
                          loading="lazy"
                          src={item.image}
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gray-100 text-default-500">
                          <Icon icon="solar:cup-hot-linear" width={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                        {item.name}
                        {item.brand !== null && (
                          <span className="font-normal text-default-400">
                            {" · "}
                            {item.brand}
                          </span>
                        )}
                      </span>
                      {item.kind === "food" ? (
                        <Input
                          aria-label={`Gramos de ${item.name}`}
                          className="w-24 shrink-0"
                          classNames={{ inputWrapper: "h-9" }}
                          endContent={
                            <span className="text-xs text-default-400">g</span>
                          }
                          min={0}
                          size="sm"
                          type="number"
                          value={item.grams}
                          variant="bordered"
                          onValueChange={(value) => setGrams(index, value)}
                        />
                      ) : null}
                      <Button
                        isIconOnly
                        aria-label={`Quitar ${item.name}`}
                        className="shrink-0"
                        size="sm"
                        variant="light"
                        onPress={() => removeAt(index)}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={16} />
                      </Button>
                    </div>

                    {item.kind === "recipe" && item.ingredients.length > 0 ? (
                      <div className="flex flex-col gap-1.5 border-t border-gray-100 pl-1 pt-2">
                        {item.ingredients.map((line, ingIndex) => (
                          <div
                            key={`${line.name}-${ingIndex}`}
                            className="flex items-center gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-xs text-default-600">
                              {line.name}
                              {line.brand !== null && (
                                <span className="text-default-400">
                                  {" · "}
                                  {line.brand}
                                </span>
                              )}
                            </span>
                            <Input
                              aria-label={`Cantidad de ${line.name}`}
                              className="w-24 shrink-0"
                              classNames={{ inputWrapper: "h-8" }}
                              endContent={
                                <span className="text-[10px] text-default-400">
                                  {line.unit}
                                </span>
                              }
                              min={0}
                              size="sm"
                              type="number"
                              value={line.quantity}
                              variant="bordered"
                              onValueChange={(value) =>
                                setIngredientQty(index, ingIndex, value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <Button
              startContent={<Icon icon="solar:add-circle-linear" width={18} />}
              variant="bordered"
              onPress={() => setPickerOpen(true)}
            >
              Agregar receta o alimento
            </Button>
          </DrawerBody>
          <DrawerFooter>
            <Button isDisabled={busy} variant="light" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              className="bg-black text-white"
              color="primary"
              isDisabled={canSave === false}
              isLoading={busy}
              startContent={
                busy ? null : <Icon icon="solar:diskette-linear" width={18} />
              }
              onPress={() => onSave(items.map(toSelection))}
            >
              Guardar comida
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <PickerDrawer
        collectRecipePortions
        isAdding={false}
        isOpen={pickerOpen}
        mealLabel={mealLabel}
        onClose={() => setPickerOpen(false)}
        onSelect={(selection, display) => {
          setItems((prev) => [
            ...prev,
            toEditItem({
              selection,
              name: display?.name ?? "Ítem",
              image: display?.imageUrl ?? null,
              ...(display?.ingredients !== undefined
                ? { ingredients: display.ingredients }
                : {}),
            }),
          ]);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
