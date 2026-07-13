"use client";

import type { FoodHit, OptionSelection } from "./cycle-api";
import type { MacroTotals } from "./cycle-math";
import type { RecipeIngredientItem } from "@/features/trainer/recipes/recipe-api";
import type { RecipeListItem } from "@/features/trainer/recipes/recipe-query";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Spinner,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { MultiplierField } from "./multiplier-field";
import { useFoodSearch } from "./use-cycles";

import {
  formatGrams,
  formatKcal,
} from "@/features/trainer/recipes/recipe-format";
import { useRecipeIngredients } from "@/features/trainer/recipes/use-recipe";
import { useRecipes } from "@/features/trainer/recipes/use-recipes";
import {
  RECIPE_UNIT_LABELS,
  normalizeUnit,
  toGrams,
} from "@/lib/nutrition/recipes/unit-conversion";

interface PickerDrawerProps {
  isOpen: boolean;
  isAdding: boolean;
  onClose: () => void;
  onSelect: (
    selection: OptionSelection,
    display?: {
      name: string;
      imageUrl: string | null;
      /** Recipe ingredient lines (native-unit amounts), for per-ingredient edit. */
      ingredients?: { name: string; unit: string; quantity: number }[];
    }
  ) => void;
  /** When true (cycle builder), choosing a recipe opens a per-client portions
   *  step. When false (calendar swap), a recipe is added with library defaults. */
  collectRecipePortions?: boolean;
  /** Header context — the meal/day/cycle the option is being added to. */
  mealLabel?: string;
  dayNumber?: number;
  cycleName?: string;
  /** Current macro totals of the day this option is being added to. When set,
   *  the food step previews the day total *with* the pending food added. */
  dayTotals?: MacroTotals;
}

type Source = "recipes" | "foods";

interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const KEYS: (keyof Macros)[] = ["kcal", "protein_g", "carbs_g", "fat_g"];

function scalePer100(per100: Record<string, number>, grams: number): Macros {
  const factor = grams / 100;
  const out: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const key of KEYS) out[key] = (Number(per100[key]) || 0) * factor;

  return out;
}

