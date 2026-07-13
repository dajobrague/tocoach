import type {
  CycleStatus,
  UpdateCycleInput,
  UpdateSlotInput,
} from "./meal-cycle-service";
import type { ParseResult } from "@/lib/nutrition/recipes/recipe-request";

const CYCLE_STATUSES: readonly CycleStatus[] = ["draft", "active", "archived"];

export interface CreateCycleBody {
  name: string;
  durationDays: number;
  clientId: number;
  startDate?: string;
}

export type AddOptionBody =
  | {
      sourceType: "recipe";
      recipeId: string;
      quantities?: number[];
      groupIndex?: number;
      /** Trainer's per-client note about this option. */
      trainerComment?: string;
    }
  | {
      sourceType: "food";
      ingredientId: string;
      quantity: number;
      groupIndex?: number;
      trainerComment?: string;
    };

export interface UpdateOptionBody {
  position?: number;
  /** Per-ingredient grams (by sort order) for a per-client re-portion. */
  quantities?: number[];
  /** Trainer's per-client note; empty string clears it. */
  trainerComment?: string;
}

export interface AddSlotBody {
  dayIndex: number;
  label?: string;
  position?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value) === false
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCycleStatus(value: unknown): value is CycleStatus {
  return (
    typeof value === "string" &&
    (CYCLE_STATUSES as readonly string[]).includes(value)
  );
}

export function parseCreateCycle(body: unknown): ParseResult<CreateCycleBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const name = typeof record.name === "string" ? record.name.trim() : "";

  if (name.length === 0) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  if (isInt(record.duration_days) === false || record.duration_days < 1) {
    return { ok: false, error: "duration_days debe ser un entero positivo" };
  }

  if (isFiniteNumber(record.client_id) === false) {
    return { ok: false, error: "client_id es obligatorio" };
  }

  const value: CreateCycleBody = {
    name,
    durationDays: record.duration_days,
    clientId: record.client_id,
  };

  if (typeof record.start_date === "string" && record.start_date.length > 0) {
    value.startDate = record.start_date;
  }

  return { ok: true, value };
}

export function parseUpdateCycle(body: unknown): ParseResult<UpdateCycleInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const value: UpdateCycleInput = {};

  if (record.name !== undefined) {
    const name = typeof record.name === "string" ? record.name.trim() : "";

    if (name.length === 0) {
      return { ok: false, error: "El nombre es obligatorio" };
    }

    value.name = name;
  }

  if (record.duration_days !== undefined) {
    if (isInt(record.duration_days) === false || record.duration_days < 1) {
      return { ok: false, error: "duration_days debe ser un entero positivo" };
    }

    value.durationDays = record.duration_days;
  }

  if (record.start_date !== undefined) {
    if (typeof record.start_date !== "string") {
      return { ok: false, error: "start_date inválida" };
    }

    value.startDate = record.start_date;
  }

  if (record.status !== undefined) {
    if (isCycleStatus(record.status) === false) {
      return { ok: false, error: "status inválido" };
    }

    value.status = record.status;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No hay cambios" };
  }

  return { ok: true, value };
}

export function parseAddSlot(body: unknown): ParseResult<AddSlotBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.day_index) === false || record.day_index < 0) {
    return { ok: false, error: "day_index debe ser un entero >= 0" };
  }

  const value: AddSlotBody = { dayIndex: record.day_index };

  if (typeof record.label === "string") value.label = record.label;
  if (isInt(record.position)) value.position = record.position;

  return { ok: true, value };
}

export interface CopyDayBody {
  sourceDayIndex: number;
  targetDayIndex: number;
}

/** Body for POST .../copy-day: replace one day with a copy of another. */
export function parseCopyDay(body: unknown): ParseResult<CopyDayBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.source_day_index) === false || record.source_day_index < 0) {
    return { ok: false, error: "source_day_index debe ser un entero >= 0" };
  }

  if (isInt(record.target_day_index) === false || record.target_day_index < 0) {
    return { ok: false, error: "target_day_index debe ser un entero >= 0" };
  }

  if (record.source_day_index === record.target_day_index) {
    return {
      ok: false,
      error: "source_day_index y target_day_index deben ser diferentes",
    };
  }

  return {
    ok: true,
    value: {
      sourceDayIndex: record.source_day_index,
      targetDayIndex: record.target_day_index,
    },
  };
}

