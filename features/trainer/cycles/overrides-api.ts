import type { OptionSelection } from "./cycle-api";
import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";
import type {
  OverrideRow,
  OverrideScope,
  OverrideType,
} from "@/lib/nutrition/cycles/override-types";

export type { OverrideRow, OverrideScope, OverrideType };

/** Scope choices for the authoring UI, in display order, clearly labelled. */
export const SCOPE_OPTIONS: { key: OverrideScope; label: string }[] = [
  { key: "single_day", label: "Solo este día" },
  { key: "day_forward", label: "Este día en adelante" },
  { key: "every_cycle", label: "Cada ciclo (este día de la rotación)" },
];

/** Spanish label for a scope (used in lists). */
export function scopeLabel(scope: OverrideScope): string {
  return SCOPE_OPTIONS.find((option) => option.key === scope)?.label ?? scope;
}

export interface OverrideFormInput {
  overrideType: OverrideType;
  scope: OverrideScope;
  /** The date the trainer selected ("YYYY-MM-DD"). */
  anchorDate: string;
  /** Rotation index of `anchorDate` — sent for every_cycle. */
  dayIndex: number | null;
  noteText?: string;
  slotId?: string;
  /** The swap source, as the picker drawer returns it. */
  swap?: OptionSelection;
}

/**
 * Map an authoring form to the create-override request body the API validates.
 * Pure — unit-tested for note/swap and the every_cycle day_index.
 */
export function buildCreateBody(
  input: OverrideFormInput
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    overrideType: input.overrideType,
    scope: input.scope,
    anchorDate: input.anchorDate,
  };

  if (input.scope === "every_cycle" && input.dayIndex !== null) {
    body.dayIndex = input.dayIndex;
  }

  if (input.overrideType === "note") {
    body.noteText = input.noteText ?? "";

    return body;
  }

  if (input.swap !== undefined && input.slotId !== undefined) {
    body.slotId = input.slotId;

    if (input.swap.kind === "recipe") {
      body.swapSourceType = "recipe";
      body.swapSourceRefId = input.swap.recipeId;
    } else {
      body.swapSourceType = "food";
      body.swapSourceRefId = input.swap.ingredientId;
      body.swapQuantity = input.swap.quantity;
    }
  }

  return body;
}

// ─── Fetch layer (mirrors cycle-api conventions) ────────────────────────────

class OverridesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OverridesApiError";
    this.status = status;
  }
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new OverridesApiError(data?.error ?? "Error de red", response.status);
  }

  return data.data as T;
}

const BASE = "/api/meal-cycles";

/** The full cycle tree (used to resolve the calendar). */
export function fetchCycleTreeFull(cycleId: string): Promise<MealCycleTree> {
  return fetch(`${BASE}/${cycleId}`, {
    credentials: "same-origin",
    cache: "no-store",
  }).then(readEnvelope<MealCycleTree>);
}

export function listOverrides(cycleId: string): Promise<OverrideRow[]> {
  return fetch(`${BASE}/${cycleId}/overrides`, {
    credentials: "same-origin",
    cache: "no-store",
  }).then(readEnvelope<OverrideRow[]>);
}

export function createOverride(
  cycleId: string,
  input: OverrideFormInput
): Promise<OverrideRow> {
  return fetch(`${BASE}/${cycleId}/overrides`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCreateBody(input)),
  }).then(readEnvelope<OverrideRow>);
}

export function deleteOverride(
  cycleId: string,
  overrideId: string
): Promise<OverrideRow> {
  return fetch(`${BASE}/${cycleId}/overrides/${overrideId}`, {
    method: "DELETE",
    credentials: "same-origin",
  }).then(readEnvelope<OverrideRow>);
}

export function updateOverride(
  cycleId: string,
  overrideId: string,
  patch: Record<string, unknown>
): Promise<OverrideRow> {
  return fetch(`${BASE}/${cycleId}/overrides/${overrideId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then(readEnvelope<OverrideRow>);
}
