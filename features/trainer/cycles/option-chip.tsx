"use client";

import type { SlotOption } from "./cycle-api";

import { Icon } from "@iconify/react";

import { optionKcal } from "./cycle-api";

interface OptionChipProps {
  option: SlotOption;
  onRemove: () => void;
}

/**
 * An assigned option. Name + kcal are read from the FROZEN `item_snapshot`, not
 * the live library — this is the visible proof of the §4.1 snapshot guarantee.
 */
export function OptionChip({ option, onRemove }: OptionChipProps) {
  const snapshot = option.item_snapshot;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1"
      data-option-id={option.id}
      data-testid="option-chip"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon
          className="shrink-0 text-default-400"
          icon={
            snapshot.sourceType === "recipe"
              ? "solar:chef-hat-linear"
              : "solar:cup-hot-linear"
          }
          width={14}
        />
        <span className="truncate text-xs text-gray-800">{snapshot.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className="text-xs font-medium text-default-500"
          data-testid="option-kcal"
        >
          {optionKcal(option)} kcal
        </span>
        <button
          aria-label={`Quitar ${snapshot.name}`}
          className="text-default-400 hover:text-danger"
          type="button"
          onClick={onRemove}
        >
          <Icon icon="solar:close-circle-linear" width={15} />
        </button>
      </div>
    </div>
  );
}
