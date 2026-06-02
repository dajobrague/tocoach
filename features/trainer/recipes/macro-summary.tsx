"use client";

import type { RecipeDetail } from "./recipe-api";

import { Card, CardBody } from "@heroui/react";

import { formatGrams, formatKcal } from "./recipe-format";

interface MacroSummaryProps {
  recipe: RecipeDetail | undefined;
}

interface Row {
  label: string;
  value: string;
}

export function MacroSummary({ recipe }: MacroSummaryProps) {
  const rows: Row[] = [
    { label: "Calorías", value: formatKcal(recipe?.kcal) },
    { label: "Proteína", value: formatGrams(recipe?.protein_g) },
    { label: "Carbohidratos", value: formatGrams(recipe?.carbs_g) },
    { label: "Grasa", value: formatGrams(recipe?.fat_g) },
    { label: "Azúcar", value: formatGrams(recipe?.sugar_g) },
    { label: "Fibra", value: formatGrams(recipe?.fiber_g) },
    { label: "Grasa saturada", value: formatGrams(recipe?.sat_fat_g) },
    { label: "Sodio (mg)", value: formatGrams(recipe?.sodium_mg) },
  ];

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardBody className="gap-3 p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Totales por porción
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col">
              <span className="text-xs text-default-500">{row.label}</span>
              <span className="text-sm font-semibold text-gray-900">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
