import type { ClientSession } from "@/lib/auth/client-session";
import type {
  MealLogStatus,
  SetMealLogInput,
} from "@/lib/nutrition/logs/meal-log-service";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import {
  MEAL_LOG_STATUSES,
  setMealLog,
} from "@/lib/nutrition/logs/meal-log-service";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client MealLogs API]";

/**
 * POST /api/client/meal-logs — log a meal. Body: `slot_id`, `log_date`,
 * `status`, optional `option_id` + `comment` + `photo_url`.
 *
 * Auth boundary (§4.4): client-session only; the client id comes from the
 * verified session, never the request. The slot must belong to the client's own
 * active cycle (and any `option_id` to that slot) or `setMealLog` returns null →
 * 404, no write. Upserts on (client_id, slot_id, log_date). Behind the
 * nutrition-v2 flag (404 when off).
 */
export async function POST(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getClientSession();
  const clientId = parseClientId(session);

  if (clientId === null) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  try {
    const tenant = await loadTenantContext(session!.tenant_slug);

    if ((await isNutritionV2Enabled(tenant?.host ?? "")) === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(body);

    if (parsed === null) {
      return NextResponse.json(
        {
          success: false,
          error: "slot_id, log_date y un status válido son obligatorios",
        },
        { status: 400 }
      );
    }

    const log = await setMealLog(createSupabaseClient(), clientId, parsed);

    // null = the slot is not in this client's own active cycle (§4.4).
    if (log === null) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} log error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

function isStatus(value: unknown): value is MealLogStatus {
  return (
    typeof value === "string" &&
    (MEAL_LOG_STATUSES as readonly string[]).includes(value)
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

/** Validate + map the request body to a SetMealLogInput, or null when invalid. */
function parseBody(body: unknown): SetMealLogInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const slotId = readString(record["slot_id"]);
  const logDate = readString(record["log_date"]);
  const status = record["status"];

  if (
    slotId === undefined ||
    logDate === undefined ||
    isStatus(status) === false
  ) {
    return null;
  }

  const input: SetMealLogInput = { slotId, logDate, status };
  const optionId = readString(record["option_id"]);
  const comment = readString(record["comment"]);
  const photoUrl = readString(record["photo_url"]);

  if (optionId !== undefined) input.optionId = optionId;
  if (comment !== undefined) input.comment = comment;
  if (photoUrl !== undefined) input.photoUrl = photoUrl;

  return input;
}

/** The numeric clients.id from a valid client session, or null (trainer/none). */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
