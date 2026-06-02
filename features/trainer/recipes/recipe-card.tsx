"use client";

import type { RecipeListItem } from "./recipe-query";

import { Card, CardBody, Chip, Image } from "@heroui/react";
import { Icon } from "@iconify/react";

import { recipeMacroSummary, statusColor, statusLabel } from "./recipe-format";

interface RecipeCardProps {
  recipe: RecipeListItem;
  onOpen?: (id: string) => void;
}

export function RecipeCard({ recipe, onOpen }: RecipeCardProps) {
  const macros = recipeMacroSummary(recipe);
  const hasThumbnail =
    recipe.thumbnailUrl !== undefined &&
    recipe.thumbnailUrl !== null &&
    recipe.thumbnailUrl.length > 0;

  return (
    <Card
      className="bg-white border border-gray-200 shadow-sm"
      isPressable={onOpen !== undefined}
      onPress={() => onOpen?.(recipe.id)}
    >
      <CardBody className="p-0">
        <div className="flex items-center justify-center bg-slate-100 aspect-video w-full overflow-hidden">
          {hasThumbnail ? (
            <Image
              removeWrapper
              alt={recipe.name}
              className="h-full w-full object-cover"
              src={recipe.thumbnailUrl ?? ""}
            />
          ) : (
            <Icon
              className="text-slate-300"
              icon="solar:chef-hat-linear"
              width={48}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {recipe.name}
            </h3>
            <Chip color={statusColor(recipe.status)} size="sm" variant="flat">
              {statusLabel(recipe.status)}
            </Chip>
          </div>

          {recipe.meal_type_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.meal_type_tags.map((tag) => (
                <Chip key={tag} color="default" size="sm" variant="flat">
                  {tag}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-500">
            <span className="font-semibold text-gray-900">{macros.kcal}</span>
            <span>P {macros.protein}</span>
            <span>C {macros.carbs}</span>
            <span>G {macros.fat}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
