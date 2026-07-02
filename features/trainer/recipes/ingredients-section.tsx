"use client";

import type { IngredientPatch } from "./ingredient-row";
import type { RecipeIngredientItem } from "./recipe-api";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { type ReactNode } from "react";

import { IngredientRow } from "./ingredient-row";
import { IngredientSearch } from "./ingredient-search";
import { draftFromFood, draftFromManual } from "./recipe-draft";

/** Sortable wrapper: owns the dnd transform and hands the row its drag handle. */
function SortableIngredient({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

interface IngredientsSectionProps {
  /** The buffered ingredient list (draft); edits are local until the form saves. */
  ingredients: RecipeIngredientItem[];
  onChange: (next: RecipeIngredientItem[]) => void;
  disabled?: boolean;
}

/**
 * The recipe editor's "Ingredientes" card, fully controlled: every add / edit /
 * remove / reorder mutates the draft list via `onChange`. Nothing is persisted
 * here — the parent form commits the whole list on "Guardar".
 */
export function IngredientsSection({
  ingredients,
  onChange,
  disabled = false,
}: IngredientsSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const applyPatch = (patch: IngredientPatch) => {
    onChange(
      ingredients.map((item) => {
        if (item.id !== patch.ingredientRowId) return item;
        const next = { ...item };

        if (patch.quantity !== undefined) next.quantity = patch.quantity;
        if (patch.unit !== undefined) next.unit = patch.unit;
        if (patch.gramsPerUnit !== undefined) {
          next.grams_per_unit = patch.gramsPerUnit;
        }
        if (patch.nutrientsPer100g !== undefined) {
          next.nutrient_snapshot = patch.nutrientsPer100g;
        }

        return next;
      })
    );
  };

  const removeItem = (id: string) => {
    onChange(ingredients.filter((item) => item.id !== id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    // No reordering while the form is busy (mirrors the row inputs' disabled).
    if (disabled) return;

    const { active, over } = event;

    if (over === null || active.id === over.id) return;

    const oldIndex = ingredients.findIndex((i) => i.id === active.id);
    const newIndex = ingredients.findIndex((i) => i.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(ingredients, oldIndex, newIndex));
  };

  return (
    <Card className="overflow-visible border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-4 overflow-visible p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:cup-hot-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">Ingredientes</h3>
          {ingredients.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-default-500 tabular-nums">
              {ingredients.length}
            </span>
          )}
        </div>

        {ingredients.length > 0 && (
          <div className="flex items-start gap-2 rounded-medium border border-blue-100 bg-blue-50/60 px-3 py-2">
            <Icon
              className="mt-0.5 shrink-0 text-blue-500"
              icon="solar:info-circle-linear"
              width={15}
            />
            <p className="text-xs text-blue-900">
              Los macros provienen de una base de datos externa y pueden no ser
              exactos en algunos ingredientes. Usa{" "}
              <Icon
                className="inline text-blue-500"
                icon="solar:tuning-2-linear"
                width={12}
              />{" "}
              en cada línea para corregirlos — la cantidad no cambia y los
              totales de la receta se recalculan.
            </p>
          </div>
        )}

        {ingredients.length > 0 ? (
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={ingredients.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col">
                {ingredients.map((item) => (
                  <SortableIngredient key={item.id} id={item.id}>
                    {(dragHandleProps) => (
                      <IngredientRow
                        busy={disabled}
                        dragHandleProps={dragHandleProps}
                        item={item}
                        onRemove={removeItem}
                        onUpdate={applyPatch}
                      />
                    )}
                  </SortableIngredient>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/50 py-8 text-center">
            <Icon
              className="text-default-300"
              icon="solar:cup-hot-linear"
              width={28}
            />
            <p className="px-6 text-sm text-default-500">
              Aún no hay ingredientes. Búscalos abajo para añadirlos y ajusta la
              cantidad de cada uno.
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <IngredientSearch
            busy={disabled}
            onAdd={(food) => onChange([...ingredients, draftFromFood(food)])}
            onAddManual={(input) =>
              onChange([...ingredients, draftFromManual(input)])
            }
          />
        </div>
      </CardBody>
    </Card>
  );
}
