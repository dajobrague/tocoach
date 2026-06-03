import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { aggregateShoppingList } from "@/lib/nutrition/shopping/shopping-list";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client ShoppingList API]";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/client/shopping-list?from=&to= — a merged ingredient shopping list
 * for the authed client's own active meal cycle over the `[from, to]` calendar
 * range. Each date resolves to its rotation day, the selected (or first) option
 * per slot is taken, and snapshot ingredient quantities are summed, merging by
 * (name, unit).
 *
 * Auth boundary (§4.4 / §4.6): client-session only. The numeric client id comes
 * exclusively from the verified session (never the request), so a client can
 * only ever produce their own list — a request-supplied `clientId` is ignored.
 * A trainer JWT (no numeric `client_id`) is rejected 401. Behind the
 * nutrition-v2 flag: when off the route 404s to hide its existence. A missing,
 * malformed, or inverted range is 400. No active cycle is a clean empty 200.
 *
 * The range is taken as tz-less calendar dates; "UTC" is threaded into the
 * day-math (consistent with the meal-cycle route) since both bounds and the
 * cycle start are calendar dates.
 */
export async function GET(request: NextRequest) {
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
    // Flag gate first (404 hides existence) — before validating the range.
    const tenant = await loadTenantContext(session!.tenant_slug);
    const enabled = await isNutritionV2Enabled(tenant?.host ?? "");

    if (enabled === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    const range = parseRange(new URL(request.url).searchParams);

    if (range === null) {
      return NextResponse.json(
        { success: false, error: "Rango de fechas inválido" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const [tree, selections] = await Promise.all([
      getActiveCycleTreeForClient(supabase, clientId),
      getClientSelections(supabase, clientId),
    ]);
    const items = aggregateShoppingList({
      tree,
      selections,
      from: range.from,
      to: range.to,
    });

    return NextResponse.json({
      success: true,
      data: { from: range.from, to: range.to, items },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} fetch error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

/**
 * The validated `[from, to]` range, or `null` for a missing/malformed/inverted
 * range (which the route maps to 400). Both bounds must be real "YYYY-MM-DD"
 * calendar dates and `from` must be on or before `to`.
 */
function parseRange(
  params: URLSearchParams
): { from: string; to: string } | null {
  const from = params.get("from");
  const to = params.get("to");

  if (isCalendarDate(from) === false || isCalendarDate(to) === false) {
    return null;
  }

  // Both pass the shape check; compare as ISO strings (lexicographic = chronological).
  if (from! > to!) {
    return null;
  }

  return { from: from!, to: to! };
}

/**
 * True when `value` is a real "YYYY-MM-DD" calendar date. Rejects bad shapes
 * and impossible dates (e.g. 2026-02-30, which would roll over to March).
 */
function isCalendarDate(value: string | null): value is string {
  if (value === null || YMD.test(value) === false) {
    return false;
  }

  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/**
 * The numeric `clients.id` carried by a valid client session (stored as a
 * string), or `null` for an unauthenticated request, a trainer token (no
 * `client_id`), or any malformed value.
 */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
