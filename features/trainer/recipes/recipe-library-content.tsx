"use client";

import type { RecipeListItem } from "./recipe-query";
import type {
  RecipeFilters as RecipeFilterValues,
  RecipeStatus,
} from "./recipe-query";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DeleteRecipeModal } from "./delete-recipe-modal";
import { FolderBrowser } from "./folder-browser";
import { NewRecipeModal } from "./new-recipe-modal";
import { RecipeFilters } from "./recipe-filters";
import { RecipeList } from "./recipe-list";
import { distinctMealTypes } from "./recipe-query";
import { useRecipes } from "./use-recipes";

const VIEW_STORAGE_KEY = "topcoach.recipes.view";

type LibraryView = "folders" | "list";

function initialView(): LibraryView {
  if (typeof window === "undefined") return "folders";

  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list"
      ? "list"
      : "folders";
  } catch {
    return "folders";
  }
}

const IMPORT_PATH = "/trainer/dashboard/recipes/import";

export function RecipeLibraryContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RecipeStatus>("");
  const [mealType, setMealType] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [toDelete, setToDelete] = useState<RecipeListItem | null>(null);
  // Folder vs list view, remembered per browser (Jul 28 call: each trainer
  // picks how they want to see their library).
  const [view, setView] = useState<LibraryView>(initialView);

  const changeView = (next: LibraryView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Private mode — the preference just won't persist.
    }
  };

  const filters = useMemo<RecipeFilterValues>(() => {
    const value: RecipeFilterValues = {};
    const trimmed = query.trim();

    if (trimmed.length > 0) value.query = trimmed;
    if (status !== "") value.status = status;
    if (mealType.length > 0) value.mealType = mealType;

    return value;
  }, [query, status, mealType]);

  const { data, isLoading, isError } = useRecipes(filters);
  // Unfiltered library (cache-shared with the initial page load) so the tag
  // dropdown keeps offering every tag while a filter narrows the list.
  const allRecipes = useRecipes({});
  const mealTypeOptions = useMemo(
    () => distinctMealTypes(allRecipes.data ?? [], mealType),
    [allRecipes.data, mealType]
  );
  // Archived = soft-deleted; hide them unless the trainer explicitly filters by
  // status (they remain reachable via the "Archivada" filter option).
  const recipes = useMemo(
    () =>
      (data ?? []).filter(
        (recipe) => status.length > 0 || recipe.status !== "archived"
      ),
    [data, status]
  );
  const showCount = isLoading === false && isError === false;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Recetas
              </h1>
              {showCount && (
                <span className="rounded-full bg-gray-200/70 px-2 py-0.5 text-xs font-medium text-default-600 tabular-nums">
                  {recipes.length}
                </span>
              )}
            </div>
            <p className="text-sm text-default-500">
              Biblioteca de recetas de tu equipo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              startContent={
                <Icon icon="solar:download-minimalistic-linear" width={20} />
              }
              variant="bordered"
              onPress={() => router.push(IMPORT_PATH)}
            >
              Importar de planes antiguos
            </Button>
            <Button
              className="bg-black text-white"
              color="primary"
              startContent={<Icon icon="solar:add-circle-bold" width={20} />}
              onPress={() => setNewOpen(true)}
            >
              Nueva receta
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-1 self-start rounded-large bg-gray-100 p-1">
            <button
              className={
                view === "folders"
                  ? "flex items-center gap-1.5 rounded-medium bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm"
                  : "flex items-center gap-1.5 rounded-medium px-3 py-1.5 text-xs font-medium text-default-500 hover:text-gray-900"
              }
              type="button"
              onClick={() => changeView("folders")}
            >
              <Icon icon="solar:folder-linear" width={14} />
              Carpetas
            </button>
            <button
              className={
                view === "list"
                  ? "flex items-center gap-1.5 rounded-medium bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm"
                  : "flex items-center gap-1.5 rounded-medium px-3 py-1.5 text-xs font-medium text-default-500 hover:text-gray-900"
              }
              type="button"
              onClick={() => changeView("list")}
            >
              <Icon icon="solar:list-linear" width={14} />
              Lista
            </button>
          </div>

          <div className="flex-1">
            <RecipeFilters
              mealType={mealType}
              mealTypeOptions={mealTypeOptions}
              query={query}
              showSelects={view === "list"}
              status={status}
              onMealTypeChange={setMealType}
              onQueryChange={setQuery}
              onStatusChange={(value) => setStatus(value as "" | RecipeStatus)}
            />
          </div>
        </div>

        {view === "folders" && query.trim().length === 0 ? (
          <FolderBrowser
            isError={allRecipes.isError}
            isLoading={allRecipes.isLoading}
            recipes={(allRecipes.data ?? []).filter(
              (recipe) => recipe.status !== "archived"
            )}
            onCreateRecipe={() => setNewOpen(true)}
            onDeleteRecipe={setToDelete}
            onOpenRecipe={(id) =>
              router.push(`/trainer/dashboard/recipes/${id}/edit`)
            }
          />
        ) : (
          <RecipeList
            isError={isError}
            isLoading={isLoading}
            recipes={recipes}
            onCreate={() => setNewOpen(true)}
            onDelete={setToDelete}
            onOpen={(id) =>
              router.push(`/trainer/dashboard/recipes/${id}/edit`)
            }
          />
        )}
      </div>

      <NewRecipeModal isOpen={newOpen} onClose={() => setNewOpen(false)} />
      <DeleteRecipeModal recipe={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
