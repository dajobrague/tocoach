import type {
  CreateOverrideInput,
  UpdateOverrideInput,
} from "./override-service";
import type { OverrideScope, OverrideType } from "./override-types";
import type { ParseResult } from "@/lib/nutrition/recipes/recipe-request";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const TYPES: readonly OverrideType[] = ["note", "swap"];
const SCOPES: readonly OverrideScope[] = [
  "single_day",
  "day_forward",
  "every_cycle",
];

/** The create body (cycleId comes from the route path, not the body). */
export type CreateOverrideBody = Omit<CreateOverrideInput, "cycleId">;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || YMD.test(value) === false) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate a create-override body. Enforces type×scope shape:
 *   * note → `noteText` required; swap fields ignored.
 *   * swap → `slotId` + `swapSourceType` + `swapSourceRefId` required.
 *   * every_cycle → `dayIndex` (int ≥ 0) required.
 * `anchorDate` is always a real `YYYY-MM-DD`.
 */
export function parseCreateOverride(
  body: unknown
): ParseResult<CreateOverrideBody> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo inválido" };
  }

  const overrideType = record["overrideType"];

  if (!isOneOf(overrideType, TYPES)) {
    return { ok: false, error: "overrideType inválido" };
  }

  const scope = record["scope"];

  if (!isOneOf(scope, SCOPES)) {
    return { ok: false, error: "scope inválido" };
  }

  if (!isCalendarDate(record["anchorDate"])) {
    return { ok: false, error: "anchorDate inválida" };
  }

  const dayIndexResult = parseDayIndex(record["dayIndex"], scope);

  if (dayIndexResult.ok === false) {
    return dayIndexResult;
  }

  const base: CreateOverrideBody = {
    overrideType,
    scope,
    anchorDate: record["anchorDate"],
    dayIndex: dayIndexResult.value,
  };

  if (overrideType === "note") {
    if (!nonEmptyString(record["noteText"])) {
      return { ok: false, error: "noteText es obligatorio para una nota" };
    }

    return {
      ok: true,
      value: { ...base, noteText: record["noteText"].trim(), slotId: null },
    };
  }

  // swap
  if (!nonEmptyString(record["slotId"])) {
    return { ok: false, error: "slotId es obligatorio para un swap" };
  }

  const swapSourceType = record["swapSourceType"];

  if (swapSourceType !== "recipe" && swapSourceType !== "food") {
    return { ok: false, error: "swapSourceType inválido" };
  }

  if (!nonEmptyString(record["swapSourceRefId"])) {
    return { ok: false, error: "swapSourceRefId es obligatorio" };
  }

  return {
    ok: true,
    value: {
      ...base,
      slotId: record["slotId"],
      swapSourceType,
      swapSourceRefId: record["swapSourceRefId"],
      ...(typeof record["swapQuantity"] === "number"
        ? { swapQuantity: record["swapQuantity"] }
        : {}),
    },
  };
}

/**
 * Validate an update body — every field optional, but each present field is
 * validated, and setting `scope` to `every_cycle` requires a `dayIndex`.
 */
export function parseUpdateOverride(
  body: unknown
): ParseResult<UpdateOverrideInput> {
  const record = asRecord(body);

  if (record === null) {
    return { ok: false, error: "Cuerpo inválido" };
  }

  const patch: UpdateOverrideInput = {};

  if (record["scope"] !== undefined) {
    if (!isOneOf(record["scope"], SCOPES)) {
      return { ok: false, error: "scope inválido" };
    }
    patch.scope = record["scope"];
  }

  if (record["anchorDate"] !== undefined) {
    if (!isCalendarDate(record["anchorDate"])) {
      return { ok: false, error: "anchorDate inválida" };
    }
    patch.anchorDate = record["anchorDate"];
  }

  if (record["dayIndex"] !== undefined) {
    const value = record["dayIndex"];

    if (value !== null && (!Number.isInteger(value) || (value as number) < 0)) {
      return { ok: false, error: "dayIndex inválido" };
    }
    patch.dayIndex = value as number | null;
  }

  if (patch.scope === "every_cycle" && (patch.dayIndex ?? null) === null) {
    return { ok: false, error: "every_cycle requiere dayIndex" };
  }

  if (record["noteText"] !== undefined) {
    if (!nonEmptyString(record["noteText"])) {
      return { ok: false, error: "noteText inválido" };
    }
    patch.noteText = record["noteText"].trim();
  }

  if (record["slotId"] !== undefined) {
    patch.slotId = record["slotId"] === null ? null : `${record["slotId"]}`;
  }

  if (record["swapSourceType"] !== undefined) {
    if (
      record["swapSourceType"] !== "recipe" &&
      record["swapSourceType"] !== "food"
    ) {
      return { ok: false, error: "swapSourceType inválido" };
    }
    patch.swapSourceType = record["swapSourceType"];
  }

  if (record["swapSourceRefId"] !== undefined) {
    if (!nonEmptyString(record["swapSourceRefId"])) {
      return { ok: false, error: "swapSourceRefId inválido" };
    }
    patch.swapSourceRefId = record["swapSourceRefId"];
  }

  if (typeof record["swapQuantity"] === "number") {
    patch.swapQuantity = record["swapQuantity"];
  }

  return { ok: true, value: patch };
}

function parseDayIndex(
  value: unknown,
  scope: OverrideScope
): ParseResult<number | null> {
  if (scope === "every_cycle") {
    if (!Number.isInteger(value) || (value as number) < 0) {
      return { ok: false, error: "every_cycle requiere dayIndex (entero ≥ 0)" };
    }

    return { ok: true, value: value as number };
  }

  return { ok: true, value: null };
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[]
): value is T {
  return (
    typeof value === "string" && (options as readonly string[]).includes(value)
  );
}
