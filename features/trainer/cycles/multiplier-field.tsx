"use client";

import { Input } from "@heroui/react";
import { useState } from "react";

interface MultiplierFieldProps {
  ariaLabel: string;
  /** Effective multiplier derived from the current amount (amount ÷ base). */
  value: number;
  disabled?: boolean;
  onCommit: (multiplier: number) => void;
}

/**
 * Free numeric per-ingredient multiplier, linked both ways with the amount
 * input beside it: committing a multiplier rescales the amount, and editing
 * the amount re-derives the multiplier shown here. A local draft keeps
 * in-progress decimals ("1.", "0,7" mid-typing) from being clobbered by the
 * derived value on each render; the draft clears on blur.
 */
export function MultiplierField({
  ariaLabel,
  value,
  disabled = false,
  onCommit,
}: MultiplierFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      aria-label={ariaLabel}
      className="w-[4.5rem]"
      isDisabled={disabled}
      min={0}
      size="sm"
      startContent={<span className="text-xs text-default-400">×</span>}
      step={0.1}
      type="number"
      value={draft ?? String(value)}
      variant="bordered"
      onBlur={() => setDraft(null)}
      onValueChange={(next) => {
        setDraft(next);
        const parsed = Number(next);

        if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
      }}
    />
  );
}
