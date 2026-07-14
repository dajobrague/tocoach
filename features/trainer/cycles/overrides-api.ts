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
  { key: "every_cycle", label: "Cada repetición del plan (este día)" },
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
  /** The swap replacement — one or more items, as the picker returns them. */
  swapItems?: OptionSelection[];
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

  if (
    input.swapItems !== undefined &&
    input.swapItems.length > 0 &&
    input.slotId !== undefined
  ) {
    body.slotId = input.slotId;
    body.swapItems = input.swapItems.map((selection) =>
      selection.kind === "recipe"
        ? {
            swapSourceType: "recipe",
            swapSourceRefId: selection.recipeId,
            ...(selection.quantities !== undefined
              ? { quantities: selection.quantities }
              : {}),
          }
        : {
            swapSourceType: "food",
            swapSourceRefId: selection.ingredientId,
            swapQuantity: selection.quantity,
          }
    );
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

/** What the client actually did — for the retrospective calendar. */
export interface ClientActivity {
  /** Date ("YYYY-MM-DD") → menu (day index) the client chose to follow. */
  choices: Record<string, number>;
  /** The client's current standing alternative picks (slotId → optionId). */
  selections: Record<string, string>;
}

export function fetchClientActivity(
  cycleId: string,
  from: string,
  to: string
): Promise<ClientActivity> {
  return fetch(
    `${BASE}/${cycleId}/client-activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "same-origin", cache: "no-store" }
  ).then(readEnvelope<ClientActivity>);
}
