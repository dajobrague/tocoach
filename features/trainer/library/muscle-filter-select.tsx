"use client";

import { Select, SelectItem, SelectSection } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MUSCLE_REGIONS, MUSCLES } from "@/lib/training/muscles";

/** "" = every exercise, "none" = still without a primary muscle. */
export type MuscleFilter = string;

interface MuscleFilterSelectProps {
  value: MuscleFilter;
  onChange: (value: MuscleFilter) => void;
  /** Strength exercises with no primary muscle yet, shown on that option. */
  missingCount: number;
  className?: string;
}

/** Library filter by worked muscle (primary or secondary), Oct 14 call, JC. */
export function MuscleFilterSelect({
  value,
  onChange,
  missingCount,
  className = "sm:max-w-[240px]",
}: MuscleFilterSelectProps) {
  const sections = [
    <SelectSection key="state" showDivider>
      <SelectItem key="none" textValue="Sin músculos">
        {`Sin músculos${missingCount > 0 ? ` (${missingCount})` : ""}`}
      </SelectItem>
    </SelectSection>,
    ...MUSCLE_REGIONS.map((region) => (
      <SelectSection key={region} title={region}>
        {MUSCLES.filter((m) => m.region === region).map((m) => (
          <SelectItem key={m.id}>{m.label}</SelectItem>
        ))}
      </SelectSection>
    )),
  ];

  return (
    <Select
      aria-label="Filtrar por músculo"
      className={className}
      placeholder="Todos los músculos"
      selectedKeys={value ? [value] : []}
      startContent={
        <Icon className="text-default-400" icon="solar:body-bold" width={16} />
      }
      variant="bordered"
      onSelectionChange={(keys) => {
        const [key] = keys === "all" ? [] : Array.from(keys);

        onChange(key === undefined ? "" : String(key));
      }}
    >
      {sections}
    </Select>
  );
}