export interface RemoveDayBody {
  dayIndex: number;
}

/** Body for POST .../remove-day: drop a day and renumber the later ones down. */
export function parseRemoveDay(body: unknown): ParseResult<RemoveDayBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.day_index) === false || record.day_index < 0) {
    return { ok: false, error: "day_index debe ser un entero >= 0" };
  }

  return { ok: true, value: { dayIndex: record.day_index } };
}

export interface ReorderDayBody {
  fromIndex: number;
  toIndex: number;
}

/** Body for POST .../reorder-day: move a day to a new position (days renumber). */
export function parseReorderDay(body: unknown): ParseResult<ReorderDayBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.from_index) === false || record.from_index < 0) {
    return { ok: false, error: "from_index debe ser un entero >= 0" };
  }

  if (isInt(record.to_index) === false || record.to_index < 0) {
    return { ok: false, error: "to_index debe ser un entero >= 0" };
  }

  return {
    ok: true,
    value: { fromIndex: record.from_index, toIndex: record.to_index },
  };
}

export interface AddDayBody {
  /** Seed the new day from a copy of this day; omit for a blank day. */
  copyFromDayIndex?: number;
}

/** Body for POST .../add-day: append a day, optionally copied from another. */
export function parseAddDay(body: unknown): ParseResult<AddDayBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const value: AddDayBody = {};

  if (record.copy_from_day_index !== undefined) {
    if (
      isInt(record.copy_from_day_index) === false ||
      record.copy_from_day_index < 0
    ) {
      return {
        ok: false,
        error: "copy_from_day_index debe ser un entero >= 0",
      };
    }

    value.copyFromDayIndex = record.copy_from_day_index;
  }

  return { ok: true, value };
}

export interface AssignDayTargetBody {
  dayIndex: number;
  /** Goal preset to assign, or null to fall back to the default goals. */
  presetId: string | null;
}

/** Body for PUT .../day-target: assign/clear one day's goal preset. */
export function parseAssignDayTarget(
  body: unknown
): ParseResult<AssignDayTargetBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.day_index) === false || record.day_index < 0) {
    return { ok: false, error: "day_index debe ser un entero >= 0" };
  }

  if (record.preset_id === null) {
    return { ok: true, value: { dayIndex: record.day_index, presetId: null } };
  }

  const presetId =
    typeof record.preset_id === "string" ? record.preset_id.trim() : "";

  if (presetId.length === 0) {
    return { ok: false, error: "preset_id debe ser un id o null" };
  }

  return { ok: true, value: { dayIndex: record.day_index, presetId } };
}

export interface RenameDayBody {
  dayIndex: number;
  /** Empty string clears the name (back to "Día N"). */
  name: string;
}

/** Body for PUT .../day-name: name one day of the plan. */
export function parseRenameDay(body: unknown): ParseResult<RenameDayBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (isInt(record.day_index) === false || record.day_index < 0) {
    return { ok: false, error: "day_index debe ser un entero >= 0" };
  }

  if (typeof record.name !== "string") {
    return { ok: false, error: "name debe ser un texto" };
  }

  return {
    ok: true,
    value: { dayIndex: record.day_index, name: record.name },
  };
}

export interface MenuChoiceBody {
  /** "YYYY-MM-DD". */
  date: string;
  /** Menu to follow that date, or null to go back to the recommendation. */
  dayIndex: number | null;
}

/** Body for PUT /api/client/meal-cycle/menu-choice. */
export function parseMenuChoice(body: unknown): ParseResult<MenuChoiceBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const date = typeof record.date === "string" ? record.date : "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(date) === false) {
    return { ok: false, error: "date inválida (YYYY-MM-DD)" };
  }

  if (record.day_index === null) {
    return { ok: true, value: { date, dayIndex: null } };
  }

  if (isInt(record.day_index) === false || record.day_index < 0) {
    return { ok: false, error: "day_index debe ser un entero >= 0 o null" };
  }

  return { ok: true, value: { date, dayIndex: record.day_index } };
}

export function parseUpdateSlot(body: unknown): ParseResult<UpdateSlotInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const value: UpdateSlotInput = {};

  if (record.day_index !== undefined) {
    if (isInt(record.day_index) === false || record.day_index < 0) {
      return { ok: false, error: "day_index debe ser un entero >= 0" };
    }

    value.dayIndex = record.day_index;
  }

  if (record.label !== undefined) {
    if (typeof record.label !== "string") {
      return { ok: false, error: "label inválido" };
    }

    value.label = record.label;
  }

  if (record.position !== undefined) {
    if (isInt(record.position) === false) {
      return { ok: false, error: "position inválida" };
    }

    value.position = record.position;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No hay cambios" };
  }

  return { ok: true, value };
}

