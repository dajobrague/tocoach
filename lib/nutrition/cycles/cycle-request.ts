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
  | { sourceType: "recipe"; recipeId: string }
  | { sourceType: "food"; ingredientId: string; quantity: number };

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

    return { ok: true, value: { sourceType: "recipe", recipeId } };
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

    return {
      ok: true,
      value: { sourceType: "food", ingredientId, quantity: record.quantity },
    };
  }

  return { ok: false, error: "source_type debe ser 'recipe' o 'food'" };
}

export function parseUpdateOption(
  body: unknown
): ParseResult<{ position: number }> {
  const record = asRecord(body);

  if (record === null || isInt(record.position) === false) {
    return { ok: false, error: "position debe ser un entero" };
  }

  return { ok: true, value: { position: record.position } };
}
