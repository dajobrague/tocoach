"use client";

import type {
  RecipeDetail,
  RecipeIngredientItem,
  RecipeMediaItem,
} from "./recipe-api";

import {
  Chip,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  formatGrams,
  formatKcal,
  statusColor,
  statusLabel,
} from "./recipe-format";

interface RecipePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: RecipeDetail;
  ingredients: RecipeIngredientItem[];
  media: RecipeMediaItem[];
}

export function RecipePreviewModal({
  isOpen,
  onClose,
  recipe,
  ingredients,
  media,
}: RecipePreviewModalProps) {
  const cover = media.find((item) => item.type === "image");
  const macros = [
    { label: "Calorías", value: formatKcal(recipe.kcal) },
    { label: "Proteína", value: formatGrams(recipe.protein_g) },
    { label: "Carbos", value: formatGrams(recipe.carbs_g) },
    { label: "Grasa", value: formatGrams(recipe.fat_g) },
  ];

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="lg" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-sm font-medium text-default-500">
          <Icon icon="solar:eye-linear" width={18} />
          Vista previa
        </ModalHeader>
        <ModalBody className="gap-5 pb-6">
          {cover && (
            <Image
              removeWrapper
              alt={recipe.name}
              className="h-48 w-full rounded-large object-cover"
              src={cover.url}
            />
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
              <Chip color={statusColor(recipe.status)} size="sm" variant="flat">
                {statusLabel(recipe.status)}
              </Chip>
            </div>
            {recipe.meal_type_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recipe.meal_type_tags.map((tag) => (
                  <Chip key={tag} size="sm" variant="flat">
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
            {recipe.description !== null && recipe.description.length > 0 && (
              <p className="text-sm text-default-600">{recipe.description}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-large border border-gray-100 bg-gray-100">
            {macros.map((macro) => (
              <div
                key={macro.label}
                className="flex flex-col items-center gap-0.5 bg-white px-2 py-3 text-center"
              >
                <span className="text-base font-bold text-gray-900 tabular-nums">
                  {macro.value}
                </span>
                <span className="text-[11px] text-default-500">
                  {macro.label}
                </span>
              </div>
            ))}
          </div>

          {ingredients.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Ingredientes
              </h3>
              <ul className="flex flex-col gap-1">
                {ingredients.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-sm text-gray-900"
                  >
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-default-300" />
                    {item.name_snapshot}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.instructions !== null && recipe.instructions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Preparación
              </h3>
              <p className="whitespace-pre-line text-sm text-default-600">
                {recipe.instructions}
              </p>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