export function parseAddOption(body: unknown): ParseResult<AddOptionBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  if (record.source_type === "recipe") {
    const recipeId =
      typeof record.recipe_id === "string" ? record.recipe_id.trim() : "";

    if (recipeId.length === 0) {
      return { ok: false, error: "recipe_id es obligatorio" };
    }

    const quantities = asNumberArray(record.quantities);

    if (quantities === null) {
      return {
        ok: false,
        error: "quantities debe ser una lista de números ≥ 0",
      };
    }

    const groupIndex = parseGroupIndex(record.group_index);

    if (groupIndex === null) {
      return { ok: false, error: "group_index debe ser un entero >= 0" };
    }

    const trainerComment = parseTrainerComment(record.trainer_comment);

    if (trainerComment === null) {
      return { ok: false, error: "trainer_comment debe ser un texto" };
    }

    const value: AddOptionBody = { sourceType: "recipe", recipeId };

    if (quantities !== undefined) value.quantities = quantities;
    if (groupIndex !== undefined) value.groupIndex = groupIndex;
    if (trainerComment !== undefined) value.trainerComment = trainerComment;

    return { ok: true, value };
  }

  if (record.source_type === "food") {
    const ingredientId =
      typeof record.ingredient_id === "string"
        ? record.ingredient_id.trim()
        : "";

    if (ingredientId.length === 0) {
      return { ok: false, error: "ingredient_id es obligatorio" };
    }

    if (isFiniteNumber(record.quantity) === false || record.quantity <= 0) {
      return { ok: false, error: "quantity debe ser un número positivo" };
    }

    const groupIndex = parseGroupIndex(record.group_index);

    if (groupIndex === null) {
      return { ok: false, error: "group_index debe ser un entero >= 0" };
    }

    const trainerComment = parseTrainerComment(record.trainer_comment);

    if (trainerComment === null) {
      return { ok: false, error: "trainer_comment debe ser un texto" };
    }

    const value: AddOptionBody = {
      sourceType: "food",
      ingredientId,
      quantity: record.quantity,
    };

    if (groupIndex !== undefined) value.groupIndex = groupIndex;
    if (trainerComment !== undefined) value.trainerComment = trainerComment;

    return { ok: true, value };
  }

  return { ok: false, error: "source_type debe ser 'recipe' o 'food'" };
}

export function parseUpdateOption(
  body: unknown
): ParseResult<UpdateOptionBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo de la petición inválido" };
  }

  const value: UpdateOptionBody = {};

  if (isInt(record.position)) value.position = record.position;

  const quantities = asNumberArray(record.quantities);

  if (quantities === null) {
    return { ok: false, error: "quantities debe ser una lista de números ≥ 0" };
  }

  if (quantities !== undefined) value.quantities = quantities;

  const trainerComment = parseTrainerComment(record.trainer_comment);

  if (trainerComment === null) {
    return { ok: false, error: "trainer_comment debe ser un texto" };
  }

  if (trainerComment !== undefined) value.trainerComment = trainerComment;

  if (value.position === undefined && value.quantities === undefined) {
    return { ok: false, error: "position o quantities es obligatorio" };
  }

  return { ok: true, value };
}

/**
 * Validate an optional trainer comment: `undefined` when absent, `null` when
 * present but not a string. An empty string is kept — on update it means
 * "clear the note".
 */
function parseTrainerComment(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : null;
}

/**
 * Validate an optional group index: `undefined` when absent, `null` when
 * present but not a non-negative integer (fail fast on bad grouping).
 */
function parseGroupIndex(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return isInt(value) && value >= 0 ? value : null;
}

/**
 * Validate an optional array of portion amounts: `undefined` when absent,
 * `null` when present but malformed (non-array entries, NaN/Infinity, or
 * negatives) so callers reject instead of silently re-portioning to 0.
 */
function asNumberArray(value: unknown): number[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) === false) {
    return null;
  }

  return value.every((v) => isFiniteNumber(v) && v >= 0)
    ? (value as number[])
    : null;
}
