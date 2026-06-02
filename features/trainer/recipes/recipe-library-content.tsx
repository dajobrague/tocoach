"use client";

import type {
  RecipeFilters as RecipeFilterValues,
  RecipeStatus,
} from "./recipe-query";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RecipeFilters } from "./recipe-filters";
import { RecipeList } from "./recipe-list";
import { distinctMealTypes } from "./recipe-query";
import { useRecipes } from "./use-recipes";

const NEW_RECIPE_PATH = "/trainer/dashboard/recipes/new";

export function RecipeLibraryContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RecipeStatus>("");
  const [mealType, setMealType] = useState("");

  const filters = useMemo<RecipeFilterValues>(() => {
    const value: RecipeFilterValues = {};
    const trimmed = query.trim();

    if (trimmed.length > 0) value.query = trimmed;
    if (status !== "") value.status = status;
    if (mealType.length > 0) value.mealType = mealType;

    return value;
  }, [query, status, mealType]);

  const { data, isLoading, isError } = useRecipes(filters);
  const recipes = data ?? [];
  const mealTypeOptions = useMemo(
    () => distinctMealTypes(recipes, mealType),
    [recipes, mealType]
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recetas</h1>
          <p className="text-sm text-default-500">
            Biblioteca de recetas de tu equipo.
          </p>
        </div>
        <Button
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          onPress={() => router.push(NEW_RECIPE_PATH)}
        >
          Nueva receta
        </Button>
      </div>

      <RecipeFilters
        mealType={mealType}
        mealTypeOptions={mealTypeOptions}
        query={query}
        status={status}
        onMealTypeChange={setMealType}
        onQueryChange={setQuery}
        onStatusChange={(value) => setStatus(value as "" | RecipeStatus)}
      />

      <RecipeList
        isError={isError}
        isLoading={isLoading}
        recipes={recipes}
        onOpen={(id) => router.push(`/trainer/dashboard/recipes/${id}/edit`)}
      />
    </div>
  );
}
