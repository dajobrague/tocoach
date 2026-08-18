"use client";

import type { RecipeFolder } from "./folder-tree";
import type { RecipeListItem } from "./recipe-query";

import { Icon } from "@iconify/react";

import { groupedSections } from "./folder-tree";
import { RecipeCard } from "./recipe-card";
import { RecipeList } from "./recipe-list";

interface GroupedRecipeListProps {
  recipes: RecipeListItem[];
  folders: RecipeFolder[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (id: string) => void;
  onDelete: (recipe: RecipeListItem) => void;
  onCreate: () => void;
}

const GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/**
 * The "Lista" view grouped by folder (feedback round on the folder view):
 * every group visible at once — no navigation — with nested folders indented
 * under their parent. Groups follow whatever filter/search produced
 * `recipes`, so empty headings never appear.
 */
export function GroupedRecipeList({
  recipes,
  folders,
  isLoading,
  isError,
  onOpen,
  onDelete,
  onCreate,
}: GroupedRecipeListProps) {
  // Loading / error / empty reuse the flat list's states verbatim.
  if (isLoading || isError || recipes.length === 0) {
    return (
      <RecipeList
        isError={isError}
        isLoading={isLoading}
        recipes={recipes}
        onCreate={onCreate}
        onDelete={onDelete}
        onOpen={onOpen}
      />
    );
  }

  const sections = groupedSections(folders, recipes);

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section
          key={`${section.kind}:${section.label}:${section.depth}`}
          style={{ marginLeft: `${section.depth * 1.25}rem` }}
        >
          <header className="mb-2.5 flex items-center gap-2">
            <Icon
              className={
                section.kind === "untagged"
                  ? "text-default-300"
                  : "text-amber-500"
              }
              icon={
                section.kind === "untagged"
                  ? "solar:folder-error-linear"
                  : "solar:folder-bold"
              }
              width={18}
            />
            <h2 className="text-sm font-semibold text-gray-900">
              {section.label}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-default-500 tabular-nums">
              {section.recipes.length}
            </span>
          </header>

          <div className={GRID}>
            {section.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onDelete={onDelete}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
