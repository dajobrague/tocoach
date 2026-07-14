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
  /** Recipe-wide notes frozen with the option (absent on legacy rows). */
  description?: string | null;
  /** Trainer's per-client note about this option (absent on legacy rows). */
  trainerComment?: string | null;
  images: { url: string; orientation: "vertical" | "horizontal" | null }[];
  ingredients: {
    name: string;
    /** Frozen product brand; null/absent for raw or legacy lines. */
    brand?: string | null;
    quantity: number;
    unit: string;
    /** Grams per piece for `unit === "u"`; null for g/ml/lt. */
    gramsPerUnit: number | null;
  }[];
  totals: OptionTotals;
}

export interface SlotOption {
  id: string;
  slot_id: string;
  source_type: "recipe" | "food";
  source_ref_id: string;
  position: number;
  /** Component within the slot: same value = alternatives; different = separate
   *  components that sum toward the meal. Defaults to 0 for legacy rows. */
  group_index: number;
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
  /** Day index (string key) → goal preset id. Absent on older rows. */
  day_targets?: Record<string, string>;
  /** Day index (string key) → menu display name. Absent on older rows. */
  day_names?: Record<string, string>;
}

export interface RecipeHit {
  id: string;
  name: string;
  kcal: number;
}

export interface FoodHit {
  id?: string;
  /** Originating source; only "off" foods have serving data to enrich. */
  source?: "off" | "manual" | "seed";
  name: string;
  brand?: string;
  imageUrl?: string;
  /** Serving label from the package ("2 rebanadas (60 g)"); display-only. */
  servingSize?: string;
  /** One serving in {@link servingQuantityUnit}; absent until enriched. */
  servingQuantity?: number;
  servingQuantityUnit?: "g" | "ml";
  nutrientsPer100g: Record<string, number>;
}

/** Selection coming back from the picker drawer. `groupIndex` targets a meal
 *  component (omit/0 for a new meal's first component). */
export type OptionSelection =
  | {
      kind: "recipe";
      recipeId: string;
      quantities?: number[];
      groupIndex?: number;
      /** Trainer's per-client note about this option. */
      trainerComment?: string;
    }
  | {
      kind: "food";
      ingredientId: string;
      quantity: number;
      groupIndex?: number;
      trainerComment?: string;
    };

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

/**
 * Permutation for moving the day at `from` to `to` across `n` days: returns an
 * array where `result[oldIndex]` is that day's new index. Used to optimistically
 * renumber slots (and follow the selected day) before the server confirms.
 */
