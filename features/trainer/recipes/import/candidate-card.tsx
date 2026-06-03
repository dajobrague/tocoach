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

          {/* New recipe's computed total — may be 0 until lines carry macros. */}
          <p className="text-xs font-medium text-gray-900">
            Total calculado: {formatCompactMacros(computed)}
          </p>

          {/* Original plan figure — display-only, visually muted + labelled. */}
          {hasStatedMacros(candidate.legacyStatedMacros) ? (
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
