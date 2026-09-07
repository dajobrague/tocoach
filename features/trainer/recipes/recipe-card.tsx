"use client";

import type { RecipeListItem } from "./recipe-query";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { statusColor, statusLabel } from "./recipe-format";

interface RecipeCardProps {
  recipe: RecipeListItem;
  onOpen?: (id: string) => void;
  onDelete?: (recipe: RecipeListItem) => void;
  /** Folder view only: opens the "Mover a carpeta" dialog. */
  onMove?: (recipe: RecipeListItem) => void;
}

/** Chips shown under the title before collapsing the rest into "+N". */
const MAX_VISIBLE_TAGS = 3;

export function RecipeCard({
  recipe,
  onOpen,
  onDelete,
  onMove,
}: RecipeCardProps) {
  const hasThumbnail =
    recipe.thumbnailUrl !== undefined &&
    recipe.thumbnailUrl !== null &&
    recipe.thumbnailUrl.length > 0;
  // Every chip is a tag (folders never show as chips).
  const tags = recipe.meal_type_tags.filter((tag) => tag.trim().length > 0);
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const extraCount = tags.length - visibleTags.length;

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

      {onMove !== undefined && (
        <Button
          isIconOnly
          aria-label={`Mover ${recipe.name} a otra carpeta`}
          className="absolute right-11 top-2 z-10 bg-white/90 text-default-600 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
          radius="full"
          size="sm"
          variant="light"
          onPress={() => onMove(recipe)}
        >
          <Icon icon="solar:folder-linear" width={16} />
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

          <div className="flex flex-col gap-1.5 p-4">
            <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
              {recipe.name}
            </h3>
            {/* Tags at a glance (Sep 2 call, JC): see which recipes in a
                folder meet a condition without opening the filter. */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {visibleTags.map((tag) => (
                  <Chip
                    key={tag}
                    className="min-w-0 max-w-[10rem]"
                    classNames={{ content: "truncate" }}
                    size="sm"
                    variant="flat"
                  >
                    {tag}
                  </Chip>
                ))}
                {extraCount > 0 && (
                  <Chip className="text-default-500" size="sm" variant="flat">
                    +{extraCount}
                  </Chip>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