export function dayReorderMapping(
  n: number,
  from: number,
  to: number
): number[] {
  const order = Array.from({ length: n }, (_, i) => i);

  order.splice(from, 1);
  order.splice(to, 0, from);

  const newIndexByOld = new Array<number>(n);

  order.forEach((oldIndex, newIndex) => {
    newIndexByOld[oldIndex] = newIndex;
  });

  return newIndexByOld;
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
    const body: Record<string, unknown> = {
      source_type: "recipe",
      recipe_id: selection.recipeId,
    };

    if (selection.quantities !== undefined)
      body.quantities = selection.quantities;
    // 0 is the default component; only send it for additional components so the
    // base add flow works before the group_index migration is applied.
    if (selection.groupIndex !== undefined && selection.groupIndex > 0)
      body.group_index = selection.groupIndex;
    if (selection.trainerComment !== undefined)
      body.trainer_comment = selection.trainerComment;

    return body;
  }

  const body: Record<string, unknown> = {
    source_type: "food",
    ingredient_id: selection.ingredientId,
    quantity: selection.quantity,
  };

  if (selection.groupIndex !== undefined)
    body.group_index = selection.groupIndex;
  if (selection.trainerComment !== undefined)
    body.trainer_comment = selection.trainerComment;

  return body;
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
  method: "POST" | "PATCH" | "PUT" | "DELETE",
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
  patch: {
    name?: string;
    status?: CycleStatus;
    durationDays?: number;
    startDate?: string;
  }
): Promise<CycleSummary> {
  const body: Record<string, unknown> = {};

  if (patch.name !== undefined) body.name = patch.name;
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

/** Replace `targetDayIndex` with a copy of `sourceDayIndex` (verbatim options). */
export function copyDay(
  cycleId: string,
  sourceDayIndex: number,
  targetDayIndex: number
): Promise<void> {
  return sendJson<void>(`${BASE}/${cycleId}/copy-day`, "POST", {
    source_day_index: sourceDayIndex,
    target_day_index: targetDayIndex,
  });
}

/** Drop a day; the later days renumber down (no gaps). */
export function removeDay(cycleId: string, dayIndex: number): Promise<void> {
  return sendJson<void>(`${BASE}/${cycleId}/remove-day`, "POST", {
    day_index: dayIndex,
  });
}

/** Append a day at the end — blank, or seeded from a copy of `copyFromDayIndex`. */
export function addDay(
  cycleId: string,
  copyFromDayIndex?: number
): Promise<void> {
  return sendJson<void>(
    `${BASE}/${cycleId}/add-day`,
    "POST",
    copyFromDayIndex !== undefined
      ? { copy_from_day_index: copyFromDayIndex }
      : {}
  );
}

/** Move the day at `fromIndex` to `toIndex`; the days in between renumber. */
export function reorderDay(
  cycleId: string,
  fromIndex: number,
  toIndex: number
): Promise<void> {
  return sendJson<void>(`${BASE}/${cycleId}/reorder-day`, "POST", {
    from_index: fromIndex,
    to_index: toIndex,
  });
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

/** Re-portion an option for this client: new grams per ingredient (by order).
 *  `trainerComment` (when provided) replaces the per-client note; "" clears it. */
export function updateOptionPortions(
  cycleId: string,
  slotId: string,
  optionId: string,
  quantities: number[],
  trainerComment?: string
): Promise<SlotOption> {
  return sendJson<SlotOption>(
    `${BASE}/${cycleId}/slots/${slotId}/options/${optionId}`,
    "PATCH",
    {
      quantities,
      ...(trainerComment !== undefined
        ? { trainer_comment: trainerComment }
        : {}),
    }
  );
}

/** One line of a per-client ingredient rewrite: keep an existing snapshot line
 *  (by index, possibly re-portioned) or add a raw food (grams). Lines not
 *  listed are removed. */
export type OptionIngredientEdit =
  | { kind: "keep"; index: number; quantity: number }
  | { kind: "add"; ingredientId: string; quantity: number };

/** Rewrite an option's ingredient list for this client (add/remove/re-portion).
 *  `trainerComment` (when provided) replaces the per-client note; "" clears it. */
export function updateOptionIngredients(
  cycleId: string,
  slotId: string,
  optionId: string,
  edits: OptionIngredientEdit[],
  trainerComment?: string
): Promise<SlotOption> {
  return sendJson<SlotOption>(
    `${BASE}/${cycleId}/slots/${slotId}/options/${optionId}`,
    "PATCH",
    {
      ingredients: edits.map((edit) =>
        edit.kind === "keep"
          ? { kind: "keep", index: edit.index, quantity: edit.quantity }
          : {
              kind: "add",
              ingredient_id: edit.ingredientId,
              quantity: edit.quantity,
            }
      ),
      ...(trainerComment !== undefined
        ? { trainer_comment: trainerComment }
        : {}),
    }
  );
}

/** A client's daily nutrition targets (kcal + macros). Same shape as MacroTotals. */
export interface NutritionGoals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** The client's saved goals, or null when they have none (use app defaults). */
export function fetchClientGoals(
  clientId: number
): Promise<NutritionGoals | null> {
  return getJson<NutritionGoals | null>(
    `/api/nutrition-goals?clientId=${clientId}`
  );
}

/** Create or replace the client's daily goals. */
export function saveClientGoals(
  clientId: number,
  goals: NutritionGoals
): Promise<NutritionGoals> {
  return sendJson<NutritionGoals>("/api/nutrition-goals", "PUT", {
    client_id: clientId,
    ...goals,
  });
}

/** A named daily objective (e.g. "Día de entrenamiento") for one client. */
export interface GoalPreset extends NutritionGoals {
  id: string;
  name: string;
}

export function listGoalPresets(clientId: number): Promise<GoalPreset[]> {
  return getJson<GoalPreset[]>(`/api/goal-presets?clientId=${clientId}`);
}

export function createGoalPreset(
  clientId: number,
  input: { name: string } & NutritionGoals
): Promise<GoalPreset> {
  return sendJson<GoalPreset>("/api/goal-presets", "POST", {
    client_id: clientId,
    ...input,
  });
}

export function updateGoalPreset(
  presetId: string,
  input: { name: string } & NutritionGoals
): Promise<GoalPreset> {
  return sendJson<GoalPreset>(`/api/goal-presets/${presetId}`, "PATCH", {
    ...input,
  });
}

export function deleteGoalPreset(presetId: string): Promise<void> {
  return sendJson<void>(`/api/goal-presets/${presetId}`, "DELETE");
}

/** Name one day of the plan ("Día de entreno"); empty name clears it. */
export function renameDay(
  cycleId: string,
  dayIndex: number,
  name: string
): Promise<{ day_names: Record<string, string> }> {
  return sendJson<{ day_names: Record<string, string> }>(
    `${BASE}/${cycleId}/day-name`,
    "PUT",
    { day_index: dayIndex, name }
  );
}

/** Assign a goal preset to one day of the plan (null → default goals). */
export function assignDayTarget(
  cycleId: string,
  dayIndex: number,
  presetId: string | null
): Promise<{ day_targets: Record<string, string> }> {
  return sendJson<{ day_targets: Record<string, string> }>(
    `${BASE}/${cycleId}/day-target`,
    "PUT",
    { day_index: dayIndex, preset_id: presetId }
  );
}

/** The client's PDF diet as the trainer sees it (legacy = read-only origin). */
export interface DietPdfInfo {
  url: string;
  name: string;
  source: "v2" | "legacy";
}

export function fetchDietPdf(clientId: number): Promise<DietPdfInfo | null> {
  return getJson<DietPdfInfo | null>(`/api/diet-pdf?clientId=${clientId}`);
}

/** Upload/replace the client's PDF diet (multipart; 20MB server cap). */
export function uploadDietPdf(
  clientId: number,
  file: File
): Promise<DietPdfInfo> {
  const body = new FormData();

  body.set("clientId", String(clientId));
  body.set("pdf", file);

  return fetch("/api/diet-pdf", {
    method: "POST",
    credentials: "same-origin",
    body,
  }).then(readEnvelope<DietPdfInfo>);
}

export function deleteDietPdf(clientId: number): Promise<void> {
  return sendJson<void>(`/api/diet-pdf?clientId=${clientId}`, "DELETE");
}

export function searchRecipes(query: string): Promise<RecipeHit[]> {
  return getJson<RecipeHit[]>(`/api/recipes?q=${encodeURIComponent(query)}`);
}

/** Fill a cached food's serving data (label + weight) from OFF, once. */
export function enrichFood(id: string): Promise<FoodHit> {
  return sendJson<FoodHit>("/api/foods/enrich", "POST", { id });
}

export function searchFoods(query: string, brand?: string): Promise<FoodHit[]> {
  const params = new URLSearchParams({ q: query });

  if (brand !== undefined && brand.trim().length > 0) {
    params.set("brand", brand.trim());
  }

  return getJson<FoodHit[]>(`/api/foods/search?${params.toString()}`);
}
