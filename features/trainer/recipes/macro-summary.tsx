"use client";

import type { RecipeDetail } from "./recipe-api";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { formatGrams, toNumber } from "./recipe-format";
import { formatMg } from "./recipe-macros";

interface MacroSummaryProps {
  recipe: RecipeDetail | undefined;
}

interface MacroBar {
  label: string;
  grams: number;
  kcalPerGram: number;
  barClass: string;
  dotClass: string;
}

interface MicroRow {
  label: string;
  value: string;
}

export function MacroSummary({ recipe }: MacroSummaryProps) {
  const kcal = toNumber(recipe?.kcal);

  const bars: MacroBar[] = [
    {
      label: "Proteína",
      grams: toNumber(recipe?.protein_g),
      kcalPerGram: 4,
      barClass: "bg-emerald-500",
      dotClass: "bg-emerald-500",
    },
    {
      label: "Carbohidratos",
      grams: toNumber(recipe?.carbs_g),
      kcalPerGram: 4,
      barClass: "bg-sky-500",
      dotClass: "bg-sky-500",
    },
    {
      label: "Grasa",
      grams: toNumber(recipe?.fat_g),
      kcalPerGram: 9,
      barClass: "bg-amber-500",
      dotClass: "bg-amber-500",
    },
  ];

  const micros: MicroRow[] = [
    { label: "Azúcar", value: formatGrams(recipe?.sugar_g) },
    { label: "Fibra", value: formatGrams(recipe?.fiber_g) },
    { label: "Grasa saturada", value: formatGrams(recipe?.sat_fat_g) },
    { label: "Sodio", value: formatMg(recipe?.sodium_mg) },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-5 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-emerald-600"
            icon="solar:chart-square-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Nutrición por porción
          </h3>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
            {Math.round(kcal)}
          </span>
          <span className="text-sm font-medium text-default-500">
            kcal por porción
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {bars.map((bar) => {
            const share = kcal > 0 ? (bar.grams * bar.kcalPerGram) / kcal : 0;
            const width = Math.min(100, Math.max(0, Math.round(share * 100)));

            return (
              <div key={bar.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-default-600">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${bar.dotClass}`}
                    />
                    {bar.label}
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {formatGrams(bar.grams)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${bar.barClass}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4">
          {micros.map((micro) => (
            <div key={micro.label} className="flex flex-col">
              <span className="text-xs text-default-500">{micro.label}</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {micro.value}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
