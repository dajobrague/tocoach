// ─── Client-side shapes (mirror the meal-cycles API responses) ──────────────

export type CycleStatus = "draft" | "active" | "archived";

export interface OptionTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  [key: string]: number;
}

export interface OptionSnapshot {
  sourceType: "recipe" | "food";
  sourceRefId: string;
  name: string;
  steps: string | null;
  images: { url: string; orientation: "vertical" | "horizontal" | null }[];
  ingredients: { name: string; quantity: number; unit: string }[];
  totals: OptionTotals;
}

export interface SlotOption {
  id: string;
  slot_id: string;
  source_type: "recipe" | "food";
  source_ref_id: string;
  position: number;
  item_snapshot: OptionSnapshot;
}

export interface CycleSlot {
  id: string;
  cycle_id: string;
  day_index: number;
  label: string;
  position: number;
  options: SlotOption[];
}

export interface CycleSummary {
  id: string;
  name: string;
  client_id: number;
  duration_days: number;
  start_date: string;
  status: CycleStatus;
}

export interface CycleTree extends CycleSummary {
  slots: CycleSlot[];
}

export interface RecipeHit {
  id: string;
  name: string;
  kcal: number;
}

export interface FoodHit {
  id?: string;
  name: string;
  nutrientsPer100g: Record<string, number>;
}

/** Selection coming back from the picker drawer. */
export type OptionSelection =
  | { kind: "recipe"; recipeId: string }
  | { kind: "food"; ingredientId: string; quantity: number };

// ─── Pure helpers (unit-tested) ─────────────────────────────────────────────

export interface DayGroup {
  dayIndex: number;
  slots: CycleSlot[];
}

/** Group slots into one bucket per day (0..duration-1), each ordered by position. */
export function groupSlotsByDay(
  slots: CycleSlot[],
  durationDays: number
): DayGroup[] {
  const days: DayGroup[] = Array.from(
    { length: Math.max(0, durationDays) },
    (_, dayIndex) => ({ dayIndex, slots: [] })
  );

  for (const slot of slots) {
    const bucket = days[slot.day_index];

    if (bucket !== undefined) bucket.slots.push(slot);
  }

  for (const day of days) {
    day.slots.sort((a, b) => a.position - b.position);
  }

  return days;
}

/** Rounded kcal of an option, read from its frozen snapshot (never the library). */
export function optionKcal(option: SlotOption): number {
  return Math.round(Number(option.item_snapshot?.totals?.kcal) || 0);
}

/**
 * Resolve an inline slot relabel: trims the input, and returns the patch to
 * persist — or `null` when nothing should be saved (empty input falls back to
 * the previous value; an unchanged value is a no-op).
 */
export function resolveRelabel(
  next: string,
  previous: string
): { label: string } | null {
  const trimmed = next.trim();

  if (trimmed.length === 0 || trimmed === previous) {
    return null;
  }

  return { label: trimmed };
}

/** Body for POST .../options, from a picker selection. */
export function buildAddOptionBody(
  selection: OptionSelection
): Record<string, unknown> {
  if (selection.kind === "recipe") {
    return { source_type: "recipe", recipe_id: selection.recipeId };
  }

  return {
    source_type: "food",
    ingredient_id: selection.ingredientId,
    quantity: selection.quantity,
  };
}

// ─── Fetch layer ────────────────────────────────────────────────────────────

/** Carries the HTTP status so callers can branch (e.g. 409 active conflict). */
export class CycleApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CycleApiError";
    this.status = status;
  }
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new CycleApiError(data?.error ?? "Error de red", response.status);
  }

  return data.data as T;
}

function getJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(
    readEnvelope<T>
  );
}

function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(readEnvelope<T>);
}

const BASE = "/api/meal-cycles";

export function listCycles(clientId: number): Promise<CycleSummary[]> {
  return getJson<CycleSummary[]>(`${BASE}?clientId=${clientId}`);
}

export function fetchCycleTree(cycleId: string): Promise<CycleTree> {
  return getJson<CycleTree>(`${BASE}/${cycleId}`);
}

export function createCycle(input: {
  clientId: number;
  name: string;
  durationDays: number;
  startDate?: string;
}): Promise<CycleSummary> {
  return sendJson<CycleSummary>(BASE, "POST", {
    client_id: input.clientId,
    name: input.name,
    duration_days: input.durationDays,
    ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
  });
}

export function updateCycle(
  cycleId: string,
  patch: { status?: CycleStatus; durationDays?: number; startDate?: string }
): Promise<CycleSummary> {
  const body: Record<string, unknown> = {};

  if (patch.status !== undefined) body.status = patch.status;
  if (patch.durationDays !== undefined) body.duration_days = patch.durationDays;
  if (patch.startDate !== undefined) body.start_date = patch.startDate;

  return sendJson<CycleSummary>(`${BASE}/${cycleId}`, "PATCH", body);
}

export function addSlot(
  cycleId: string,
  input: { dayIndex: number; label?: string; position?: number }
): Promise<CycleSlot> {
  return sendJson<CycleSlot>(`${BASE}/${cycleId}/slots`, "POST", {
    day_index: input.dayIndex,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
  });
}

export function updateSlot(
  cycleId: string,
  slotId: string,
  patch: { position?: number; label?: string; dayIndex?: number }
): Promise<CycleSlot> {
  const body: Record<string, unknown> = {};

  if (patch.position !== undefined) body.position = patch.position;
  if (patch.label !== undefined) body.label = patch.label;
  if (patch.dayIndex !== undefined) body.day_index = patch.dayIndex;

  return sendJson<CycleSlot>(
    `${BASE}/${cycleId}/slots/${slotId}`,
    "PATCH",
    body
  );
}

export function deleteSlot(
  cycleId: string,
  slotId: string
): Promise<CycleSlot> {
  return sendJson<CycleSlot>(`${BASE}/${cycleId}/slots/${slotId}`, "DELETE");
}

export function addOption(
  cycleId: string,
  slotId: string,
  selection: OptionSelection
): Promise<SlotOption> {
  return sendJson<SlotOption>(
    `${BASE}/${cycleId}/slots/${slotId}/options`,
    "POST",
    buildAddOptionBody(selection)
  );
}

export function deleteOption(
  cycleId: string,
  slotId: string,
  optionId: string
): Promise<SlotOption> {
  return sendJson<SlotOption>(
    `${BASE}/${cycleId}/slots/${slotId}/options/${optionId}`,
    "DELETE"
  );
}

export function searchRecipes(query: string): Promise<RecipeHit[]> {
  return getJson<RecipeHit[]>(`/api/recipes?q=${encodeURIComponent(query)}`);
}

export function searchFoods(query: string): Promise<FoodHit[]> {
  return getJson<FoodHit[]>(`/api/foods/search?q=${encodeURIComponent(query)}`);
}