export function PickerDrawer({
  isOpen,
  isAdding,
  onClose,
  onSelect,
  collectRecipePortions = false,
  mealLabel,
  dayNumber,
  cycleName,
  dayTotals,
}: PickerDrawerProps) {
  const [source, setSource] = useState<Source>("recipes");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [foodQuery, setFoodQuery] = useState("");
  const [foodBrand, setFoodBrand] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeListItem | null>(
    null
  );
  const [selectedFood, setSelectedFood] = useState<FoodHit | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [foodGrams, setFoodGrams] = useState("");

  const recipesQuery = useRecipes({});
  const ingredientsQuery = useRecipeIngredients(selectedRecipe?.id ?? "");
  const ingredients = ingredientsQuery.data ?? [];

  // Reset everything when the drawer closes.
  useEffect(() => {
    if (isOpen === false) {
      setSource("recipes");
      setRecipeQuery("");
      setFoodQuery("");
      setFoodBrand("");
      setSelectedRecipe(null);
      setSelectedFood(null);
      setQuantities({});
      setComment("");
      setFoodGrams("");
    }
  }, [isOpen]);

  const published = useMemo(
    () => (recipesQuery.data ?? []).filter((r) => r.status === "active"),
    [recipesQuery.data]
  );
  const filteredRecipes = useMemo(() => {
    const term = recipeQuery.trim().toLowerCase();

    return term.length === 0
      ? published
      : published.filter((r) => r.name.toLowerCase().includes(term));
  }, [published, recipeQuery]);

  // The amount the trainer edits, in the ingredient's own unit (pieces for "u",
  // grams for "g", …). The unit and grams-per-piece come from the recipe and are
  // never editable here — only this number is.
  const amountFor = (item: RecipeIngredientItem): number =>
    // Round to 2 decimals, not integers — piece/litre lines legitimately carry
    // fractional amounts (e.g. 0.5 u, 1.5 lt) that integer rounding would lose.
    quantities[item.id] ?? Math.round(Number(item.quantity) * 100) / 100;

  // Grams equivalent of that amount, for the nutrition preview only.
  const gramsFor = (item: RecipeIngredientItem): number =>
    toGrams(amountFor(item), item.unit, item.grams_per_unit);

  const recipePreview = useMemo<Macros>(() => {
    return ingredients.reduce<Macros>(
      (acc, item) => {
        const scaled = scalePer100(
          item.nutrient_snapshot ?? {},
          gramsFor(item)
        );

        return {
          kcal: acc.kcal + scaled.kcal,
          protein_g: acc.protein_g + scaled.protein_g,
          carbs_g: acc.carbs_g + scaled.carbs_g,
          fat_g: acc.fat_g + scaled.fat_g,
        };
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [ingredients, quantities]);

  // Finite positive grams only — `Number(x) || 0` would let Infinity through.
  const parsedFoodGrams = Number(foodGrams);
  const foodGramsNum =
    Number.isFinite(parsedFoodGrams) && parsedFoodGrams > 0
      ? parsedFoodGrams
      : 0;
  const foodPreview =
    selectedFood !== null
      ? scalePer100(selectedFood.nutrientsPer100g, foodGramsNum)
      : null;

  const pickRecipe = (recipe: RecipeListItem) => {
    if (collectRecipePortions === false) {
      onSelect(
        { kind: "recipe", recipeId: recipe.id },
        { name: recipe.name, imageUrl: recipe.thumbnailUrl ?? null }
      );

      return;
    }
    setSelectedRecipe(recipe);
    setQuantities({});
    setComment("");
  };

  const confirmRecipe = () => {
    if (selectedRecipe === null) return;
    const trimmedComment = comment.trim();

    onSelect(
      {
        kind: "recipe",
        recipeId: selectedRecipe.id,
        // Native-unit amounts (pieces/ml/lt/g); the server converts to grams.
        quantities: ingredients.map((item) => amountFor(item)),
        ...(trimmedComment.length > 0
          ? { trainerComment: trimmedComment }
          : {}),
      },
      {
        name: selectedRecipe.name,
        imageUrl: selectedRecipe.thumbnailUrl ?? null,
        ingredients: ingredients.map((item) => ({
          name: item.name_snapshot,
          unit: item.unit,
          quantity: amountFor(item),
        })),
      }
    );
  };

  const confirmFood = () => {
    if (selectedFood?.id === undefined || foodGramsNum <= 0) return;
    onSelect(
      {
        kind: "food",
        ingredientId: selectedFood.id,
        quantity: foodGramsNum,
      },
      { name: selectedFood.name, imageUrl: selectedFood.imageUrl ?? null }
    );
  };

  const ctaEnabled =
    source === "recipes"
      ? selectedRecipe !== null &&
        collectRecipePortions &&
        // Don't allow confirming while the portion lines are still loading —
        // the selection would silently fall back to library defaults.
        ingredientsQuery.isPending === false
      : selectedFood?.id !== undefined && foodGramsNum > 0;

  const subtitle =
    dayNumber !== undefined && cycleName !== undefined
      ? `Día ${dayNumber} · plan ${cycleName}`
      : undefined;

  return (
    <Drawer
      classNames={{ base: "!max-w-full sm:!max-w-[50vw]" }}
      isOpen={isOpen}
      size="lg"
      onClose={onClose}
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-gray-900">
            {mealLabel !== undefined
              ? `Añadir opción a ${mealLabel}`
              : "Añadir opción"}
          </h2>
          {subtitle !== undefined && (
            <p className="text-xs font-normal text-default-500">{subtitle}</p>
          )}
        </DrawerHeader>

        <DrawerBody className="gap-4">
          <Tabs
            fullWidth
            aria-label="Origen"
            classNames={{
              tabList: "rounded-large bg-gray-100 p-1",
              cursor: "rounded-medium bg-white shadow-sm",
              tab: "h-9",
              tabContent:
                "font-medium text-default-500 group-data-[selected=true]:text-gray-900",
            }}
            selectedKey={source}
            variant="light"
            onSelectionChange={(key) => {
              setSource(key as Source);
              setSelectedRecipe(null);
              setSelectedFood(null);
            }}
          >
            <Tab
              key="recipes"
              title={
                <span className="flex items-center gap-1.5">
                  <Icon icon="solar:chef-hat-linear" width={16} />
                  Recetas
                </span>
              }
            />
            <Tab
              key="foods"
              title={
                <span className="flex items-center gap-1.5">
                  <Icon icon="solar:cup-hot-linear" width={16} />
                  Alimentos
                </span>
              }
            />
          </Tabs>

          {source === "recipes" ? (
            <RecipesPanel
              amountFor={amountFor}
              comment={comment}
              filtered={filteredRecipes}
              hasAnyPublished={published.length > 0}
              ingredients={ingredients}
              ingredientsLoading={ingredientsQuery.isLoading}
              isLoading={recipesQuery.isLoading}
              preview={recipePreview}
              query={recipeQuery}
              selectedRecipe={selectedRecipe}
              {...(dayTotals !== undefined ? { dayTotals } : {})}
              onBack={() => setSelectedRecipe(null)}
              onComment={setComment}
              onPick={pickRecipe}
              onQuantity={(id, value) =>
                setQuantities((prev) => ({ ...prev, [id]: value }))
              }
              onQueryChange={setRecipeQuery}
            />
          ) : (
            <FoodsPanel
              brand={foodBrand}
              foodGrams={foodGrams}
              preview={foodPreview}
              query={foodQuery}
              selectedFood={selectedFood}
              onBack={() => setSelectedFood(null)}
              onBrandChange={setFoodBrand}
              onFoodGrams={setFoodGrams}
              onPick={setSelectedFood}
              onQueryChange={setFoodQuery}
              {...(dayTotals !== undefined ? { dayTotals } : {})}
            />
          )}
        </DrawerBody>

        <DrawerFooter className="flex-col items-stretch gap-2">
          {source === "recipes" && selectedRecipe !== null && (
            <SnapshotNotice />
          )}
          <Button
            className="w-full bg-blue-600 text-white"
            color="primary"
            isDisabled={ctaEnabled === false}
            isLoading={isAdding}
            startContent={
              isAdding ? null : (
                <Icon icon="solar:add-circle-linear" width={18} />
              )
            }
            onPress={source === "recipes" ? confirmRecipe : confirmFood}
          >
            Añadir al plan
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function RecipesPanel({
  isLoading,
  hasAnyPublished,
  filtered,
  query,
  onQueryChange,
  selectedRecipe,
  onPick,
  onBack,
  ingredients,
  ingredientsLoading,
  amountFor,
  onQuantity,
  comment,
  onComment,
  preview,
  dayTotals,
}: {
  isLoading: boolean;
  hasAnyPublished: boolean;
  filtered: RecipeListItem[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedRecipe: RecipeListItem | null;
  onPick: (recipe: RecipeListItem) => void;
  onBack: () => void;
  ingredients: RecipeIngredientItem[];
  ingredientsLoading: boolean;
  amountFor: (item: RecipeIngredientItem) => number;
  onQuantity: (id: string, value: number) => void;
  comment: string;
  onComment: (value: string) => void;
  preview: Macros;
  dayTotals?: MacroTotals;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          isClearable
          placeholder="Buscar recetas publicadas..."
          startContent={
            <Icon
              className="text-default-400"
              icon="solar:magnifer-linear"
              width={16}
            />
          }
          value={query}
          variant="bordered"
          onClear={() => onQueryChange("")}
          onValueChange={onQueryChange}
        />
        <span className="flex shrink-0 items-center gap-1 rounded-large border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-default-500">
          <Icon icon="solar:filter-linear" width={14} />
          Solo publicadas
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
          1. Elige una receta publicada
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : hasAnyPublished === false ? (
          <EmptyState
            icon="solar:chef-hat-linear"
            text="No hay recetas publicadas todavía. Publica una receta en la biblioteca para añadirla a un plan."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="solar:magnifer-linear"
            text="No encontramos recetas publicadas con ese nombre."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((recipe) => (
              <RecipeCardRow
                key={recipe.id}
                recipe={recipe}
                selected={selectedRecipe?.id === recipe.id}
                onPick={() => onPick(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedRecipe !== null && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
            2. Personaliza las cantidades para este cliente
          </p>
          <button
            className="flex items-center gap-1.5 self-start text-sm font-medium text-gray-900"
            type="button"
            onClick={onBack}
          >
            <Icon icon="solar:arrow-left-linear" width={16} />
            {selectedRecipe.name}
          </button>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
            <div className="flex min-w-0 flex-col gap-3">
              <LockedBanner />

              {ingredientsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : ingredients.length === 0 ? (
                <p className="text-sm text-default-500">
                  Esta receta no tiene ingredientes.
                </p>
              ) : (
                <IngredientTable
                  amountFor={amountFor}
                  ingredients={ingredients}
                  onQuantity={onQuantity}
                />
              )}

              <Textarea
                label="Comentario para este cliente (opcional)"
                maxLength={2000}
                minRows={2}
                placeholder="Ej.: en esta comida metemos más grasa para llegar al objetivo del día."
                value={comment}
                variant="bordered"
                onValueChange={onComment}
              />
            </div>

            <div className="flex flex-col gap-3 md:sticky md:top-0">
              <NutritionPreview preview={preview} />
              {dayTotals !== undefined && (
                <DayMacrosPreview
                  addition={preview}
                  current={dayTotals}
                  subject="esta receta"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCardRow({
  recipe,
  selected,
  onPick,
}: {
  recipe: RecipeListItem;
  selected: boolean;
  onPick: () => void;
}) {
  const thumb =
    recipe.thumbnailUrl !== undefined &&
    recipe.thumbnailUrl !== null &&
    recipe.thumbnailUrl.length > 0
      ? recipe.thumbnailUrl
      : null;
  const tag = recipe.meal_type_tags[0];

  return (
    <button
      className={`flex items-center gap-3 rounded-large border p-2.5 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
      type="button"
      onClick={onPick}
    >
      {thumb !== null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-12 w-12 shrink-0 rounded-medium border border-gray-200 object-cover"
          loading="lazy"
          src={thumb}
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
          <Icon
            className="text-default-300"
            icon="solar:chef-hat-linear"
            width={20}
          />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {recipe.name}
          </span>
          {tag !== undefined && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-default-500">
              {tag}
            </span>
          )}
        </div>
        <p className="text-xs text-default-500 tabular-nums">
          {formatKcal(recipe.kcal)} · P {Math.round(recipe.protein_g)}g · C{" "}
          {Math.round(recipe.carbs_g)}g · G {Math.round(recipe.fat_g)}g
        </p>
      </div>

      <Icon
        className="shrink-0 text-default-300"
        icon="solar:alt-arrow-right-linear"
        width={18}
      />
    </button>
  );
}

function LockedBanner() {
  return (
    <div className="flex gap-2 rounded-large bg-blue-50 p-3 text-xs text-blue-900">
      <Icon
        className="mt-0.5 shrink-0 text-blue-500"
        icon="solar:info-circle-linear"
        width={16}
      />
      <p>
        <span className="font-semibold">
          Esta es una personalización para este cliente.
        </span>{" "}
        La estructura de la receta está bloqueada: puedes ajustar las cantidades
        de los ingredientes, pero no puedes agregar ni eliminar ingredientes
        aquí.
      </p>
    </div>
  );
}

function IngredientTable({
  ingredients,
  amountFor,
  onQuantity,
}: {
  ingredients: RecipeIngredientItem[];
  amountFor: (item: RecipeIngredientItem) => number;
  onQuantity: (id: string, value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-default-400">
        <span>Ingrediente</span>
        <span>Multiplicador · Cantidad</span>
      </div>
      {ingredients.map((item) => {
        const kcal = item.nutrient_snapshot?.kcal;
        const unit = normalizeUnit(item.unit);
        // Recipe's base amount for this line — the ×1 reference. Editing the
        // multiplier rescales the amount; editing the amount re-derives it.
        const base = Number(item.quantity);
        const rowMultiplier =
          base > 0 ? Math.round((amountFor(item) / base) * 100) / 100 : null;
        // Only pieces carry a weight-per-unit; it's fixed by the recipe.
        const perPiece =
          unit === "u" &&
          item.grams_per_unit !== null &&
          Number.isFinite(item.grams_per_unit)
            ? `× ${item.grams_per_unit} g`
            : null;

        return (
          <div key={item.id} className="flex items-center gap-3">
            {item.image_url !== null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-9 w-9 shrink-0 rounded-medium border border-gray-200 object-cover"
                loading="lazy"
                src={item.image_url}
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
                <Icon
                  className="text-default-300"
                  icon="solar:cup-hot-linear"
                  width={16}
                />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-900">
                {item.name_snapshot}
              </p>
              {kcal !== undefined && (
                <p className="text-xs text-default-500 tabular-nums">
                  {formatKcal(kcal)} / 100g
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {perPiece !== null && (
                <span className="text-[10px] text-default-400 tabular-nums">
                  {perPiece}
                </span>
              )}
              {rowMultiplier !== null && (
                <MultiplierField
                  ariaLabel={`Multiplicador de ${item.name_snapshot}`}
                  value={rowMultiplier}
                  onCommit={(value) =>
                    onQuantity(item.id, Math.round(base * value * 100) / 100)
                  }
                />
              )}
              <Input
                aria-label={`Cantidad de ${item.name_snapshot}`}
                className="w-24"
                endContent={
                  <span className="text-xs text-default-400">
                    {RECIPE_UNIT_LABELS[unit]}
                  </span>
                }
                min={0}
                size="sm"
                type="number"
                value={String(amountFor(item))}
                variant="bordered"
                onValueChange={(value) =>
                  onQuantity(item.id, Number(value) || 0)
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PreviewBar {
  label: string;
  grams: number;
  kcalPerGram: number;
  colorClass: string;
}

function NutritionPreview({ preview }: { preview: Macros }) {
  const kcal = preview.kcal;
  const bars: PreviewBar[] = [
    {
      label: "Proteína",
      grams: preview.protein_g,
      kcalPerGram: 4,
      colorClass: "bg-emerald-500",
    },
    {
      label: "Carbohidratos",
      grams: preview.carbs_g,
      kcalPerGram: 4,
      colorClass: "bg-sky-500",
    },
    {
      label: "Grasa",
      grams: preview.fat_g,
      kcalPerGram: 9,
      colorClass: "bg-amber-500",
    },
  ];

  return (
    <div className="rounded-large border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon
          className="text-emerald-600"
          icon="solar:chart-square-linear"
          width={16}
        />
        <h4 className="text-sm font-semibold text-gray-900">
          Vista previa de nutrición
        </h4>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
          {Math.round(kcal)}
        </span>
        <span className="text-xs font-medium text-default-500">
          kcal por porción
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {bars.map((bar) => {
          const share = kcal > 0 ? (bar.grams * bar.kcalPerGram) / kcal : 0;
          const width = Math.min(100, Math.max(0, Math.round(share * 100)));

          return (
            <div key={bar.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-default-600">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${bar.colorClass}`}
                  />
                  {bar.label}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {formatGrams(bar.grams)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${bar.colorClass}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SnapshotNotice() {
  return (
    <div className="flex gap-2 rounded-large bg-blue-50 p-2.5 text-xs text-blue-900">
      <Icon
        className="mt-0.5 shrink-0 text-blue-500"
        icon="solar:info-circle-linear"
        width={15}
      />
      <p>
        <span className="font-semibold">
          Se guardará una copia personalizada de esta receta para este plan.
        </span>{" "}
        No se modifica la receta original.
      </p>
    </div>
  );
}

function FoodsPanel({
  query,
  onQueryChange,
  brand,
  onBrandChange,
  selectedFood,
  onPick,
  onBack,
  foodGrams,
  onFoodGrams,
  preview,
  dayTotals,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  selectedFood: FoodHit | null;
  onPick: (food: FoodHit) => void;
  onBack: () => void;
  foodGrams: string;
  onFoodGrams: (value: string) => void;
  preview: Macros | null;
  dayTotals?: MacroTotals;
}) {
  const { data, isFetching } = useFoodSearch(query, brand);
  const foods = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Once a food is chosen, hide the search + result list so the detail
          (quantity + macros) is visible without scrolling past every result. */}
      {selectedFood === null && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-900">
              Busca alimentos individuales
            </p>
            <p className="text-xs text-default-500">
              Encuentra alimentos de la base de datos nutricional y añádelos
              directamente a esta comida.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              isClearable
              className="sm:flex-1"
              placeholder="Nombre del alimento..."
              startContent={
                <Icon
                  className="text-default-400"
                  icon="solar:magnifer-linear"
                  width={16}
                />
              }
              value={query}
              variant="bordered"
              onClear={() => onQueryChange("")}
              onValueChange={onQueryChange}
            />
            <Input
              isClearable
              className="sm:w-52"
              placeholder="Marca (opcional)..."
              startContent={
                <Icon
                  className="text-default-400"
                  icon="solar:tag-linear"
                  width={16}
                />
              }
              value={brand}
              variant="bordered"
              onClear={() => onBrandChange("")}
              onValueChange={onBrandChange}
            />
          </div>

          {isFetching && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          )}

          {isFetching === false &&
            query.trim().length >= 2 &&
            foods.length === 0 && (
              <EmptyState
                icon="solar:magnifer-linear"
                text="No encontramos alimentos para esta búsqueda. Prueba con otro nombre o marca."
              />
            )}

          <div className="flex flex-col gap-2">
            {foods.map((food, index) => (
              <FoodCardRow
                key={food.id ?? `${food.name}-${index}`}
                food={food}
                selected={false}
                onPick={() => onPick(food)}
              />
            ))}
          </div>
        </>
      )}

      {selectedFood !== null && (
        <FoodDetail
          brand={selectedFood.brand}
          foodGrams={foodGrams}
          imageUrl={selectedFood.imageUrl}
          inLibrary={selectedFood.id !== undefined}
          name={selectedFood.name}
          per100Kcal={selectedFood.nutrientsPer100g.kcal ?? 0}
          preview={preview}
          onBack={onBack}
          onFoodGrams={onFoodGrams}
          {...(dayTotals !== undefined ? { dayTotals } : {})}
        />
      )}
    </div>
  );
}

const GRAM_CHIPS = [50, 100, 150, 200];

/** The selected-food step: hero, quantity (with quick chips) and live macros. */
function FoodDetail({
  name,
  brand,
  imageUrl,
  per100Kcal,
  inLibrary,
  foodGrams,
  onFoodGrams,
  preview,
  dayTotals,
  onBack,
}: {
  name: string;
  brand?: string | undefined;
  imageUrl?: string | undefined;
  per100Kcal: number;
  inLibrary: boolean;
  foodGrams: string;
  onFoodGrams: (value: string) => void;
  preview: Macros | null;
  dayTotals?: MacroTotals;
  onBack: () => void;
}) {
  const grams = Number(foodGrams) || 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 border-t border-gray-100 pt-4">
      <button
        className="flex items-center gap-1.5 self-start text-sm font-medium text-default-500 transition-colors hover:text-gray-900"
        type="button"
        onClick={onBack}
      >
        <Icon icon="solar:arrow-left-linear" width={16} />
        Volver a la búsqueda
      </button>

      <div className="flex items-center gap-4 rounded-large border border-gray-200 bg-white p-4 shadow-sm">
        {imageUrl !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-16 w-16 shrink-0 rounded-medium border border-gray-200 object-cover"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
            <Icon
              className="text-default-300"
              icon="solar:cup-hot-linear"
              width={24}
            />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">
            {name}
          </p>
          {brand !== undefined && (
            <p className="truncate text-sm text-default-500">{brand}</p>
          )}
          <p className="mt-0.5 text-xs text-default-400 tabular-nums">
            {formatKcal(per100Kcal)} / 100 g
          </p>
        </div>
      </div>

      {inLibrary === false ? (
        <p className="rounded-large bg-amber-50 p-3 text-xs text-amber-700">
          Este alimento aún no está en tu biblioteca. Guárdalo primero para
          poder añadirlo.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-900">
              ¿Cuántos gramos?
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Cantidad en gramos"
                className="w-32"
                endContent={<span className="text-xs text-default-400">g</span>}
                min={0}
                placeholder="p. ej. 150"
                type="number"
                value={foodGrams}
                variant="bordered"
                onValueChange={onFoodGrams}
              />
              {GRAM_CHIPS.map((value) => (
                <Button
                  key={value}
                  className={grams === value ? "bg-blue-600 text-white" : ""}
                  size="sm"
                  variant={grams === value ? "solid" : "bordered"}
                  onPress={() => onFoodGrams(String(value))}
                >
                  {value} g
                </Button>
              ))}
            </div>
          </div>

          {grams > 0 && preview !== null ? (
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <NutritionPreview preview={preview} />
              {dayTotals !== undefined && (
                <DayMacrosPreview addition={preview} current={dayTotals} />
              )}
            </div>
          ) : (
            <p className="rounded-large border border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 text-center text-sm text-default-400">
              Indica los gramos para ver los macros de este alimento y su
              impacto en el día.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Day macro total (current → projected) with the pending option folded in. */
function DayMacrosPreview({
  current,
  addition,
  subject = "este alimento",
}: {
  current: MacroTotals;
  addition: Macros;
  subject?: string;
}) {
  const rows: {
    label: string;
    current: number;
    added: number;
    unit: string;
  }[] = [
    {
      label: "Calorías",
      current: current.kcal,
      added: addition.kcal,
      unit: "",
    },
    {
      label: "Proteína",
      current: current.protein_g,
      added: addition.protein_g,
      unit: "g",
    },
    {
      label: "Carbohidratos",
      current: current.carbs_g,
      added: addition.carbs_g,
      unit: "g",
    },
    {
      label: "Grasa",
      current: current.fat_g,
      added: addition.fat_g,
      unit: "g",
    },
  ];

  return (
    <div className="rounded-large border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon
          className="text-emerald-700"
          icon="solar:calendar-linear"
          width={16}
        />
        <h4 className="text-sm font-semibold text-emerald-900">
          Total del día con {subject}
        </h4>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-medium text-gray-700">{row.label}</span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <span className="text-gray-500">
                {Math.round(row.current)}
                {row.unit}
              </span>
              <Icon
                className="text-emerald-500"
                icon="solar:arrow-right-linear"
                width={13}
              />
              <span className="font-bold text-emerald-800">
                {Math.round(row.current + row.added)}
                {row.unit}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-emerald-200/70 pt-2 text-[11px] font-medium text-emerald-700">
        +{Math.round(addition.kcal)} kcal de {subject}
      </p>
    </div>
  );
}

function FoodCardRow({
  food,
  selected,
  onPick,
}: {
  food: FoodHit;
  selected: boolean;
  onPick: () => void;
}) {
  const per = food.nutrientsPer100g;

  return (
    <button
      className={`flex items-center gap-3 rounded-large border p-2.5 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
      type="button"
      onClick={onPick}
    >
      {food.imageUrl !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-11 w-11 shrink-0 rounded-medium border border-gray-200 object-cover"
          loading="lazy"
          src={food.imageUrl}
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
          <Icon
            className="text-default-300"
            icon="solar:cup-hot-linear"
            width={18}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {food.name}
        </p>
        <p className="truncate text-xs text-default-500 tabular-nums">
          {food.brand !== undefined ? `${food.brand} · ` : ""}
          {formatKcal(per.kcal)} / 100g
        </p>
      </div>
      <Icon
        className="shrink-0 text-default-300"
        icon="solar:alt-arrow-right-linear"
        width={18}
      />
    </button>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 text-center">
      <Icon className="text-default-300" icon={icon} width={28} />
      <p className="text-sm text-default-500">{text}</p>
    </div>
  );
}
