import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { setClientSelection } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client MealCycle Selection API]";

/**
 * POST /api/client/meal-cycle/selection — set/update the authed client's option
 * choice for one meal slot. Body: `{ slotId, optionId }`.
 *
 * Auth boundary (§4.4): client-session only; the client id comes from the
 * verified session, never the request. The slot must belong to the client's own
 * active cycle and the option to that slot — otherwise `setClientSelection`
 * returns null and this responds 404 (no row written). Behind the nutrition-v2
 * flag (404 when off). The choice upserts on (client_id, slot_id).
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
    const enabled = await isNutritionV2Enabled(tenant?.host ?? "");

    if (enabled === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    const slotId = readId(body, "slotId");
    const optionId = readId(body, "optionId");

    if (slotId === null || optionId === null) {
      return NextResponse.json(
        { success: false, error: "slotId y optionId son obligatorios" },
        { status: 400 }
      );
    }

    const selection = await setClientSelection(
      createSupabaseClient(),
      clientId,
      slotId,
      optionId
    );

    // null = the slot is not in this client's own active cycle (or the option
    // is not in the slot). Hide existence with a 404, like the rest of §4.4.
    if (selection === null) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: selection });
  } catch (error) {
    console.error(`${LOG_PREFIX} set error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

/** A non-empty string field from the request body, or null. */
function readId(body: unknown, key: string): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const value = (body as Record<string, unknown>)[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * The numeric `clients.id` carried by a valid client session (stored as a
 * string), or `null` for an unauthenticated request, a trainer token, or any
 * malformed value.
 */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
