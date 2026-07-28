"use client";

import type { NutritionSection } from "@/lib/nutrition/delivery-visibility";

import { Select, SelectItem, type SharedSelection } from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  useClientGoals,
  useClientVisibility,
  useDietPdf,
  useGoalPresets,
  useSaveClientVisibility,
} from "./use-cycles";

import { NUTRITION_SECTIONS } from "@/lib/nutrition/delivery-visibility";

const SECTION_META: Record<
  NutritionSection,
  { label: string; icon: string; missing: string }
> = {
  plan: {
    label: "Plan de comidas",
    icon: "solar:clipboard-list-linear",
    missing: "sin plan activo",
  },
  pdf: {
    label: "Dieta PDF",
    icon: "solar:document-text-linear",
    missing: "sin PDF subido",
  },
  goals: {
    label: "Objetivos",
    icon: "solar:target-linear",
    missing: "sin objetivos guardados",
  },
};

/**
 * "Qué ve el cliente" — the trainer picks which nutrition sections the client's
 * Nutrición page shows (any combination), from the Jul-15 call. Empty selection
 * is "Automático": the delivery ladder (plan → PDF → objetivos) keeps deciding.
 * Sections without data can't be newly chosen (they'd render nothing), but an
 * already-saved choice stays togglable so it can be cleaned up.
 */
export function VisibilitySelect({
  clientId,
  hasActivePlan,
}: {
  clientId: number;
  hasActivePlan: boolean;
}) {
  const { data, isPending } = useClientVisibility(clientId);
  const save = useSaveClientVisibility(clientId);
  const { data: pdf } = useDietPdf(clientId);
  const { data: goals } = useClientGoals(clientId);
  const { data: presets } = useGoalPresets(clientId);

  const selected = data?.sections ?? [];
  const available: Record<NutritionSection, boolean> = {
    plan: hasActivePlan,
    pdf: pdf !== null && pdf !== undefined,
    goals: (goals ?? null) !== null || (presets ?? []).length > 0,
  };
  // Unavailable sections are locked out unless already chosen (still
  // removable); HeroUI wants the keys that are NOT selectable.
  const disabledKeys = NUTRITION_SECTIONS.filter(
    (section) =>
      available[section] === false && selected.includes(section) === false
  );

  function onChange(keys: SharedSelection): void {
    const next = NUTRITION_SECTIONS.filter(
      (section) => keys !== "all" && keys.has(section)
    );

    save.mutate(next.length === 0 ? null : next);
  }

  return (
    <Select
      aria-label="Qué ve el cliente"
      className="w-full sm:max-w-xs"
      disabledKeys={disabledKeys}
      isDisabled={isPending}
      isLoading={save.isPending}
      label="Qué ve el cliente"
      placeholder="Automático (según datos)"
      renderValue={(items) =>
        items.length === 0
          ? "Automático (según datos)"
          : items
              .map((item) => SECTION_META[item.key as NutritionSection].label)
              .join(" + ")
      }
      selectedKeys={new Set(selected)}
      selectionMode="multiple"
      size="sm"
      startContent={
        <Icon className="text-default-400" icon="solar:eye-linear" width={16} />
      }
      variant="bordered"
      onSelectionChange={onChange}
    >
      {NUTRITION_SECTIONS.map((section) => (
        <SelectItem
          key={section}
          {...(available[section]
            ? {}
            : { description: SECTION_META[section].missing })}
          startContent={
            <Icon
              className="text-default-400"
              icon={SECTION_META[section].icon}
              width={16}
            />
          }
          textValue={SECTION_META[section].label}
        >
          {SECTION_META[section].label}
        </SelectItem>
      ))}
    </Select>
  );
}
