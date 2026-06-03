"use client";

import type { OptionSelection } from "./cycle-api";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Input,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useFoodSearch } from "./use-cycles";

import { RecipeCard } from "@/features/trainer/recipes/recipe-card";
import { useRecipes } from "@/features/trainer/recipes/use-recipes";

interface PickerDrawerProps {
  isOpen: boolean;
  isAdding: boolean;
  onClose: () => void;
  onSelect: (selection: OptionSelection) => void;
}

/**
 * Slot option picker. The Recetas tab shows the whole recipe library up front
 * (the search filters it client-side); the Alimentos tab stays search-based (an
 * external dataset). Adding either freezes the snapshot server-side.
 */
export function PickerDrawer({
  isOpen,
  isAdding,
  onClose,
  onSelect,
}: PickerDrawerProps) {
  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
      <DrawerContent>
        <DrawerHeader>Añadir opción</DrawerHeader>
        <DrawerBody className="pb-6">
          <Tabs fullWidth aria-label="Tipo de opción">
            <Tab key="recipe" title="Recetas">
              <RecipeLibrary isAdding={isAdding} onSelect={onSelect} />
            </Tab>
            <Tab key="food" title="Alimentos">
              <FoodSearch isAdding={isAdding} onSelect={onSelect} />
            </Tab>
          </Tabs>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      placeholder="Buscar…"
      size="sm"
      startContent={<Icon icon="solar:magnifer-linear" width={16} />}
      value={value}
      onValueChange={onChange}
    />
  );
}

function EmptyHint({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon className="text-default-300" icon={icon} width={32} />
      <p className="text-sm text-default-500">{message}</p>
    </div>
  );
}

function RecipeLibrary({
  isAdding,
  onSelect,
}: {
  isAdding: boolean;
  onSelect: (selection: OptionSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useRecipes({});
  const recipes = data ?? [];
  const term = query.trim().toLowerCase();
  const filtered =
    term.length === 0
      ? recipes
      : recipes.filter((recipe) => recipe.name.toLowerCase().includes(term));

  return (
    <div className="flex flex-col gap-3 pt-2">
      <SearchBox value={query} onChange={setQuery} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : null}

      {isLoading === false && recipes.length === 0 ? (
        <EmptyHint
          icon="solar:chef-hat-linear"
          message="Aún no tienes recetas en tu biblioteca."
        />
      ) : null}

      {isLoading === false && recipes.length > 0 && filtered.length === 0 ? (
        <EmptyHint
          icon="solar:magnifer-linear"
          message="No hay recetas que coincidan con la búsqueda."
        />
      ) : null}

      {filtered.length > 0 ? (
        <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          {filtered.map((recipe) => (
            <div key={recipe.id} data-testid="picker-recipe">
              <RecipeCard
                recipe={recipe}
                onOpen={(id) => {
                  if (isAdding === false) {
                    onSelect({ kind: "recipe", recipeId: id });
                  }
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FoodSearch({
  isAdding,
  onSelect,
}: {
  isAdding: boolean;
  onSelect: (selection: OptionSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const { data, isFetching } = useFoodSearch(query);
  const foods = data ?? [];
  const quantity = Number(grams) || 0;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <SearchBox value={query} onChange={setQuery} />
      <Input
        label="Cantidad (g)"
        size="sm"
        type="number"
        value={grams}
        onValueChange={setGrams}
      />
      {isFetching ? <Spinner size="sm" /> : null}
      {foods.map((food, index) => {
        const cacheable = typeof food.id === "string" && food.id.length > 0;

        return (
          <div
            key={food.id ?? `${food.name}-${index}`}
            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 p-2"
            data-testid="picker-food"
          >
            <p className="min-w-0 truncate text-sm text-gray-900">
              {food.name}
            </p>
            <Button
              color="primary"
              isDisabled={isAdding || cacheable === false || quantity <= 0}
              size="sm"
              variant="flat"
              onPress={() =>
                cacheable
                  ? onSelect({
                      kind: "food",
                      ingredientId: food.id as string,
                      quantity,
                    })
                  : undefined
              }
            >
              {cacheable ? "Añadir" : "Guarda primero"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
