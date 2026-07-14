"use client";

import type { RecipeListItem } from "./recipe-query";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { statusColor, statusLabel } from "./recipe-format";

interface RecipeCardProps {
  recipe: RecipeListItem;
  onOpen?: (id: string) => void;
  onDelete?: (recipe: RecipeListItem) => void;
}

export function RecipeCard({ recipe, onOpen, onDelete }: RecipeCardProps) {
  const hasThumbnail =
    recipe.thumbnailUrl !== undefined &&
    recipe.thumbnailUrl !== null &&
    recipe.thumbnailUrl.length > 0;

  return (
    <div className="group relative h-full">
      {/* Sibling overlay (not inside the pressable Card) so deleting never
          triggers the card's open-on-press. */}
      {onDelete !== undefined && (
        <Button
          isIconOnly
          aria-label={`Eliminar ${recipe.name}`}
          className="absolute right-2 top-2 z-10 bg-white/90 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
          color="danger"
          radius="full"
          size="sm"
          variant="light"
          onPress={() => onDelete(recipe)}
        >
          <Icon icon="solar:trash-bin-trash-linear" width={17} />
        </Button>
      )}

      <Card
        className="h-full w-full overflow-hidden border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        isPressable={onOpen !== undefined}
        onPress={() => onOpen?.(recipe.id)}
      >
        <CardBody className="p-0">
          {/* Fixed height (not aspect-ratio) so every thumbnail — image or
              placeholder — is exactly the same size. */}
          <div className="relative h-40 w-full shrink-0 overflow-hidden bg-slate-100">
            {hasThumbnail ? (
              // Absolute-fill so any aspect ratio is cropped to the box.
              // Plain <img>: recipe media hosts aren't allowlisted in next.config.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={recipe.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                src={recipe.thumbnailUrl ?? ""}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon
                  className="text-slate-300"
                  icon="solar:chef-hat-linear"
                  width={44}
                />
              </div>
            )}

            <Chip
              className="absolute left-2 top-2 shadow-sm"
              color={statusColor(recipe.status)}
              size="sm"
              variant="solid"
            >
              {statusLabel(recipe.status)}
            </Chip>
          </div>

          <div className="p-4">
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
              {recipe.name}
            </h3>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
