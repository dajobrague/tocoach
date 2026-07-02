"use client";

import type { RecipeDetail } from "./recipe-api";

import { Card, CardBody, Chip } from "@heroui/react";

import { formatGrams, formatKcal } from "./recipe-format";
import { macroDescriptors } from "./recipe-macros";

interface RecipeSummaryStripProps {
  recipe: RecipeDetail;
}

interface Tile {
  label: string;
  value: string;
  accent: boolean;
}

export function RecipeSummaryStrip({ recipe }: RecipeSummaryStripProps) {
  const descriptors = macroDescriptors(recipe);
  const tiles: Tile[] = [
    { label: "Calorías", value: formatKcal(recipe.kcal), accent: true },
    { label: "Proteína", value: formatGrams(recipe.protein_g), accent: false },
    {
      label: "Carbohidratos",
      value: formatGrams(recipe.carbs_g),
      accent: false,
    },
    { label: "Grasa", value: formatGrams(recipe.fat_g), accent: false },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Resumen de la receta
          </h2>
          {descriptors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {descriptors.map((descriptor) => (
                <Chip
                  key={descriptor.label}
                  color={descriptor.tone}
                  size="sm"
                  variant="flat"
                >
                  {descriptor.label}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-gray-100 bg-gray-100 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={`flex flex-col gap-0.5 px-4 py-3 ${
                tile.accent ? "bg-emerald-50" : "bg-white"
              }`}
            >
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  tile.accent ? "text-emerald-700" : "text-gray-900"
                }`}
              >
                {tile.value}
              </span>
              <span className="text-xs font-medium text-default-500">
                {tile.label}
                {tile.accent ? " · por porción" : ""}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
