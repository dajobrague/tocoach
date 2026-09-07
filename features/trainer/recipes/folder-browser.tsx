"use client";

import type { RecipeListItem } from "./recipe-query";

import { useQueryClient } from "@tanstack/react-query";

import { FolderBrowser as LibraryFolderBrowser } from "../library/folder-browser";

import { moveRecipe } from "./recipe-api";
import { RecipeList } from "./recipe-list";
import { recipeFolderHooks } from "./use-folders";

interface FolderBrowserProps {
  /** The full (non-archived) library; membership is computed client-side. */
  recipes: RecipeListItem[];
  /** Active tag filter: composes with the open folder (folder AND tags). */
  tags: string[];
  isLoading: boolean;
  isError: boolean;
  onOpenRecipe: (id: string) => void;
  onDeleteRecipe: (recipe: RecipeListItem) => void;
  onCreateRecipe: () => void;
}

/** The shared Drive-style folder browser bound to the recipe library. */
export function FolderBrowser({
  recipes,
  tags,
  isLoading,
  isError,
  onOpenRecipe,
  onDeleteRecipe,
  onCreateRecipe,
}: FolderBrowserProps) {
  const qc = useQueryClient();

  return (
    <LibraryFolderBrowser
      hooks={recipeFolderHooks}
      isError={isError}
      isLoading={isLoading}
      items={recipes}
      labels={{
        root: "Mis recetas",
        singular: "receta",
        plural: "recetas",
        create: "Nueva receta",
        folderExample: "Desayunos",
      }}
      moveItem={(recipe, folderId) => moveRecipe(recipe.id, folderId)}
      renderItems={(items, { onMove }) => (
        <RecipeList
          isError={false}
          isLoading={false}
          recipes={items}
          onCreate={onCreateRecipe}
          onDelete={onDeleteRecipe}
          onMove={onMove}
          onOpen={onOpenRecipe}
        />
      )}
      tags={tags}
      tagsOf={(recipe) => recipe.meal_type_tags}
      onCreateItem={onCreateRecipe}
      onMoved={() => qc.invalidateQueries({ queryKey: ["recipes"] })}
    />
  );
}
