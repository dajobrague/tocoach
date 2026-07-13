"use client";

import type { RecipeCandidate } from "./import-api";

import { Card, CardBody, Checkbox, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  computeCandidateMacros,
  formatCompactMacros,
  hasStatedMacros,
} from "./import-api";

interface CandidateCardProps {
  candidate: RecipeCandidate;
  selected: boolean;
  imported: boolean;
  onToggle: (legacyOptionId: string) => void;
}

export function CandidateCard({
  candidate,
  selected,
  imported,
  onToggle,
}: CandidateCardProps) {
  const computed = computeCandidateMacros(candidate.ingredients);
  const ingredientCount = candidate.ingredients.length;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-row items-start gap-3 p-4">
        <Checkbox
          aria-label={`Seleccionar ${candidate.name}`}
          className="mt-1"
          isDisabled={imported}
          isSelected={selected}
          onValueChange={() => onToggle(candidate.legacyOptionId)}
        />

        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
          <Icon
            className="text-slate-300"
            icon="solar:chef-hat-linear"
            width={28}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {candidate.name}
            </h3>
            {imported ? (
              <Chip
                color="success"
                size="sm"
                startContent={
                  <Icon icon="solar:check-circle-bold" width={14} />
                }
                variant="flat"
              >
                Importada
              </Chip>
            ) : null}
          </div>

          <p className="text-xs text-default-500">
            {ingredientCount}{" "}
            {ingredientCount === 1 ? "ingrediente" : "ingredientes"}
          </p>

          {/* The total the imported recipe will carry. */}
          <p className="text-xs font-medium text-gray-900">
            Total: {formatCompactMacros(computed)}
            {candidate.macrosSource === "stated" ? (
              <span className="ml-1.5 font-normal text-default-400">
                (del plan original · reparto por ingrediente estimado)
              </span>
            ) : null}
          </p>

          {candidate.macrosSource === "none" ? (
            <p className="flex items-center gap-1 text-xs text-warning-600">
              <Icon
                aria-hidden
                icon="solar:danger-triangle-linear"
                width={13}
              />
              El plan antiguo no tenía macros para esta receta — añádelos tras
              importar.
            </p>
          ) : null}

          {/* Original plan figure, when it differs from what we computed —
              with the distribution they normally match exactly. */}
          {candidate.macrosSource === "lines" &&
          hasStatedMacros(candidate.legacyStatedMacros) ? (
            <p className="flex items-center gap-1 text-xs italic text-default-400">
              <Icon aria-hidden icon="solar:document-text-linear" width={13} />
              Plan original: {formatCompactMacros(candidate.legacyStatedMacros)}
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
