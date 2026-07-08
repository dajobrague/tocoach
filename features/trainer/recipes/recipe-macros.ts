import { toNumber } from "./recipe-format";

/** Milligrams rounded to a whole number (e.g. "370 mg"). */
export function formatMg(value: unknown): string {
  return `${Math.round(toNumber(value))} mg`;
}

/** "1 ingrediente" / "N ingredientes". */
export function ingredientCountLabel(count: number): string {
  return `${count} ${count === 1 ? "ingrediente" : "ingredientes"}`;
}

export type DescriptorTone = "success" | "primary" | "secondary";

export interface MacroDescriptor {
  label: string;
  tone: DescriptorTone;
}

interface MacroInput {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// Qualitative "at-a-glance" tags computed from each macro's share of total
// energy (4 kcal/g protein & carbs, 9 kcal/g fat). Thresholds are deliberately
// simple — they give the coach a fast read, not a clinical claim.
export function macroDescriptors(macros: MacroInput): MacroDescriptor[] {
  const kcal = toNumber(macros.kcal);

  if (kcal <= 0) return [];

  const proteinShare = (toNumber(macros.protein_g) * 4) / kcal;
  const carbShare = (toNumber(macros.carbs_g) * 4) / kcal;
  const fatShare = (toNumber(macros.fat_g) * 9) / kcal;
  const tags: MacroDescriptor[] = [];

  if (proteinShare >= 0.3)
    tags.push({ label: "Alto en proteína", tone: "success" });
  if (carbShare <= 0.2) tags.push({ label: "Bajo en carbos", tone: "primary" });
  if (fatShare <= 0.25)
    tags.push({ label: "Bajo en grasa", tone: "secondary" });

  return tags;
}

export interface ChecklistInput {
  hasName: boolean;
  ingredientCount: number;
  kcal: number;
  hasInstructions: boolean;
  hasPhoto: boolean;
}

export interface ChecklistItem {
  id: "name" | "ingredients" | "nutrition" | "instructions" | "photo";
  label: string;
  done: boolean;
  /** Optional items are recommended but do not block publishing. */
  optional: boolean;
}

export interface PublishChecklist {
  items: ChecklistItem[];
  ready: boolean;
}

// Gates the publish button. Name, an ingredient, and computed nutrition are
// required to publish; a photo and instructions are recommended.
export function publishChecklist(input: ChecklistInput): PublishChecklist {
  const items: ChecklistItem[] = [
    {
      id: "name",
      label: "Nombre agregado",
      done: input.hasName,
      optional: false,
    },
    {
      id: "ingredients",
      label: "Al menos 1 ingrediente",
      done: input.ingredientCount > 0,
      optional: false,
    },
    {
      id: "nutrition",
      label: "Nutrición calculada",
      done: toNumber(input.kcal) > 0,
      optional: false,
    },
    {
      id: "photo",
      label: "Foto de la receta",
      done: input.hasPhoto,
      optional: true,
    },
    {
      id: "instructions",
      label: "Instrucciones de preparación",
      done: input.hasInstructions,
      optional: true,
    },
  ];
  const ready = items
    .filter((item) => item.optional === false)
    .every((item) => item.done);

  return { items, ready };
}
