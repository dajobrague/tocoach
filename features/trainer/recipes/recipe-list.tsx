"use client";

import type { RecipeListItem } from "./recipe-query";

import { Button, Card, CardBody, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";

import { RecipeCard } from "./recipe-card";

interface RecipeListProps {
  recipes: RecipeListItem[];
  isLoading: boolean;
  isError: boolean;
  onOpen?: (id: string) => void;
  onDelete?: (recipe: RecipeListItem) => void;
  onCreate?: () => void;
  /** Folder view only: per-card "move to folder" action. */
  onMove?: (recipe: RecipeListItem) => void;
}

const GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function RecipeList({
  recipes,
  isLoading,
  isError,
  onOpen,
  onDelete,
  onCreate,
  onMove,
}: RecipeListProps) {
  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <StateCard
        icon="solar:danger-triangle-linear"
        iconClass="text-danger"
        title="No se pudieron cargar las recetas."
      />
    );
  }

  if (recipes.length === 0) {
    return (
      <StateCard
        action={
          onCreate !== undefined ? (
            <Button
              className="bg-black text-white"
              color="primary"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={onCreate}
            >
              Nueva receta
            </Button>
          ) : undefined
        }
        icon="solar:chef-hat-linear"
        iconClass="text-default-300"
        subtitle="Crea tu primera receta o ajusta los filtros."
        title="No hay recetas todavía"
      />
    );
  }

  return (
    <div className={GRID}>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          {...(onOpen !== undefined ? { onOpen } : {})}
          {...(onDelete !== undefined ? { onDelete } : {})}
          {...(onMove !== undefined ? { onMove } : {})}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="p-0">
        <Skeleton className="aspect-video w-full" />
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  );
}

function StateCard({
  icon,
  iconClass,
  title,
  subtitle,
  action,
}: {
  icon: string;
  iconClass: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col items-center gap-3 p-12 text-center">
        <Icon className={iconClass} icon={icon} width={40} />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-gray-900">{title}</p>
          {subtitle !== undefined && (
            <p className="text-sm text-default-500">{subtitle}</p>
          )}
        </div>
        {action}
      </CardBody>
    </Card>
  );
}
