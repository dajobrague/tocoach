import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { buildClientCycleView } from "@/lib/nutrition/cycles/cycle-day";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client MealCycle API]";

/**
 * GET /api/client/meal-cycle — the authed client's own active meal cycle as a
 * frozen-snapshot tree (cycle → days → slots → options), plus where "today"
 * falls in the rotation.
 *
 * Auth boundary (§4.4): client-session only. The numeric client id comes
 * exclusively from the verified session (never the request), so a client can
 * fetch only their own cycle. A trainer JWT (which carries `trainer_id`, not a
 * numeric `client_id`) is rejected with 401. Behind the nutrition-v2 flag: when
 * off the route 404s to hide its existence. No active cycle is a clean empty
 * result, not an error.
 *
 * "Today" is computed in the client's IANA timezone, passed as `?tz=` from the
 * browser (same convention as the charts API); defaults to "UTC" when absent.
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
    // Flag gate first (404 hides existence). The per-tenant flag keys on the
    // tenant *host*; resolve it from the session's slug via the cached loader.
    const tenant = await loadTenantContext(session!.tenant_slug);
    const enabled = await isNutritionV2Enabled(tenant?.host ?? "");

    if (enabled === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    // Client timezone from the browser (charts convention); UTC when absent.
    const timeZone = new URL(request.url).searchParams.get("tz") || "UTC";
    const supabase = createSupabaseClient();
    const [tree, selections] = await Promise.all([
      getActiveCycleTreeForClient(supabase, clientId),
      getClientSelections(supabase, clientId),
    ]);
    const view = buildClientCycleView(tree, new Date(), timeZone, selections);

    return NextResponse.json({ success: true, data: view });
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
 * The numeric `clients.id` carried by a valid client session (stored as a
 * string — see lib/auth/client-session.ts), or `null` for an unauthenticated
 * request, a trainer token (no `client_id`), or any malformed value.
 */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
