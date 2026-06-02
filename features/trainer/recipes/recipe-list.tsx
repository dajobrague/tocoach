"use client";

import type { RecipeListItem } from "./recipe-query";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { RecipeCard } from "./recipe-card";

interface RecipeListProps {
  recipes: RecipeListItem[];
  isLoading: boolean;
  isError: boolean;
  onOpen?: (id: string) => void;
}

export function RecipeList({
  recipes,
  isLoading,
  isError,
  onOpen,
}: RecipeListProps) {
  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="flex items-center justify-center p-12">
          <Spinner color="primary" size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="flex flex-col items-center gap-2 p-12 text-center">
          <Icon
            className="text-danger"
            icon="solar:danger-triangle-linear"
            width={36}
          />
          <p className="text-default-500">No se pudieron cargar las recetas.</p>
        </CardBody>
      </Card>
    );
  }

  if (recipes.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="flex flex-col items-center gap-2 p-12 text-center">
          <Icon
            className="text-default-300"
            icon="solar:chef-hat-linear"
            width={36}
          />
          <p className="text-default-500">
            No hay recetas que coincidan con los filtros.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          {...(onOpen !== undefined ? { onOpen } : {})}
        />
      ))}
    </div>
  );
}
